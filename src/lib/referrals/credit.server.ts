import { getSql } from "@/lib/db";
import {
  DEFAULT_CREDIT_DOLLARS,
  REFERRAL_CREDIT_DESCRIPTION,
  parseCreditDollars,
  referralCreditKey,
} from "./credit";

async function ensureCreditSettings(): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `create table if not exists mach_referral_settings (
       id integer primary key,
       credit_dollars integer not null default 20
     )`,
  );
  await sql.query(
    `insert into mach_referral_settings (id, credit_dollars)
     values (1, $1)
     on conflict (id) do nothing`,
    [DEFAULT_CREDIT_DOLLARS],
  );
  await sql.query(`alter table mach_referral_signups add column if not exists credit_cents integer`);
  await sql.query(
    `alter table mach_referral_signups add column if not exists credit_posted_at timestamptz`,
  );
}

export async function referralCreditDollars(): Promise<number> {
  await ensureCreditSettings();
  const sql = await getSql();
  const rows = await sql.query<{ credit_dollars: number }>(
    `select credit_dollars from mach_referral_settings where id = 1`,
  );
  const parsed = parseCreditDollars(rows[0]?.credit_dollars);
  return parsed ?? DEFAULT_CREDIT_DOLLARS;
}

/** Future credits only. Rows that already have an amount stay as they are. */
export async function setReferralCreditDollars(dollars: number): Promise<void> {
  const parsed = parseCreditDollars(dollars);
  if (parsed == null) throw new Error("Enter a whole dollar amount from 0 to 1000.");
  await ensureCreditSettings();
  const sql = await getSql();
  await sql.query(
    `update mach_referral_settings set credit_dollars = $1 where id = 1`,
    [parsed],
  );
}

async function customerIdFor(userId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql.query<{ stripe_customer_id: string | null }>(
    `select stripe_customer_id from mach_subscriptions where user_id = $1 limit 1`,
    [userId],
  );
  const id = rows[0]?.stripe_customer_id?.trim();
  return id || null;
}

async function postOneCredit(signupId: string, ownerId: string, cents: number): Promise<void> {
  if (cents <= 0) {
    const sql = await getSql();
    await sql.query(
      `update mach_referral_signups
       set credit_posted_at = coalesce(credit_posted_at, now())
       where id = $1`,
      [signupId],
    );
    return;
  }
  const customerId = await customerIdFor(ownerId);
  if (!customerId) return;
  const { getStripe } = await import("@/lib/billing/stripe.server");
  const stripe = await getStripe();
  await stripe.customers.createBalanceTransaction(
    customerId,
    {
      amount: -cents,
      currency: "usd",
      description: REFERRAL_CREDIT_DESCRIPTION,
    },
    { idempotencyKey: referralCreditKey(signupId) },
  );
  const sql = await getSql();
  await sql.query(
    `update mach_referral_signups
     set credit_posted_at = coalesce(credit_posted_at, now())
     where id = $1`,
    [signupId],
  );
}

/**
 * After a personal yearly extension has succeeded. Records the current dollar
 * setting on this row only. Posts it to the sender's Stripe balance, or holds
 * it until that sender has a customer.
 */
export async function grantReferralCredit(signupId: string): Promise<void> {
  await ensureCreditSettings();
  const dollars = await referralCreditDollars();
  const cents = dollars * 100;
  const sql = await getSql();
  const claimed = await sql.query<{ id: string; owner_user_id: string }>(
    `update mach_referral_signups s
     set credit_cents = $2
     from mach_referral_codes c
     where s.code = c.code
       and c.kind = 'personal'
       and s.id = $1
       and s.status = 'yearly'
       and s.credit_cents is null
     returning s.id, c.owner_user_id`,
    [signupId, cents],
  );
  const row = claimed[0];
  if (!row) return;
  try {
    await postOneCredit(row.id, row.owner_user_id, cents);
  } catch (err) {
    console.warn("[referral] credit is held:", err instanceof Error ? err.message : err);
  }
}

/** Post every held credit for this sender. A retry uses the same Stripe key. */
export async function flushHeldReferralCredits(userId: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql.query<{ id: string; credit_cents: number }>(
    `select s.id, s.credit_cents
     from mach_referral_signups s
     join mach_referral_codes c on c.code = s.code
     where c.owner_user_id = $1
       and c.kind = 'personal'
       and s.credit_cents > 0
       and s.credit_posted_at is null`,
    [userId],
  );
  for (const row of rows) {
    try {
      await postOneCredit(row.id, userId, Number(row.credit_cents));
    } catch (err) {
      console.warn("[referral] held credit stayed held:", err instanceof Error ? err.message : err);
    }
  }
}

/** A campaign signup can count as yearly. It never receives a credit. */
export async function noteCampaignYearly(userId: string): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `update mach_referral_signups s
     set status = 'yearly'
     from mach_referral_codes c
     where s.code = c.code
       and c.kind = 'campaign'
       and s.new_user_id = $1
       and s.status = 'signed-up'`,
    [userId],
  );
}
