import { referralDisplayName } from "../referrals/summary.ts";

export type RewardGrant = {
  source: "beta" | "referral" | "instagram" | "loop";
  points: number;
  date: string;
  name: string;
};

type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

/** Grants only, newest first. A redemption is not a second history. */
export async function readRewardGrants(sql: Sql, userId: string): Promise<RewardGrant[]> {
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
    .filter(
      (row) =>
        row.source === "beta" ||
        row.source === "referral" ||
        row.source === "instagram" ||
        row.source === "loop",
    )
    .map((row) => ({
      source: row.source as "beta" | "referral" | "instagram" | "loop",
      points: Number(row.points),
      date: row.date,
      name:
        row.source === "instagram" || row.source === "loop" ? "" : referralDisplayName(row.name),
    }));
}
