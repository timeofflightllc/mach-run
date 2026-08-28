import type { AccountKind } from "./types.ts";

/** IRS employee/IRA annual limits for 2026. Employer match is not in these figures. */
export const IRS_LIMITS_2026 = {
  year: 2026,
  ira: 7_500,
  workplace: 24_500,
  iraCatchUp50: 1_100,
  workplaceCatchUp50: 8_000,
} as const;

export function irsEmployeeAnnualLimit(kind: AccountKind): number | null {
  switch (kind) {
    case "ira":
    case "roth_ira":
    case "roth":
    case "traditional":
      return IRS_LIMITS_2026.ira;
    case "401k":
    case "401k_roth":
    case "tsp":
      return IRS_LIMITS_2026.workplace;
    default:
      return null;
  }
}

export function annualizedMonthly(monthly: number): number {
  return Math.max(0, monthly) * 12;
}

/** Warning copy when monthly × 12 exceeds the IRS annual cap. Never blocks the input. */
export function irsOverLimitWarning(
  kind: AccountKind,
  monthly: number,
): string | null {
  const cap = irsEmployeeAnnualLimit(kind);
  if (cap == null) return null;
  const annual = annualizedMonthly(monthly);
  if (annual <= cap) return null;
  const catchUp =
    kind === "401k" || kind === "401k_roth" || kind === "tsp"
      ? IRS_LIMITS_2026.workplaceCatchUp50
      : IRS_LIMITS_2026.iraCatchUp50;
  return `The IRS ${IRS_LIMITS_2026.year} limit for this account is $${cap.toLocaleString("en-US")}/year. $${Math.round(monthly).toLocaleString("en-US")}/mo × 12 = $${Math.round(annual).toLocaleString("en-US")}. Age-50+ catch-up (up to $${catchUp.toLocaleString("en-US")} extra) can go higher. MACH RUN is not blocking this amount, but please double-check that you are not exceeding the yearly IRS contribution limit for any qualified investment account.`;
}
