import { getSql } from "@/lib/db";
import { paidFromStatus } from "./limits";
import { ensureSubscriptionsTable } from "./schema.server";

type StripeClient = {
  webhooks: {
    constructEvent: (payload: string, sig: string, secret: string) => StripeEvent;
  };
  checkout: { sessions: { create: (args: Record<string, unknown>) => Promise<{ url?: string | null; customer?: unknown; subscription?: unknown; metadata?: Record<string, string>; client_reference_id?: string | null }> } };
  billingPortal: { sessions: { create: (args: Record<string, unknown>) => Promise<{ url: string }> } };
  subscriptions: {
    retrieve: (id: string) => Promise<StripeSubscription>;
    update: (id: string, args: Record<string, unknown>) => Promise<StripeSubscription>;
  };
};

type StripeEvent = { type: string; data: { object: Record<string, unknown> } };

type StripeSubscription = {
  id: string;
  status: string;
  customer: string | { id: string };
  metadata?: Record<string, string>;
  current_period_end?: number;
  items: { data: Array<{ id?: string; price: { id: string }; current_period_end?: number }> };
};

type StripeCheckoutSession = {
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
  subscription?: string | { id: string } | null;
  customer?: string | { id: string } | null;
};

export function stripeConfigured(): boolean {
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

export function advisorStripeConfigured(): boolean {
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

export function unlimitedStripeConfigured(): boolean {
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

export function advisorUnlimitedStripeConfigured(): boolean {
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

export async function getStripe(): Promise<StripeClient> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured.");
  const mod = (await import("stripe")) as unknown as { default: new (k: string) => StripeClient };
  return new mod.default(key);
}

export function priceIdFor(
  interval: "month" | "year",
  pkg: "individual" | "unlimited" | "advisor" | "advisor_lite" = "individual",
): string {
  const id =
    pkg === "advisor"
      ? interval === "year"
        ? process.env.STRIPE_PRICE_ADVISOR_UNLIMITED_YEARLY
        : process.env.STRIPE_PRICE_ADVISOR_UNLIMITED_MONTHLY
      : pkg === "advisor_lite"
        ? interval === "year"
          ? process.env.STRIPE_PRICE_ADVISOR_YEARLY
          : process.env.STRIPE_PRICE_ADVISOR_MONTHLY
        : pkg === "unlimited"
          ? interval === "year"
            ? process.env.STRIPE_PRICE_UNLIMITED_YEARLY
            : process.env.STRIPE_PRICE_UNLIMITED_MONTHLY
          : interval === "year"
            ? process.env.STRIPE_PRICE_YEARLY
            : process.env.STRIPE_PRICE_MONTHLY;
  if (!id) {
    throw new Error(
      pkg === "advisor"
        ? "Advisor Unlimited Stripe prices are not configured yet."
        : pkg === "advisor_lite"
          ? "Advisor Lite Stripe prices are not configured yet."
          : pkg === "unlimited"
            ? "Individual Unlimited Stripe prices are not configured yet."
            : "Stripe prices are not configured.",
    );
  }
  return id;
}

export function packageFromPriceId(
  priceId: string | null | undefined,
): "individual" | "unlimited" | "advisor" | "advisor_lite" | null {
  if (!priceId) return null;
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
    if (
      priceId === process.env.STRIPE_PRICE_MONTHLY ||
      priceId === process.env.STRIPE_PRICE_YEARLY
    ) {
      return "individual";
    }
  } catch {
    /* env missing */
  }
  return null;
}

function periodEndOf(sub: StripeSubscription): Date | null {
  const ts = sub.current_period_end ?? sub.items.data[0]?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

export async function upsertSubscription(row: {
  userId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  status: string;
  priceId?: string | null;
  periodEnd?: Date | null;
}) {
  await ensureSubscriptionsTable();
  const sql = await getSql();
  await sql.query(
    `insert into mach_subscriptions
       (user_id, stripe_customer_id, stripe_subscription_id, status, price_id, current_period_end, updated_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (user_id) do update set
       stripe_customer_id = coalesce(excluded.stripe_customer_id, mach_subscriptions.stripe_customer_id),
       stripe_subscription_id = coalesce(excluded.stripe_subscription_id, mach_subscriptions.stripe_subscription_id),
       status = excluded.status,
       price_id = coalesce(excluded.price_id, mach_subscriptions.price_id),
       current_period_end = coalesce(excluded.current_period_end, mach_subscriptions.current_period_end),
       updated_at = now()`,
    [
      row.userId,
      row.customerId ?? null,
      row.subscriptionId ?? null,
      row.status,
      row.priceId ?? null,
      row.periodEnd ?? null,
    ],
  );
}

export async function userIdForCustomer(customerId: string): Promise<string | null> {
  try {
    await ensureSubscriptionsTable();
    const sql = await getSql();
    const rows = await sql<{ user_id: string }>`
      select user_id from mach_subscriptions where stripe_customer_id = ${customerId} limit 1
    `;
    return rows[0]?.user_id ?? null;
  } catch {
    return null;
  }
}

export async function clearSubscription(userId: string): Promise<void> {
  try {
    await ensureSubscriptionsTable();
    const sql = await getSql();
    await sql.query(
      `update mach_subscriptions
          set stripe_customer_id = null,
              stripe_subscription_id = null,
              status = 'none',
              price_id = null,
              current_period_end = null,
              updated_at = now()
        where user_id = $1`,
      [userId],
    );
  } catch {
    /* table missing — nothing to clear */
  }
}

/** Drop a test-mode customer/sub that does not exist on the current Stripe key. */
export async function dropIfUnknownToStripe(
  userId: string,
  row: {
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  } | null,
): Promise<boolean> {
  const subId = row?.stripe_subscription_id;
  const cusId = row?.stripe_customer_id;
  if (!subId && !cusId) return false;
  try {
    const stripe = await getStripe();
    if (subId) await stripe.subscriptions.retrieve(subId);
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/No such (customer|subscription)/i.test(msg)) return false;
    await clearSubscription(userId);
    return true;
  }
}

/**
 * Same Stripe subscription, new price. Unused time on the old plan is credited
 * against unused time on the new plan so the card is only charged the difference.
 */
export async function startProratedPlanChange(opts: {
  customerId: string;
  subscriptionId: string;
  newPriceId: string;
  userId: string;
  pkg: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = await getStripe();
  const sub = await stripe.subscriptions.retrieve(opts.subscriptionId);
  const itemId = sub.items.data[0]?.id;
  if (!itemId) throw new Error("That subscription has no item to update.");
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: opts.customerId,
      return_url: opts.returnUrl,
      flow_data: {
        type: "subscription_update_confirm",
        subscription_update_confirm: {
          subscription: opts.subscriptionId,
          items: [{ id: itemId, price: opts.newPriceId, quantity: 1 }],
        },
      },
    });
    return { url: portal.url };
  } catch {
    await stripe.subscriptions.update(opts.subscriptionId, {
      items: [{ id: itemId, price: opts.newPriceId }],
      proration_behavior: "always_invoice",
      payment_behavior: "error_if_incomplete",
      metadata: {
        ...(sub.metadata ?? {}),
        userId: opts.userId,
        package: opts.pkg,
      },
    });
    return { url: opts.returnUrl };
  }
}

export async function loadSubscription(userId: string) {
  try {
    await ensureSubscriptionsTable();
    const sql = await getSql();
    const rows = await sql<{
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      status: string;
      price_id: string | null;
      current_period_end: string | Date | null;
    }>`
      select stripe_customer_id, stripe_subscription_id, status, price_id, current_period_end
      from mach_subscriptions
      where user_id = ${userId}
      limit 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export function isPaidRow(status: string | null | undefined): boolean {
  return paidFromStatus(status);
}

export async function applyStripeEvent(event: StripeEvent): Promise<void> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as StripeCheckoutSession;
    const userId =
      (session.client_reference_id || session.metadata?.userId || "").trim();
    if (!userId) return;
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    let status = "active";
    let priceId: string | null = null;
    let periodEnd: Date | null = null;
    if (subId) {
      const stripe = await getStripe();
      const sub = await stripe.subscriptions.retrieve(subId);
      status = sub.status;
      priceId = sub.items.data[0]?.price.id ?? null;
      periodEnd = periodEndOf(sub);
    }
    const customer = session.customer;
    await upsertSubscription({
      userId,
      customerId: typeof customer === "string" ? customer : customer?.id,
      subscriptionId: subId,
      status,
      priceId,
      periodEnd,
    });
    return;
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.created"
  ) {
    const sub = event.data.object as unknown as StripeSubscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const userId =
      (sub.metadata?.userId || "").trim() || (await userIdForCustomer(customerId));
    if (!userId) return;
    await upsertSubscription({
      userId,
      customerId,
      subscriptionId: sub.id,
      status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
      priceId: sub.items.data[0]?.price.id ?? null,
      periodEnd: periodEndOf(sub),
    });
  }
}
