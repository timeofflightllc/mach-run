import { getSql } from "@/lib/db";

const BETA_POINTS = 150;
const BETA_CAP = 3;

/** One grant per source id. A second call does not add a second grant. */
export async function grantRewardPoints(input: {
  userId: string;
  source: "referral" | "beta";
  sourceId: string;
  points: number;
}): Promise<void> {
  if (!Number.isInteger(input.points) || input.points <= 0) return;
  const sql = await getSql();
  if (input.source === "beta") {
    await sql.query(
      `insert into mach_reward_grants (id, user_id, source, source_id, points)
       select $1, $2, 'beta', $3, $4
       where (
         select count(*)::int from mach_reward_grants
         where user_id = $2 and source = 'beta'
       ) < $5
       on conflict (source, source_id) do nothing`,
      [`beta-${input.sourceId}`, input.userId, input.sourceId, input.points, BETA_CAP],
    );
    return;
  }
  await sql.query(
    `insert into mach_reward_grants (id, user_id, source, source_id, points)
     values ($1, $2, 'referral', $3, $4)
     on conflict (source, source_id) do nothing`,
    [`referral-${input.sourceId}`, input.userId, input.sourceId, input.points],
  );
}

export async function grantBetaDebrief(userId: string, responseId: string): Promise<void> {
  await grantRewardPoints({
    userId,
    source: "beta",
    sourceId: responseId,
    points: BETA_POINTS,
  });
}
