export const DEFAULT_CREDIT_DOLLARS = 20;
export const REFERRAL_CREDIT_DESCRIPTION = "Referral credit";

/** Whole dollars only. A bad value is rejected, not rounded into a surprise. */
export function parseCreditDollars(raw: unknown): number | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d+$/.test(text)) return null;
  const dollars = Number(text);
  if (!Number.isInteger(dollars) || dollars < 0 || dollars > 1000) return null;
  return dollars;
}

export function referralCreditKey(signupId: string): string {
  return `referral-credit-${signupId}`;
}

export function referralCreditLabel(cents: number): string {
  return `$${Math.round(cents / 100)} credit`;
}
