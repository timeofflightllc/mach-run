import { dateAtAge, iso, validIso } from "./dates.ts";

/**
 * SSA early/delayed retirement factors applied to PIA.
 * FRA for anyone born 1960+ is 67; born 1959 is 66y10m. Both household
 * members here (1979 / 1986) are FRA 67.
 */
export function ssBenefitFromPia(
  pia: number,
  claimAgeYears: number,
  fra = 67,
): number {
  const claimMonths = Math.round(claimAgeYears * 12);
  const fraMonths = Math.round(fra * 12);
  const delta = claimMonths - fraMonths;
  if (delta === 0) return pia;
  if (delta < 0) {
    const early = -delta;
    const first = Math.min(36, early);
    const rest = Math.max(0, early - 36);
    const reduction = first * (5 / 9) * 0.01 + rest * (5 / 12) * 0.01;
    return pia * Math.max(0, 1 - reduction);
  }
  const delayed = Math.min(delta, 36);
  const credit = delayed * (2 / 3) * 0.01;
  return pia * (1 + credit);
}

export function clampClaimAge(age: number): number {
  return Math.min(70, Math.max(62, age));
}

/** Start = birthday + claiming age. End = birthday + Family projection age. */
export function ssScheduleDates(
  birthIso: string,
  claimAge: number,
  projectionEndAge: number,
): { startDate: string; endDate: string } | null {
  if (!validIso(birthIso)) return null;
  const claim = clampClaimAge(claimAge);
  const endAge = Math.max(claim, Number.isFinite(projectionEndAge) ? projectionEndAge : claim);
  return {
    startDate: iso(dateAtAge(birthIso, claim)),
    endDate: iso(dateAtAge(birthIso, endAge)),
  };
}