export type PointBoard = {
  betaInvited: boolean;
  betaSubmitted: number;
  hasPlan: boolean;
};

/** One submitted debrief. The card offers three. */
export const BETA_PASS_POINTS = 150;
export const BETA_PASS_CAP = 3;

/** Points a submitted beta debrief is worth. Same cap as the card. No account is skipped. */
export function betaRewardPoints(submitted: number | null | undefined): number {
  const count = Number(submitted);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), BETA_PASS_CAP) * BETA_PASS_POINTS;
}
