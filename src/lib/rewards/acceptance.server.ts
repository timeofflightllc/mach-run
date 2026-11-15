import { getSql } from "@/lib/db";
import { REWARDS_TERMS_VERSION } from "./terms";

export async function rewardsTermsAccepted(userId: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query<{ terms_version: string }>(
    `select terms_version from mach_rewards_acceptance where user_id = $1`,
    [userId],
  );
  return rows[0]?.terms_version === REWARDS_TERMS_VERSION;
}

/** Writes only when Join is pressed. The version is the server's, not the browser's. */
export async function acceptRewardsTerms(userId: string): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into mach_rewards_acceptance (user_id, terms_version, accepted_at)
     values ($1, $2, now())
     on conflict (user_id) do update
       set terms_version = excluded.terms_version,
           accepted_at = now()`,
    [userId, REWARDS_TERMS_VERSION],
  );
}
