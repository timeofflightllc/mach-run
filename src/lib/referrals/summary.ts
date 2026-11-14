import { pointsFromCents, referralBillLine, referralCreditLabel } from "./credit.ts";

export { referralBillLine, referralCreditLabel };

const YEARLY = new Set(["yearly", "credit"]);

export type ReferralRowStatus = string;

export function referralDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed.includes("@")) return "New account";
  return trimmed;
}

export function isYearlyReferral(status: string): boolean {
  return YEARLY.has(status);
}

export function referralStatusLabel(status: string, creditCents?: number | null): ReferralRowStatus {
  const cents = creditCents == null ? 0 : Number(creditCents);
  if (cents > 0 && isYearlyReferral(status)) return referralCreditLabel(cents);
  if (status === "chose-monthly") return "Chose monthly";
  if (isYearlyReferral(status)) return "Started a yearly plan";
  return "Signed up";
}

export function referralPoints(cents: number): number {
  return pointsFromCents(cents);
}

export function referralPointsReceived(cents: number): string {
  return `Points received: ${referralPoints(cents)}`;
}

export function referralRate(signedUp: number, yearly: number): string {
  if (signedUp <= 0 || yearly <= 0) return "0%";
  return `${Math.round((yearly / signedUp) * 100)}%`;
}

export function referralCountLine(signedUp: number, yearly: number): string {
  const people = signedUp === 1 ? "1 signed up" : `${signedUp} signed up`;
  const started = yearly === 1 ? "1 started a yearly plan" : `${yearly} started a yearly plan`;
  return `${people}. ${started}. ${referralRate(signedUp, yearly)}.`;
}
