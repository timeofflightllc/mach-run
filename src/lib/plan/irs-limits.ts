import type { AccountKind } from "./types.ts";

/** IRS employee/IRA annual limits for 2026. Employer match is not in these figures. */
export const IRS_LIMITS_2026 = {
  year: 2026,
  ira: 7_500,
  workplace: 24_500,
  iraCatchUp50: 1_100,
  workplaceCatchUp50: 8_000,
  workplaceCatchUp60: 11_250,
  /** Trump Account growth-period cap (IRC). Indexed after 2027. No 50+ catch-up. */
  trump: 5_000,
} as const;

export function irsLimitClass(kind: AccountKind): "ira" | "workplace" | "trump" | null {
  switch (kind) {
    case "ira":
    case "roth_ira":
    case "roth":
    case "traditional":
      return "ira";
    case "401k":
    case "401k_roth":
    case "tsp":
      return "workplace";
    case "trump":
      return "trump";
    default:
      return null;
  }
}

export function irsEmployeeAnnualLimit(kind: AccountKind): number | null {
  const cls = irsLimitClass(kind);
  if (cls === "ira") return IRS_LIMITS_2026.ira;
  if (cls === "workplace") return IRS_LIMITS_2026.workplace;
  if (cls === "trump") return IRS_LIMITS_2026.trump;
  return null;
}

/** Age at year-end drives catch-up. 60–63 workplace uses the super catch-up instead of the 50+ amount. */
export function irsAnnualCap(kind: AccountKind, ageAtYearEnd: number): number | null {
  const base = irsEmployeeAnnualLimit(kind);
  if (base == null) return null;
  const cls = irsLimitClass(kind);
  if (cls === "trump") return base;
  if (cls === "workplace") {
    if (ageAtYearEnd >= 60 && ageAtYearEnd <= 63) {
      return base + IRS_LIMITS_2026.workplaceCatchUp60;
    }
    if (ageAtYearEnd >= 50) return base + IRS_LIMITS_2026.workplaceCatchUp50;
    return base;
  }
  if (ageAtYearEnd >= 50) return base + IRS_LIMITS_2026.iraCatchUp50;
  return base;
}

export function annualizedMonthly(monthly: number): number {
  return Math.max(0, monthly) * 12;
}

/** Warning copy when monthly × 12 exceeds the IRS annual cap. Never blocks the input. */
export function irsOverLimitWarning(
  kind: AccountKind,
  monthly: number,
  opts?: { age?: number; capToLimit?: boolean },
): string | null {
  const cap =
    opts?.age != null ? irsAnnualCap(kind, opts.age) : irsEmployeeAnnualLimit(kind);
  if (cap == null) return null;
  const annual = annualizedMonthly(monthly);
  if (annual <= cap) return null;
  if (opts?.capToLimit) {
    const matchNote =
      irsLimitClass(kind) === "trump"
        ? ""
        : " Employer match follows what you actually deferred.";
    return `This rate is $${Math.round(annual).toLocaleString("en-US")}/year. MACH RUN will put in your amount until the IRS ${IRS_LIMITS_2026.year} cap ($${cap.toLocaleString("en-US")}) is full, then stop your dollars for the rest of that year.${matchNote}`;
  }
  if (irsLimitClass(kind) === "trump") {
    return `The IRS ${IRS_LIMITS_2026.year} limit for a Trump Account is $${cap.toLocaleString("en-US")}/year during the growth period (until the year the child turns 18). $${Math.round(monthly).toLocaleString("en-US")}/mo × 12 = $${Math.round(annual).toLocaleString("en-US")}. MACH RUN is not blocking this amount, but please double-check that you are not exceeding the yearly IRS contribution limit.`;
  }
  const catchUp =
    irsLimitClass(kind) === "workplace"
      ? IRS_LIMITS_2026.workplaceCatchUp50
      : IRS_LIMITS_2026.iraCatchUp50;
  return `The IRS ${IRS_LIMITS_2026.year} limit for this account is $${cap.toLocaleString("en-US")}/year. $${Math.round(monthly).toLocaleString("en-US")}/mo × 12 = $${Math.round(annual).toLocaleString("en-US")}. Age-50+ catch-up (up to $${catchUp.toLocaleString("en-US")} extra) can go higher. MACH RUN is not blocking this amount, but please double-check that you are not exceeding the yearly IRS contribution limit for any qualified investment account.`;
}
