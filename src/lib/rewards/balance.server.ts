import { getSql } from "@/lib/db";
import { readRewardGrants, type RewardGrant } from "./grants-read.ts";

export type { RewardGrant };

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
  return readRewardGrants(sql, userId);
}

