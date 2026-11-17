export type RewardStanding = {
  earned: number;
  spent: number;
  balance: number;
};

type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

function whole(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.trunc(n);
}

/** Grants minus redemptions. The balance never goes below zero. */
export function rewardStandingFrom(earned: number, spent: number): RewardStanding {
  const granted = whole(earned);
  const redeemed = whole(spent);
  return { earned: granted, spent: redeemed, balance: Math.max(0, granted - redeemed) };
}

/** Earned is grants. Spent is redemptions. Balance is the difference. */
export async function readRewardStanding(sql: Sql, userId: string): Promise<RewardStanding> {
  const rows = await sql.query<{ earned: number; spent: number }>(
    `select
       coalesce((select sum(points) from mach_reward_grants where user_id = $1), 0)::int as earned,
       coalesce((select sum(points) from mach_reward_redemptions where user_id = $1), 0)::int as spent`,
    [userId],
  );
  return rewardStandingFrom(Number(rows[0]?.earned ?? 0), Number(rows[0]?.spent ?? 0));
}
