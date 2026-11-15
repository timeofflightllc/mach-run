import { getSql } from "@/lib/db";
import { referralDisplayName } from "@/lib/referrals/summary";

export type RewardGrant = {
  source: "beta" | "referral";
  points: number;
  date: string;
  name: string;
};

/** The only Mach Rewards balance. Grants minus redemptions. Never below zero. */
export async function rewardBalance(userId: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ points: number }>(
    `select (
       coalesce((select sum(points) from mach_reward_grants where user_id = $1), 0)
       - coalesce((select sum(points) from mach_reward_redemptions where user_id = $1), 0)
     )::int as points`,
    [userId],
  );
  const points = Number(rows[0]?.points ?? 0);
  return Number.isFinite(points) && points > 0 ? points : 0;
}

/** Grants only, newest first. A redemption is not a second history. */
export async function loadRewardGrants(userId: string): Promise<RewardGrant[]> {
  const sql = await getSql();
  const rows = await sql.query<{ source: string; points: number; date: string; name: string | null }>(
    `select g.source,
            g.points,
            to_char(g.created_at at time zone 'UTC', 'YYYY-MM-DD') as date,
            u.name
     from mach_reward_grants g
     left join mach_referral_signups s
       on g.source = 'referral' and s.id = g.source_id
     left join "user" u on u.id = s.new_user_id
     where g.user_id = $1
     order by g.created_at desc, g.id desc`,
    [userId],
  );
  return rows
    .filter((row) => row.source === "beta" || row.source === "referral")
    .map((row) => ({
      source: row.source as "beta" | "referral",
      points: Number(row.points),
      date: row.date,
      name: referralDisplayName(row.name),
    }));
}

