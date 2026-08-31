import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  ADVISOR_TRIAL_DAYS,
  FREE_ACCOUNT_LIMIT,
  FREE_CONTRIBUTION_LIMIT,
  FREE_INCOME_LIMIT,
  GUEST_ENTITLEMENT,
  addCap,
  clampPlan,
  paidFromStatus,
  planChangePath,
  profileLimitFor,
  trialDaysForCode,
  normalizePromoCode,
  type Entitlement,
  type MachPackage,
} from "./limits";
import { ensurePlan } from "@/lib/plan/defaults";
import type { Plan } from "@/lib/plan/types";

type SubRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  price_id: string | null;
  current_period_end: string | Date | null;
  advisor_grant?: boolean | null;
};

async function ensureSubscriptionsTable(): Promise<boolean> {
  try {
    const sql = await getSql();
    await sql.query(`
      create table if not exists mach_subscriptions (
        user_id text primary key,
        stripe_customer_id text,
        stripe_subscription_id text,
        status text not null default 'none',
        price_id text,
        current_period_end timestamptz,
        updated_at timestamptz not null default now()
      )
    `);
    await sql.query(`
      create index if not exists mach_subscriptions_customer_idx
        on mach_subscriptions (stripe_customer_id)
    `);
    await sql.query(`
      alter table mach_subscriptions
        add column if not exists advisor_grant boolean not null default false
    `);
    return true;
  } catch {
    return false;
  }
}

function stripeReady(): boolean {
  try {
    return Boolean(
      process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_PRICE_MONTHLY &&
        process.env.STRIPE_PRICE_YEARLY,
    );
  } catch {
    return false;
  }
}

function advisorStripeReady(): boolean {
  try {
    return Boolean(
      process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_PRICE_ADVISOR_MONTHLY &&
        process.env.STRIPE_PRICE_ADVISOR_YEARLY,
    );
  } catch {
    return false;
  }
}

function unlimitedStripeReady(): boolean {
  try {
    return Boolean(
      process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_PRICE_UNLIMITED_MONTHLY &&
        process.env.STRIPE_PRICE_UNLIMITED_YEARLY,
    );
  } catch {
    return false;
  }
}

function advisorUnlimitedStripeReady(): boolean {
  try {
    return Boolean(
      process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_PRICE_ADVISOR_UNLIMITED_MONTHLY &&
        process.env.STRIPE_PRICE_ADVISOR_UNLIMITED_YEARLY,
    );
  } catch {
    return false;
  }
}

function intervalFromPrice(priceId: string | null | undefined, paid: boolean): "month" | "year" | null {
  if (!paid) return null;
  try {
    if (
      priceId === process.env.STRIPE_PRICE_YEARLY ||
      priceId === process.env.STRIPE_PRICE_ADVISOR_YEARLY ||
      priceId === process.env.STRIPE_PRICE_ADVISOR_UNLIMITED_YEARLY ||
      priceId === process.env.STRIPE_PRICE_UNLIMITED_YEARLY
    ) {
      return "year";
    }
    if (
      priceId === process.env.STRIPE_PRICE_MONTHLY ||
      priceId === process.env.STRIPE_PRICE_ADVISOR_MONTHLY ||
      priceId === process.env.STRIPE_PRICE_ADVISOR_UNLIMITED_MONTHLY ||
      priceId === process.env.STRIPE_PRICE_UNLIMITED_MONTHLY
    ) {
      return "month";
    }
  } catch {
    /* env missing */
  }
  return "month";
}

function packageFromPrice(priceId: string | null | undefined, paid: boolean): MachPackage {
  if (!paid) return "free";
  try {
    if (
      priceId === process.env.STRIPE_PRICE_ADVISOR_UNLIMITED_MONTHLY ||
      priceId === process.env.STRIPE_PRICE_ADVISOR_UNLIMITED_YEARLY
    ) {
      return "advisor";
    }
    if (
      priceId === process.env.STRIPE_PRICE_ADVISOR_MONTHLY ||
      priceId === process.env.STRIPE_PRICE_ADVISOR_YEARLY
    ) {
      return "advisor_lite";
    }
    if (
      priceId === process.env.STRIPE_PRICE_UNLIMITED_MONTHLY ||
      priceId === process.env.STRIPE_PRICE_UNLIMITED_YEARLY
    ) {
      return "unlimited";
    }
  } catch {
    /* env missing */
  }
  return "individual";
}

function signedInFree(): Entitlement {
  return {
    ...GUEST_ENTITLEMENT,
    signedIn: true,
    stripeConfigured: stripeReady(),
    advisorStripeConfigured: advisorStripeReady(),
    unlimitedStripeConfigured: unlimitedStripeReady(),
    advisorUnlimitedStripeConfigured: advisorUnlimitedStripeReady(),
    status: "none",
  };
}

async function loadSubscription(userId: string): Promise<SubRow | null> {
  try {
    await ensureSubscriptionsTable();
    const sql = await getSql();
    const rows = await sql<SubRow>`
      select stripe_customer_id, stripe_subscription_id, status, price_id, current_period_end, advisor_grant
      from mach_subscriptions
      where user_id = ${userId}
      limit 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export const getBillingConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      return { stripeConfigured: stripeReady(), advisorStripeConfigured: advisorStripeReady(), unlimitedStripeConfigured: unlimitedStripeReady(), advisorUnlimitedStripeConfigured: advisorUnlimitedStripeReady(), monthly: 4, yearly: 40 };
    } catch {
      return { stripeConfigured: false, advisorStripeConfigured: false, unlimitedStripeConfigured: false, advisorUnlimitedStripeConfigured: false, monthly: 4, yearly: 40 };
    }
  },
);

export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Entitlement> => {
    try {
      const row = await loadSubscription(context.userId);
      if (row && stripeReady()) {
        const { dropIfUnknownToStripe } = await import("./stripe.server");
        const dropped = await dropIfUnknownToStripe(context.userId, row);
        if (dropped) return signedInFree();
      }
      const paid = paidFromStatus(row?.status);
      const billed = packageFromPrice(row?.price_id, paid);
      const plan: MachPackage =
        paid && row?.advisor_grant ? "advisor" : billed;
      const periodEnd =
        row?.current_period_end == null
          ? null
          : typeof row.current_period_end === "string"
            ? row.current_period_end
            : row.current_period_end.toISOString();
      return {
        signedIn: true,
        paid,
        plan,
        billed,
        interval: intervalFromPrice(row?.price_id, paid),
        accountLimit: paid ? null : FREE_ACCOUNT_LIMIT,
        contributionLimit: paid ? null : FREE_CONTRIBUTION_LIMIT,
        incomeLimit: paid ? null : FREE_INCOME_LIMIT,
        profileLimit: profileLimitFor(plan),
        stripeConfigured: stripeReady(),
        advisorStripeConfigured: advisorStripeReady(),
        unlimitedStripeConfigured: unlimitedStripeReady(),
        advisorUnlimitedStripeConfigured: advisorUnlimitedStripeReady(),
        status: row?.status ?? "none",
        periodEnd,
      };
    } catch {
      return signedInFree();
    }
  });

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      interval: "month" | "year";
      origin: string;
      package?: "individual" | "unlimited" | "advisor" | "advisor_lite";
      trialCode?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { getStripe, priceIdFor, stripeConfigured, advisorStripeConfigured, unlimitedStripeConfigured, advisorUnlimitedStripeConfigured } =
      await import("./stripe.server");
    const pkg =
      data.package === "advisor"
        ? "advisor"
        : data.package === "advisor_lite"
          ? "advisor_lite"
          : data.package === "unlimited"
            ? "unlimited"
            : "individual";
    if (pkg === "advisor") {
      if (!advisorUnlimitedStripeConfigured()) {
        throw new Error(
          "Advisor Unlimited checkout is not connected yet. Add STRIPE_PRICE_ADVISOR_UNLIMITED_MONTHLY and STRIPE_PRICE_ADVISOR_UNLIMITED_YEARLY in Vercel.",
        );
      }
    } else if (pkg === "advisor_lite") {
      if (!advisorStripeConfigured()) {
        throw new Error(
          "Advisor Lite checkout is not connected yet. Add STRIPE_PRICE_ADVISOR_MONTHLY and STRIPE_PRICE_ADVISOR_YEARLY in Vercel.",
        );
      }
    } else if (pkg === "unlimited") {
      if (!unlimitedStripeConfigured()) {
        throw new Error(
          "Individual Unlimited checkout is not connected yet. Add STRIPE_PRICE_UNLIMITED_MONTHLY and STRIPE_PRICE_UNLIMITED_YEARLY in Vercel.",
        );
      }
    } else if (!stripeConfigured()) {
      throw new Error(
        "Stripe is not connected yet. Add the keys after you publish.",
      );
    }
    const origin = sanitizeOrigin(data.origin);
    const stripe = await getStripe();
    const existing = await loadSubscription(context.userId);
    const { dropIfUnknownToStripe, startProratedPlanChange } = await import("./stripe.server");
    const dropped = await dropIfUnknownToStripe(context.userId, existing);
    const targetPriceId = priceIdFor(data.interval, pkg);
    const change = dropped
      ? "checkout"
      : planChangePath(existing, targetPriceId);
    if (change === "already") {
      return { url: `${origin}/?checkout=success` };
    }
    if (change === "prorate" && existing?.stripe_customer_id && existing.stripe_subscription_id) {
      return startProratedPlanChange({
        customerId: existing.stripe_customer_id,
        subscriptionId: existing.stripe_subscription_id,
        newPriceId: targetPriceId,
        userId: context.userId,
        pkg,
        returnUrl: `${origin}/?checkout=success`,
      });
    }
    const promoTrialDays = trialDaysForCode(data.trialCode);
    const trialDays = promoTrialDays ?? (pkg === "advisor_lite" ? ADVISOR_TRIAL_DAYS : null);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceIdFor(data.interval, pkg), quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
      client_reference_id: context.userId,
      metadata: {
        userId: context.userId,
        package: pkg,
        ...(promoTrialDays ? { trialCode: normalizePromoCode(data.trialCode) } : {}),
      },
      subscription_data: {
        metadata: {
          userId: context.userId,
          package: pkg,
          ...(promoTrialDays ? { trialCode: normalizePromoCode(data.trialCode) } : {}),
        },
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
      customer: dropped ? undefined : existing?.stripe_customer_id || undefined,
      allow_promotion_codes: true,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { url: session.url };
  });

export const startBillingPortal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { origin: string }) => input)
  .handler(async ({ context, data }) => {
    const { getStripe, stripeConfigured } = await import("./stripe.server");
    if (!stripeConfigured()) throw new Error("Stripe is not connected yet.");
    const existing = await loadSubscription(context.userId);
    if (!existing?.stripe_customer_id) {
      throw new Error("No Stripe customer on this account yet.");
    }
    const origin = sanitizeOrigin(data.origin);
    const stripe = await getStripe();
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: existing.stripe_customer_id,
        return_url: `${origin}/`,
      });
      return { url: session.url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/No such customer/i.test(msg)) {
        const { clearSubscription } = await import("./stripe.server");
        await clearSubscription(context.userId);
        throw new Error(
          "That billing profile was from Stripe test mode. Refresh, then subscribe with a live card.",
        );
      }
      throw err;
    }
  });

export async function clampPlanForUser(userId: string, plan: Plan): Promise<Plan> {
  const clean = ensurePlan(plan);
  try {
    const row = await loadSubscription(userId);
    if (paidFromStatus(row?.status)) return clean;
  } catch {
    // missing table / stripe / db — treat as free
  }
  let existingPorts = 0;
  let existingRules = 0;
  let existingIncomes = 0;
  try {
    const sql = await getSql();
    const saved = await sql<{ plan_json: unknown }>`
      select plan_json from mach_plans where user_id = ${userId} limit 1
    `;
    const raw = saved[0]?.plan_json;
    const parsed =
      raw == null
        ? null
        : typeof raw === "string"
          ? (JSON.parse(raw) as Plan)
          : (raw as Plan);
    existingPorts = Array.isArray(parsed?.portfolios) ? parsed.portfolios.length : 0;
    existingRules = Array.isArray(parsed?.contributions)
      ? parsed.contributions.length
      : 0;
    existingIncomes = Array.isArray(parsed?.incomes) ? parsed.incomes.length : 0;
  } catch {
    existingPorts = clean.portfolios.length;
    existingRules = clean.contributions.length;
    existingIncomes = (clean.incomes ?? []).length;
  }
  return clampPlan(
    clean,
    addCap(existingPorts, false, FREE_ACCOUNT_LIMIT),
    addCap(existingRules, false, FREE_CONTRIBUTION_LIMIT),
    addCap(existingIncomes, false, FREE_INCOME_LIMIT),
  );
}

function sanitizeOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad");
    return u.origin;
  } catch {
    return "http://127.0.0.1:8080";
  }
}

export { GUEST_ENTITLEMENT };
