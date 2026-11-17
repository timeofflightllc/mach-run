export type RewardTier = "Green" | "Silver" | "Gold" | "Platinum";

const ORDER: RewardTier[] = ["Green", "Silver", "Gold", "Platinum"];

function earnedPoints(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.trunc(value);
}

function wholeMonths(acceptedAt: string, now: Date): number {
  const from = new Date(acceptedAt);
  if (Number.isNaN(from.getTime()) || now.getTime() < from.getTime()) return 0;
  let months =
    (now.getUTCFullYear() - from.getUTCFullYear()) * 12 + (now.getUTCMonth() - from.getUTCMonth());
  if (now.getUTCDate() < from.getUTCDate()) months -= 1;
  return months > 0 ? months : 0;
}

function byPoints(earned: number): RewardTier {
  if (earned >= 1500) return "Platinum";
  if (earned >= 600) return "Gold";
  if (earned >= 200) return "Silver";
  return "Green";
}

function byMonths(months: number): RewardTier {
  if (months >= 36) return "Platinum";
  if (months >= 18) return "Gold";
  if (months >= 6) return "Silver";
  return "Green";
}

/** The higher of lifetime points earned and whole months since acceptance. A missing date uses points only. */
export function rewardTier(earned: number, acceptedAt: string | null, now = new Date()): RewardTier {
  const points = byPoints(earnedPoints(earned));
  const time = acceptedAt ? byMonths(wholeMonths(acceptedAt, now)) : "Green";
  return ORDER.indexOf(points) >= ORDER.indexOf(time) ? points : time;
}
