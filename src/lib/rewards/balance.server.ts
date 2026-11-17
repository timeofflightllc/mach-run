import { getSql } from "@/lib/db";
import { readRewardGrants, type RewardGrant } from "./grants-read.ts";
import { readRewardStanding, type RewardStanding } from "./standing.ts";

export type { RewardGrant, RewardStanding };

/** The only Mach Rewards balance. Grants minus redemptions. Never below zero. */
export async function rewardBalance(userId: string): Promise<number> {
  return (await rewardStanding(userId)).balance;
}

/** Earned, spent, and the balance left. */
export async function rewardStanding(userId: string): Promise<RewardStanding> {
  const sql = await getSql();
  return readRewardStanding(sql, userId);
}

/** Grants only, newest first. A redemption is not a second history. */
export async function loadRewardGrants(userId: string): Promise<RewardGrant[]> {
  const sql = await getSql();
  return readRewardGrants(sql, userId);
}
