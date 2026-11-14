export const DEFAULT_CREDIT_POINTS = 200;
export const REFERRAL_CREDIT_DESCRIPTION = "Referral credit";

/** Whole points only. 10 points = $1. A bad value is rejected, not rounded. */
export function parseCreditPoints(raw: unknown): number | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d+$/.test(text)) return null;
  const points = Number(text);
  if (!Number.isInteger(points) || points < 0 || points > 10000) return null;
  return points;
}

/** 200 points post 2000 cents. The same $20 Stripe already posts. */
export function centsFromPoints(points: number): number {
  return points * 10;
}

/** A stored credit is cents. 2000 cents is 200 points. */
export function pointsFromCents(cents: number): number {
  const value = Number(cents);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / 10);
}

export function dollarsFromCents(cents: number): number {
  const value = Number(cents);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / 100);
}

export function referralCreditKey(signupId: string): string {
  return `referral-credit-${signupId}`;
}

export function referralCreditLabel(cents: number): string {
  const points = pointsFromCents(cents);
  return points === 1 ? "1 point" : `${points} points`;
}

export function referralBillLine(cents: number): string {
  return `$${dollarsFromCents(cents)} toward your next bill`;
}
