import { wipeUserRows } from "@/lib/auth/delete-account.server";
import { getSql } from "@/lib/db";
import { packageLabel, paidFromStatus, type CheckoutPackage, type MachPackage } from "@/lib/billing/limits";
import {
  deskTrialBlocked,
  deskTrialDays,
  deskTrialIdempotencyKey,
  deskTrialSubscriptionParams,
} from "@/lib/billing/desk-trial";
import {
  getStripe,
  loadSubscription,
  priceIdFor,
  upsertSubscription,
} from "@/lib/billing/stripe.server";
import { ensureSubscriptionsTable } from "@/lib/billing/schema.server";
import { recordAdminEvent } from "./audit.server";
import { emailsMatch } from "./gate";
import { opsDeleteBlockReason, opsDeletePasswordMissing } from "./desk-delete";
import { verifyOpsDeskPassword } from "./desk-password.server";
import type { OpsActor } from "./gate.server";
import { ownerEmails } from "./gate.server";

export type OpsWriteResult = { ok: true; message: string } | { ok: false; error: string };

async function emailFor(userId: string): Promise<string | null> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ email: string | null }>(
      `select email from "user" where id = $1 limit 1`,
      [userId],
    );
    return rows[0]?.email ?? null;
  } catch {
    return null;
  }
}

async function idForEmail(email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  try {
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `select id from "user" where lower(email) = $1 limit 1`,
      [needle],
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function resolveTarget(
  userId: string,
  email?: string,
): Promise<{ id: string; email: string | null } | null> {
  const id = userId.trim() || (email ? await idForEmail(email) : null);
  if (!id) return null;
  const stored = await emailFor(id);
  if (stored == null && !(await userExists(id))) return null;
  return { id, email: stored };
}

function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function laterOf(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

async function log(
  actor: OpsActor,
  targetUserId: string,
  action: string,
  detail: Record<string, unknown>,
  note?: string | null,
): Promise<void> {
  const targetEmail = await emailFor(targetUserId);
  const err = await recordAdminEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    targetUserId,
    targetEmail,
    action,
    detail,
    note,
  });
  if (err) {
    /* desk still applied the write; surface log miss on the message if needed */
  }
}

export async function setOpsPackage(
  actor: OpsActor,
  input: {
    userId: string;
    email?: string;
    plan: MachPackage;
    interval: "month" | "year";
    cancelNow?: boolean;
    note?: string;
  },
): Promise<OpsWriteResult> {
  const target = await resolveTarget(input.userId, input.email);
  if (!target) {
    return { ok: false, error: "No person with that id or email." };
  }
  const userId = target.id;
  const targetEmail = target.email;
  const row = await loadSubscription(userId);
  const liveStripe = Boolean(row?.stripe_subscription_id && paidFromStatus(row.status));

  if (input.plan === "free") {
    if (liveStripe && row?.stripe_subscription_id) {
      const stripe = await getStripe();
      if (input.cancelNow) {
        await stripe.subscriptions.cancel(row.stripe_subscription_id);
        await upsertSubscription({
          userId,
          customerId: row.stripe_customer_id,
          subscriptionId: row.stripe_subscription_id,
          status: "canceled",
          priceId: row.price_id,
          periodEnd: new Date(),
        });
      } else {
        await stripe.subscriptions.update(row.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      }
    } else {
      await ensureSubscriptionsTable();
      await upsertSubscription({
        userId,
        customerId: row?.stripe_customer_id ?? null,
        subscriptionId: row?.stripe_subscription_id ?? null,
        status: "canceled",
        priceId: row?.price_id ?? null,
        periodEnd: new Date(),
      });
    }
    await log(
      actor,
      userId,
      "set_package",
      { plan: "free", cancelNow: Boolean(input.cancelNow), hadStripe: liveStripe },
      input.note,
    );
    return {
      ok: true,
      message: input.cancelNow
        ? `Set ${targetEmail ?? userId} to Free (ended now).`
        : `Set ${targetEmail ?? userId} to Free at period end.`,
    };
  }

  const pkg = input.plan as CheckoutPackage;
  let priceId: string;
  try {
    priceId = priceIdFor(input.interval, pkg);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Missing Stripe price." };
  }

  if (liveStripe && row?.stripe_subscription_id) {
    const stripe = await getStripe();
    const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    const itemId = sub.items.data[0]?.id;
    if (!itemId) return { ok: false, error: "That Stripe subscription has no item to change." };
    await stripe.subscriptions.update(row.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: {
        ...(sub.metadata ?? {}),
        userId,
        package: pkg,
      },
    });
    await log(
      actor,
      userId,
      "set_package",
      { plan: pkg, interval: input.interval, via: "stripe", priceId },
      input.note,
    );
    return {
      ok: true,
      message: `Asked Stripe to move ${targetEmail ?? userId} to ${packageLabel(pkg)} (${input.interval}). Webhook will refresh the seat.`,
    };
  }

  const periodEnd = addMonths(new Date(), input.interval === "year" ? 12 : 1);
  await ensureSubscriptionsTable();
  await upsertSubscription({
    userId,
    customerId: row?.stripe_customer_id ?? null,
    subscriptionId: null,
    status: "active",
    priceId,
    periodEnd,
  });
  await log(
    actor,
    userId,
    "set_package",
    { plan: pkg, interval: input.interval, via: "comp", priceId, periodEnd: periodEnd.toISOString() },
    input.note,
  );
  return {
    ok: true,
    message: `Comp ${packageLabel(pkg)} on ${targetEmail ?? userId} through ${periodEnd.toISOString().slice(0, 10)}.`,
  };
}

export async function compOpsTime(
  actor: OpsActor,
  input: {
    userId: string;
    email?: string;
    mode: "month" | "year" | "custom";
    customEnd?: string;
    note: string;
  },
): Promise<OpsWriteResult> {
  const note = input.note.trim();
  if (!note) return { ok: false, error: "Comp time needs a short note." };
  const target = await resolveTarget(input.userId, input.email);
  if (!target) return { ok: false, error: "No person with that id or email." };
  const userId = target.id;
  const targetEmail = target.email;
  const row = await loadSubscription(userId);
  const now = new Date();
  const currentEnd =
    row?.current_period_end == null
      ? now
      : typeof row.current_period_end === "string"
        ? new Date(row.current_period_end)
        : new Date(row.current_period_end);
  const base = laterOf(now, Number.isNaN(currentEnd.getTime()) ? now : currentEnd);
  let periodEnd: Date;
  if (input.mode === "custom") {
    const raw = (input.customEnd ?? "").trim();
    periodEnd = new Date(raw);
    if (!raw || Number.isNaN(periodEnd.getTime())) {
      return { ok: false, error: "Custom end date is not a valid date." };
    }
  } else {
    periodEnd = addMonths(base, input.mode === "year" ? 12 : 1);
  }
  await ensureSubscriptionsTable();
  await upsertSubscription({
    userId,
    customerId: row?.stripe_customer_id ?? null,
    subscriptionId: row?.stripe_subscription_id ?? null,
    status: paidFromStatus(row?.status) ? row?.status ?? "active" : "active",
    priceId: row?.price_id ?? null,
    periodEnd,
  });
  await log(
    actor,
    userId,
    "comp_time",
    { mode: input.mode, periodEnd: periodEnd.toISOString() },
    note,
  );
  return {
    ok: true,
    message: `Extended ${targetEmail ?? userId} through ${periodEnd.toISOString().slice(0, 10)}.`,
  };
}

export async function cancelOpsSubscription(
  actor: OpsActor,
  input: { userId: string; email?: string; when: "now" | "period_end"; note?: string },
): Promise<OpsWriteResult> {
  const target = await resolveTarget(input.userId, input.email);
  if (!target) return { ok: false, error: "No person with that id or email." };
  const userId = target.id;
  const targetEmail = target.email;
  const row = await loadSubscription(userId);
  if (!row?.stripe_subscription_id) {
    await ensureSubscriptionsTable();
    await upsertSubscription({
      userId,
      customerId: row?.stripe_customer_id ?? null,
      subscriptionId: null,
      status: "canceled",
      priceId: row?.price_id ?? null,
      periodEnd: new Date(),
    });
    await log(actor, userId, "cancel", { when: input.when, via: "neon" }, input.note);
    return { ok: true, message: `Cleared the seat for ${targetEmail ?? userId}. Login stays.` };
  }
  const stripe = await getStripe();
  if (input.when === "now") {
    await stripe.subscriptions.cancel(row.stripe_subscription_id);
    await upsertSubscription({
      userId,
      customerId: row.stripe_customer_id,
      subscriptionId: row.stripe_subscription_id,
      status: "canceled",
      priceId: row.price_id,
      periodEnd: new Date(),
    });
  } else {
    await stripe.subscriptions.update(row.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  }
  await log(
    actor,
    userId,
    "cancel",
    { when: input.when, via: "stripe", subscriptionId: row.stripe_subscription_id },
    input.note,
  );
  return {
    ok: true,
    message:
      input.when === "now"
        ? `Canceled Stripe for ${targetEmail ?? userId} now. Login stays.`
        : `Stripe will end at period end for ${targetEmail ?? userId}. Login stays.`,
  };
}

function keptPeriod(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function advisorGrantOn(userId: string): Promise<boolean> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ advisor_grant: boolean | null }>(
      `select advisor_grant from mach_subscriptions where user_id = $1 limit 1`,
      [userId],
    );
    return rows[0]?.advisor_grant === true;
  } catch {
    return false;
  }
}

export async function startOpsDeskTrial(
  actor: OpsActor,
  input: {
    userId: string;
    email?: string;
    interval: "month" | "year";
    trialDays: number;
    note: string;
  },
): Promise<OpsWriteResult> {
  const note = input.note.trim();
  if (!note) return { ok: false, error: "A trial needs a short note." };
  const length = deskTrialDays(input.trialDays, "days");
  if (!length.ok) return { ok: false, error: length.error };
  const target = await resolveTarget(input.userId, input.email);
  if (!target) return { ok: false, error: "No person with that id or email." };
  if (!target.email) return { ok: false, error: "This account has no email. A trial needs an email." };
  const userId = target.id;
  const targetEmail = target.email;
  await ensureSubscriptionsTable();
  const row = await loadSubscription(userId);
  const blocked = deskTrialBlocked({
    hasEmail: true,
    advisorGrant: await advisorGrantOn(userId),
    stripeSubscriptionId: row?.stripe_subscription_id ?? null,
    status: row?.status ?? null,
  });
  if (blocked) return { ok: false, error: blocked };

  let priceId: string;
  try {
    priceId = priceIdFor(input.interval, "unlimited");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Missing Stripe price." };
  }

  const stripe = await getStripe();
  let customerId = row?.stripe_customer_id ?? null;
  if (!customerId) {
    try {
      const customer = await stripe.customers.create(
        { email: targetEmail, metadata: { userId } },
        { idempotencyKey: `desk-unlimited-customer-${userId}` },
      );
      customerId = customer.id;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Stripe could not create the customer." };
    }
    await upsertSubscription({
      userId,
      customerId,
      subscriptionId: row?.stripe_subscription_id ?? null,
      status: row?.status ?? "none",
      priceId: row?.price_id ?? null,
      periodEnd: keptPeriod(row?.current_period_end),
    });
  }

  const params = deskTrialSubscriptionParams({
    customerId,
    priceId,
    userId,
    trialDays: length.days,
  });
  let created: {
    id: string;
    status: string;
    trial_end?: number | null;
    current_period_end?: number;
    items: { data: Array<{ current_period_end?: number }> };
  };
  try {
    created = await stripe.subscriptions.create(params, {
      idempotencyKey: deskTrialIdempotencyKey(userId, length.days),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Stripe could not start the trial." };
  }

  const trialEnd =
    created.status === "trialing" && created.trial_end
      ? new Date(created.trial_end * 1000)
      : keptPeriod(
          created.current_period_end
            ? new Date(created.current_period_end * 1000)
            : created.items.data[0]?.current_period_end
              ? new Date(created.items.data[0].current_period_end * 1000)
              : null,
        );
  await upsertSubscription({
    userId,
    customerId,
    subscriptionId: created.id,
    status: created.status,
    priceId,
    periodEnd: trialEnd,
  });
  await log(
    actor,
    userId,
    "desk_trial",
    {
      trialDays: length.days,
      interval: input.interval,
      priceId,
      subscriptionId: created.id,
      status: created.status,
    },
    note,
  );
  const until = trialEnd ? trialEnd.toISOString().slice(0, 10) : "the Stripe trial end";
  return {
    ok: true,
    message: `Started a ${length.days}-day Individual Unlimited trial for ${targetEmail}. No card today. It ends ${until} unless they add a card. Stripe will charge ${input.interval === "year" ? "yearly" : "monthly"} if they stay.`,
  };
}

export async function deleteOpsAccount(
  actor: OpsActor,
  input: {
    userId: string;
    email?: string;
    actorPassword: string;
    note?: string;
  },
): Promise<OpsWriteResult> {
  const passwordErr = opsDeletePasswordMissing(input.actorPassword);
  if (passwordErr) return { ok: false, error: passwordErr };
  const target = await resolveTarget(input.userId, input.email);
  if (!target) return { ok: false, error: "No person with that id or email." };
  const userId = target.id;
  const targetEmail = target.email;
  const blocked = opsDeleteBlockReason({
    actorId: actor.id,
    actorEmail: actor.email,
    targetId: userId,
    targetEmail,
    owners: ownerEmails(),
  });
  if (blocked) return { ok: false, error: blocked };
  if (input.email && targetEmail && !emailsMatch(input.email, targetEmail)) {
    return { ok: false, error: "That row no longer matches this email. Refresh the desk." };
  }
  const auth = await verifyOpsDeskPassword(actor.id, input.actorPassword);
  if (!auth.ok) return auth;
  await log(
    actor,
    userId,
    "delete_account",
    { confirmEmail: targetEmail },
    input.note,
  );
  try {
    await wipeUserRows(userId);
    const sql = await getSql();
    await sql
      .query(`delete from mach_user_activity where user_id = $1`, [userId])
      .catch(() => undefined);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Delete failed after it was logged.",
    };
  }
  return {
    ok: true,
    message: `Deleted ${targetEmail}. Login, plans, and Stripe seat are gone.`,
  };
}

async function userExists(userId: string): Promise<boolean> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(`select id from "user" where id = $1 limit 1`, [
      userId,
    ]);
    return Boolean(rows[0]);
  } catch {
    return false;
  }
}
