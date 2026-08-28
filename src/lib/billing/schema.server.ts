import { getSql } from "@/lib/db";

/** Best-effort: create the paywall table if deploy skipped the migration. Never throw. */
export async function ensureSubscriptionsTable(): Promise<boolean> {
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
