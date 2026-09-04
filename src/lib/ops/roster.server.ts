import { labelForProviderId, isCredentialProvider } from "@/lib/auth/delete-account";
import {
  intervalFromPrice,
  packageFromPrice,
} from "@/lib/billing/api";
import { packageLabel, paidFromStatus, type MachPackage } from "@/lib/billing/limits";
import { getSql } from "@/lib/db";
import {
  EMPTY_OPS_COUNTS,
  OPS_ROSTER_PAGE,
  type OpsRosterCounts,
  type OpsRosterQuery,
  type OpsRosterResult,
  type OpsRosterRow,
} from "./roster";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: Date | string | null;
};

type SubRow = {
  user_id: string;
  status: string | null;
  price_id: string | null;
  current_period_end: Date | string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  advisor_grant: boolean | null;
};

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return value.toISOString();
  } catch {
    return null;
  }
}

function stripeDashBase(): string {
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  return key.startsWith("sk_test_")
    ? "https://dashboard.stripe.com/test"
    : "https://dashboard.stripe.com";
}

function stripeUrls(customerId: string | null, subscriptionId: string | null) {
  const base = stripeDashBase();
  return {
    stripeCustomerUrl: customerId ? `${base}/customers/${encodeURIComponent(customerId)}` : null,
    stripeSubscriptionUrl: subscriptionId
      ? `${base}/subscriptions/${encodeURIComponent(subscriptionId)}`
      : null,
  };
}

function authHintFrom(providers: string[]): string {
  const labels: string[] = [];
  let email = false;
  for (const raw of providers) {
    if (isCredentialProvider(raw)) {
      email = true;
      continue;
    }
    const label = labelForProviderId(raw);
    if (label && !labels.includes(label)) labels.push(label);
  }
  if (email) labels.unshift("Email");
  return labels.length ? labels.join(" · ") : "—";
}

function toRow(
  user: UserRow,
  sub: SubRow | undefined,
  providers: string[],
): OpsRosterRow {
  const status = (sub?.status ?? "none").trim() || "none";
  const paid = paidFromStatus(status);
  const billed = packageFromPrice(sub?.price_id, paid);
  const plan: MachPackage = paid && sub?.advisor_grant ? "advisor" : billed;
  const periodEnd = iso(sub?.current_period_end);
  const customerId = sub?.stripe_customer_id ?? null;
  const subscriptionId = sub?.stripe_subscription_id ?? null;
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    createdAt: iso(user.createdAt),
    authHint: authHintFrom(providers),
    plan,
    packageLabel: packageLabel(plan),
    interval: intervalFromPrice(sub?.price_id, paid),
    status,
    periodEnd,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    ...stripeUrls(customerId, subscriptionId),
    isComp: paid && !subscriptionId,
  };
}

function matchesQuery(row: OpsRosterRow, query: OpsRosterQuery): boolean {
  const needle = (query.q ?? "").trim().toLowerCase();
  if (needle) {
    const hay = `${row.email ?? ""} ${row.name ?? ""}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  if (query.plan && query.plan !== "all" && row.plan !== query.plan) return false;
  if (query.paid === "paid" && !paidFromStatus(row.status)) return false;
  if (query.paid === "free" && paidFromStatus(row.status)) return false;
  if (query.status && query.status !== "all") {
    const st = (row.status || "none").toLowerCase();
    if (query.status === "none") {
      if (st !== "none" && st !== "") return false;
    } else if (st !== query.status) {
      return false;
    }
  }
  return true;
}

function countRows(rows: OpsRosterRow[]): OpsRosterCounts {
  const counts = { ...EMPTY_OPS_COUNTS };
  for (const row of rows) {
    counts[row.plan] += 1;
    if (row.status === "trialing") counts.trialing += 1;
    if (row.status === "past_due") counts.past_due += 1;
  }
  return counts;
}

export async function loadOpsRoster(query: OpsRosterQuery): Promise<OpsRosterResult> {
  const offset = Math.max(0, Number(query.offset) || 0);
  try {
    const sql = await getSql();
    const users = await sql.query<UserRow>(
      `select id, email, name, "createdAt" as "createdAt" from "user" order by "createdAt" desc nulls last`,
    );
    let subs: SubRow[] = [];
    try {
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
      await sql.query(
        `alter table mach_subscriptions add column if not exists advisor_grant boolean not null default false`,
      );
      subs = await sql.query<SubRow>(
        `select user_id, status, price_id, current_period_end, stripe_customer_id, stripe_subscription_id, advisor_grant
         from mach_subscriptions`,
      );
    } catch {
      subs = [];
    }
    const subByUser = new Map(subs.map((s) => [s.user_id, s]));
    const providersByUser = new Map<string, string[]>();
    try {
      const accounts = await sql.query<{ userId: string; providerId: string }>(
        `select "userId" as "userId", "providerId" as "providerId" from "account"`,
      );
      for (const row of accounts) {
        const list = providersByUser.get(row.userId) ?? [];
        list.push(row.providerId);
        providersByUser.set(row.userId, list);
      }
    } catch {
      /* account table optional for the list */
    }
    const mapped = users.map((user) =>
      toRow(user, subByUser.get(user.id), providersByUser.get(user.id) ?? []),
    );
    const filtered = mapped.filter((row) => matchesQuery(row, query));
    return {
      allowed: true,
      rows: filtered.slice(offset, offset + OPS_ROSTER_PAGE),
      total: filtered.length,
      offset,
      counts: countRows(mapped),
      error: null,
    };
  } catch {
    return {
      allowed: true,
      rows: [],
      total: 0,
      offset,
      counts: { ...EMPTY_OPS_COUNTS },
      error: "Roster is unavailable.",
    };
  }
}
