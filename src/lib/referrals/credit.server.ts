import { getSql } from "@/lib/db";
import {
  DEFAULT_CREDIT_POINTS,
  centsFromPoints,
  parseCreditPoints,
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
     values (1, 20)
     on conflict (id) do nothing`,
  );
  await sql.query(`alter table mach_referral_settings add column if not exists credit_points integer`);
  await sql.query(
    `update mach_referral_settings
     set credit_points = credit_dollars * 10
     where credit_points is null
       and credit_dollars is not null`,
  );
  await sql.query(`alter table mach_referral_signups add column if not exists credit_cents integer`);
  await sql.query(
    `alter table mach_referral_signups add column if not exists credit_posted_at timestamptz`,
  );
}

export async function referralCreditPoints(): Promise<number> {
  await ensureCreditSettings();
  const sql = await getSql();
  const rows = await sql.query<{ credit_points: number | null }>(
    `select credit_points from mach_referral_settings where id = 1`,
  );
  const parsed = parseCreditPoints(rows[0]?.credit_points);
  return parsed ?? DEFAULT_CREDIT_POINTS;
}

/** Future referrals only. Rows that already have cents stay as they are. */
export async function setReferralCreditPoints(points: number): Promise<void> {
  const parsed = parseCreditPoints(points);
  if (parsed == null) throw new Error("Enter a whole number of points from 0 to 10000.");
  await ensureCreditSettings();
  const sql = await getSql();
  await sql.query(
    `update mach_referral_settings set credit_points = $1 where id = 1`,
    [parsed],
  );
}

/**
 * After a personal yearly extension has succeeded. Records the current point
 * setting on this row, then grants those Mach Rewards points. It does not
 * post a Stripe credit. A campaign code never reaches this update.
 */
export async function grantReferralCredit(signupId: string): Promise<void> {
  await ensureCreditSettings();
  const points = await referralCreditPoints();
  const cents = centsFromPoints(points);
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
  if (!row || points <= 0) return;
  const { grantRewardPoints } = await import("@/lib/rewards/grant.server");
  await grantRewardPoints({
    userId: row.owner_user_id,
    source: "referral",
    sourceId: row.id,
    points,
  });
}

/** Kept for the billing call sites. Points are not posted to Stripe from here. */
export async function flushHeldReferralCredits(_userId: string): Promise<void> {
  return;
}

/** A campaign signup can count as yearly. It never receives points. */
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
