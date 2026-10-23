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
  /** Most recent months of the high-36 spent in `grade`, when no month-by-month history is passed. */
  monthsAtGrade: number;
  lump: LumpSum;
  /**
   * When set, each of the 36 months before retirement uses the grade worn that month
   * and the basic-pay table in effect that month. Gross pay is then rounded down to the dollar.
   */
  history?: PayHistory;
};

export type PayHistory = {
  tables: PayTable[];
  retireYear: number;
  retireMonth: number;
  /** First month paid at `grade`. Null means the whole window is `grade`. */
  dorYear: number | null;
  dorMonth: number | null;
  /** Pay entry base date. When set, leftover days are dropped and a mid-month longevity raise is split. */
  entryYear?: number | null;
  entryMonth?: number | null;
  entryDay?: number | null;
};

export type RetiredPayResult = {
  monthly: number;
  yearly: number;
  fullMonthly: number;
  high36: number;
  multiplier: number;
  system: RetirementSystem;
  /** Set when each month used its own basic-pay table. Oldest year first. */
  bands?: PayBand[];
};

export type PayBand = {
  year: number;
  grade: string;
  rate: number;
  count: number;
};

const ENTRY_FINAL = "1980-09-08";
const ENTRY_REDUX = "1986-08-01";
const ENTRY_BRS_OPT = "2006-01-01";
const ENTRY_BRS = "2018-01-01";

export function entryIso(year: number, month: number, day?: number): string {
  // 8 Sep 1980 is the only mid-month cutoff. Without a day, that month stays High-3.
  if (year === 1980 && month === 9) {
    if (day != null && day < 8) return "1980-09-07";
    return "1980-09-08";
  }
  const m = String(month).padStart(2, "0");
  return `${year}-${m}-01`;
}

/** Thirty-day months. Leftover days are dropped from the multiplier. */
export function serviceCredit(
  startYear: number,
  startMonth: number,
  startDay: number,
  endYear: number,
  endMonth: number,
  endDay: number,
): { years: number; months: number; days: number; creditedYears: number } {
  const start = Math.min(Math.max(startDay, 1), 30);
  const end = Math.min(Math.max(endDay, 1), 30);
  let years = endYear - startYear;
  let months = endMonth - startMonth;
  let days = end - start;
  if (days < 0) {
    days += 30;
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  if (years < 0) return { years: 0, months: 0, days: 0, creditedYears: 0 };
  return { years, months, days, creditedYears: years + months / 12 };
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

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Latest table whose effective year is on or before this calendar year. */
export function tableInEffect(tables: PayTable[], year: number): PayTable | null {
  let best: PayTable | null = null;
  for (const table of tables) {
    if (table.effectiveYear <= year && (!best || table.effectiveYear > best.effectiveYear)) best = table;
  }
  return best;
}

function wornGrade(year: number, month: number, input: RetiredPayInput): string {
  const history = input.history;
  if (!history || history.dorYear == null || history.dorMonth == null) return input.grade;
  const at = year * 12 + month;
  const dor = history.dorYear * 12 + history.dorMonth;
  return at >= dor ? input.grade : input.priorGrade;
}

function monthRate(table: PayTable, grade: string, input: RetiredPayInput, year: number, month: number, back: number): number | null {
  const history = input.history;
  const entryYear = history?.entryYear;
  const entryMonth = history?.entryMonth;
  const entryDay = history?.entryDay;
  if (entryYear == null || entryMonth == null || entryDay == null) {
    return rateAt(table, grade, Math.max(0, input.payYears - back / 12));
  }
  const anniversary = Math.min(Math.max(entryDay, 1), 30);
  const before = serviceCredit(entryYear, entryMonth, entryDay, year, month, 1).creditedYears;
  const after = serviceCredit(entryYear, entryMonth, entryDay, year, month, anniversary).creditedYears;
  const opened = rateAt(table, grade, before);
  const closed = rateAt(table, grade, after);
  if (opened == null || closed == null) return null;
  if (anniversary <= 1 || opened === closed) return closed;
  const beforeDays = anniversary - 1;
  return (opened * beforeDays + closed * (30 - beforeDays)) / 30;
}

/** 36 months of basic pay ending the month before retirement. */
function high36History(input: RetiredPayInput): { average: number; bands: PayBand[] } | null {
  const history = input.history;
  if (!history) return null;
  const months: PayBand[] = [];
  let sum = 0;
  for (let back = 36; back >= 1; back--) {
    const when = shiftMonth(history.retireYear, history.retireMonth, -back);
    const table = tableInEffect(history.tables, when.year);
    if (!table) return null;
    const grade = wornGrade(when.year, when.month, input);
    const rate = monthRate(table, grade, input, when.year, when.month, back);
    if (rate == null) return null;
    sum += rate;
    const last = months.at(-1);
    const cents = Math.round(rate * 100);
    if (last && last.year === table.effectiveYear && last.grade === grade && Math.round(last.rate * 100) === cents) last.count += 1;
    else months.push({ year: table.effectiveYear, grade, rate, count: 1 });
  }
  return { average: sum / 36, bands: months };
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
  let base: number | null;
  let bands: PayBand[] | undefined;
  if (input.history && input.system === "final") {
    const last = shiftMonth(input.history.retireYear, input.history.retireMonth, -1);
    const inEffect = tableInEffect(input.history.tables, last.year);
    base = inEffect ? monthRate(inEffect, wornGrade(last.year, last.month, input), input, last.year, last.month, 1) : null;
  } else if (input.history) {
    const high = high36History(input);
    base = high?.average ?? null;
    bands = high?.bands;
  } else {
    base = input.system === "final" ? rateAt(table, input.grade, input.payYears) : high36(input, table);
  }
  if (base == null) return null;
  const multiplier = multiplierFor(input.system, input.multiplierYears);
  const raw = base * multiplier;
  const fullMonthly = input.history ? Math.floor(raw) : cents(raw);
  const monthly = input.history ? Math.floor(firstYearMonthly(fullMonthly, input.system, input.lump)) : cents(firstYearMonthly(fullMonthly, input.system, input.lump));
  return {
    monthly,
    yearly: cents(monthly * 12),
    fullMonthly,
    high36: cents(base),
    multiplier,
    system: input.system,
    bands,
  };
}
