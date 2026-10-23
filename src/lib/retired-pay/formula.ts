/** Retired-pay math. Pay rates come from the caller. This file stores none. */

export type RetirementSystem = "final" | "high3" | "redux" | "brs";
export type LumpSum = "full" | "25" | "50";

export type PayTable = {
  effectiveYear: number;
  /** Monthly basic pay by grade and longevity step. Step 0 is "2 or less". */
  rates: Record<string, Partial<Record<number, number>>>;
};

export const LONGEVITY_STEPS = [
  0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
] as const;

export type RetiredPayInput = {
  system: RetirementSystem;
  /** False when active years are under 20, or a reservist will not have 20 good years. */
  eligible: boolean;
  payYears: number;
  multiplierYears: number;
  grade: string;
  priorGrade: string;
  /** Most recent months of the high-36 spent in `grade`. The rest use `priorGrade`. */
  monthsAtGrade: number;
  lump: LumpSum;
};

export type RetiredPayResult = {
  monthly: number;
  yearly: number;
  fullMonthly: number;
  high36: number;
  multiplier: number;
  system: RetirementSystem;
};

const ENTRY_FINAL = "1980-09-08";
const ENTRY_REDUX = "1986-08-01";
const ENTRY_BRS_OPT = "2006-01-01";
const ENTRY_BRS = "2018-01-01";

export function entryIso(year: number, month: number): string {
  // Month precision. 8 Sep 1980 is the only mid-month cutoff, so that month is High-3.
  if (year === 1980 && month === 9) return "1980-09-08";
  const m = String(month).padStart(2, "0");
  return `${year}-${m}-01`;
}

/** Which system question the entry date still requires. Null means the date decided it. */
export function systemQuestion(entry: string): "csb" | "brs" | null {
  if (entry < ENTRY_FINAL || entry >= ENTRY_BRS) return null;
  if (entry < ENTRY_REDUX) return null;
  if (entry < ENTRY_BRS_OPT) return "csb";
  return "brs";
}

export function retirementSystem(
  entry: string,
  csb: boolean | null,
  brsOpt: boolean | null,
): RetirementSystem | null {
  if (entry < ENTRY_FINAL) return "final";
  if (entry < ENTRY_REDUX) return "high3";
  if (entry < ENTRY_BRS_OPT) {
    if (csb == null) return null;
    return csb ? "redux" : "high3";
  }
  if (entry < ENTRY_BRS) {
    if (brsOpt == null) return null;
    return brsOpt ? "brs" : "high3";
  }
  return "brs";
}

export function systemLabel(system: RetirementSystem): string {
  if (system === "final") return "Final Pay";
  if (system === "high3") return "High-3";
  if (system === "redux") return "REDUX";
  return "BRS";
}

/** Completed years. 3.9 stays on the over-3 column. Exactly 4 reaches over 4. */
export function longevityStep(years: number): number {
  const completed = Math.floor(Math.max(0, years));
  if (completed < 2) return 0;
  let step = 2;
  for (const candidate of LONGEVITY_STEPS) {
    if (candidate !== 0 && completed >= candidate) step = candidate;
  }
  return step;
}

export function rateAt(table: PayTable, grade: string, years: number): number | null {
  const row = table.rates[grade];
  if (!row) return null;
  const step = longevityStep(years);
  const index = LONGEVITY_STEPS.indexOf(step as (typeof LONGEVITY_STEPS)[number]);
  for (let i = index; i >= 0; i--) {
    const candidate = LONGEVITY_STEPS[i];
    const rate = row[candidate];
    if (rate != null && Number.isFinite(rate)) return rate;
  }
  return null;
}

export function yearsBetween(startYear: number, startMonth: number, endYear: number, endMonth: number): number {
  return ((endYear - startYear) * 12 + (endMonth - startMonth)) / 12;
}

export function pointsToYears(points: number): number {
  return points / 360;
}

export function payGradeKey(grade: string, priorEnlisted: boolean): string {
  if (priorEnlisted && /^O-[123]$/.test(grade)) return `${grade}E`;
  return grade;
}

/** O-5 and above. O-4 does not take the three-year question. */
export function needsThreeYearsInGrade(grade: string): boolean {
  const match = /^O-(\d+)/.exec(grade);
  return Boolean(match && Number(match[1]) > 4);
}

export function gradeRank(grade: string): number {
  const match = /^([EWO])-(\d+)/.exec(grade);
  if (!match) return 0;
  const family = match[1] === "E" ? 0 : match[1] === "W" ? 100 : 200;
  return family + Number(match[2]);
}

function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 2% per year through 20, then 3.5 points for each year past 20. No COLA cut. */
export function multiplierFor(system: RetirementSystem, years: number): number {
  if (system === "brs") return 0.02 * years;
  if (system === "redux") {
    if (years <= 20) return 0.02 * years;
    return 0.4 + 0.035 * (years - 20);
  }
  return 0.025 * years;
}

function high36(input: RetiredPayInput, table: PayTable): number | null {
  const months = Math.min(36, Math.max(0, input.monthsAtGrade));
  let sum = 0;
  for (let month = 0; month < 36; month++) {
    const years = Math.max(0, input.payYears - month / 12);
    const grade = month < months ? input.grade : input.priorGrade;
    const rate = rateAt(table, grade, years);
    if (rate == null) return null;
    sum += rate;
  }
  return sum / 36;
}

export function firstYearMonthly(fullMonthly: number, system: RetirementSystem, lump: LumpSum): number {
  if (system !== "brs" || lump === "full") return fullMonthly;
  if (lump === "25") return fullMonthly * 0.75;
  return fullMonthly * 0.5;
}

export function retiredPay(input: RetiredPayInput, table: PayTable): RetiredPayResult | null {
  if (!input.eligible) return null;
  if (!(input.multiplierYears > 0) || !(input.payYears >= 0)) return null;
  const base =
    input.system === "final"
      ? rateAt(table, input.grade, input.payYears)
      : high36(input, table);
  if (base == null) return null;
  const multiplier = multiplierFor(input.system, input.multiplierYears);
  const fullMonthly = cents(base * multiplier);
  const monthly = cents(firstYearMonthly(fullMonthly, input.system, input.lump));
  return {
    monthly,
    yearly: cents(monthly * 12),
    fullMonthly,
    high36: cents(base),
    multiplier,
    system: input.system,
  };
}
