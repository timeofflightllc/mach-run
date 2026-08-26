import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  FREE_ACCOUNT_LIMIT,
  FREE_CONTRIBUTION_LIMIT,
  FREE_INCOME_LIMIT,
  GUEST_ENTITLEMENT,
  addCap,
  clampPlan,
  paidFromStatus,
  type Entitlement,
} from "./limits";
import { ensurePlan } from "@/lib/plan/defaults";
import type { Plan } from "@/lib/plan/types";

type SubRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  price_id: string | null;
  current_period_end: string | Date | null;
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

function signedInFree(): Entitlement {
  return {
    ...GUEST_ENTITLEMENT,
    signedIn: true,
    stripeConfigured: stripeReady(),
    status: "none",
  };
}

async function loadSubscription(userId: string): Promise<SubRow | null> {
  try {
    await ensureSubscriptionsTable();
    const sql = await getSql();
    const rows = await sql<SubRow>`
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

export const getBillingConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      return { stripeConfigured: stripeReady(), monthly: 4, yearly: 40 };
    } catch {
      return { stripeConfigured: false, monthly: 4, yearly: 40 };
    }
  },
);

export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Entitlement> => {
    try {
      const row = await loadSubscription(context.userId);
      const paid = paidFromStatus(row?.status);
      const periodEnd =
        row?.current_period_end == null
          ? null
          : typeof row.current_period_end === "string"
            ? row.current_period_end
            : row.current_period_end.toISOString();
      return {
        signedIn: true,
        paid,
        plan: paid ? "mach" : "free",
        accountLimit: paid ? null : FREE_ACCOUNT_LIMIT,
        contributionLimit: paid ? null : FREE_CONTRIBUTION_LIMIT,
        incomeLimit: paid ? null : FREE_INCOME_LIMIT,
        stripeConfigured: stripeReady(),
        status: row?.status ?? "none",
        periodEnd,
      };
    } catch {
      return signedInFree();
    }
  });

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { interval: "month" | "year"; origin: string }) => input)
  .handler(async ({ context, data }) => {
    const { getStripe, priceIdFor, stripeConfigured } = await import("./stripe.server");
    if (!stripeConfigured()) {
      throw new Error(
        "Stripe is not connected yet. Add the keys after you publish.",
      );
    }
    const origin = sanitizeOrigin(data.origin);
    const stripe = await getStripe();
    const existing = await loadSubscription(context.userId);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceIdFor(data.interval), quantity: 1 }],
      success_url: `${origin}/pricing?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
      client_reference_id: context.userId,
      metadata: { userId: context.userId },
      subscription_data: { metadata: { userId: context.userId } },
      customer: existing?.stripe_customer_id || undefined,
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
    const session = await stripe.billingPortal.sessions.create({
      customer: existing.stripe_customer_id,
      return_url: `${origin}/pricing`,
    });
    return { url: session.url };
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
