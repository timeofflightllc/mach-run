import { dateAtAge, iso, parseDate, validIso } from "./dates.ts";
import type { IncomeStream, Plan } from "./types.ts";

/** 2026 Social Security wage base. Earnings are already today's dollars. */
export const SS_WAGE_BASE = 184_500;
/** 2026 PIA bend points for a worker reaching 62 in 2026. */
export const SS_BEND_LOW = 1_286;
export const SS_BEND_HIGH = 7_749;

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

export function ssBirthFor(
  plan: Plan,
  stream: Pick<IncomeStream, "person" | "ssBirthDate">,
): string {
  if (stream.person === "spouse") return plan.spouse.birthDate;
  if (stream.person === "other") return stream.ssBirthDate ?? "";
  return plan.primary.birthDate;
}

export type SsEarner = "primary" | "spouse";

export function spouseOnFile(plan: Plan): boolean {
  return Boolean(plan.spouse.name.trim() || validIso(plan.spouse.birthDate));
}

function coveredOwner(stream: IncomeStream): SsEarner | null {
  if (stream.kind !== "salary" && stream.kind !== "bonus") return null;
  if (stream.person === "spouse") return "spouse";
  if (stream.person === "primary" || stream.person === "household") return "primary";
  return null;
}

function yearOf(isoDate: string): number {
  return parseDate(isoDate).getFullYear();
}

/** Annual covered wages in a calendar year, before the career backfill, capped at the wage base. */
function coveredAnnual(plan: Plan, person: SsEarner, year: number): number {
  let annual = 0;
  for (const stream of plan.incomes) {
    if (coveredOwner(stream) !== person) continue;
    if (!validIso(stream.startDate)) continue;
    const startYear = yearOf(stream.startDate);
    const endYear = stream.endDate && validIso(stream.endDate) ? yearOf(stream.endDate) : 9999;
    if (year < startYear || year > endYear) continue;
    annual += Math.max(0, stream.monthlyAmount) * 12;
  }
  return Math.min(SS_WAGE_BASE, annual);
}

function piaFromAime(aime: number): number {
  const first = Math.min(aime, SS_BEND_LOW);
  const second = Math.min(Math.max(0, aime - SS_BEND_LOW), SS_BEND_HIGH - SS_BEND_LOW);
  const third = Math.max(0, aime - SS_BEND_HIGH);
  const raw = first * 0.9 + second * 0.32 + third * 0.15;
  return Math.floor(raw * 10 + 1e-6) / 10;
}

/** Monthly benefit at full retirement age, in today's dollars. Null when it cannot be estimated. */
export function estimatePiaAtFra(plan: Plan, person: SsEarner): number | null {
  if (person === "spouse" && !spouseOnFile(plan)) return null;
  const birth = person === "spouse" ? plan.spouse.birthDate : plan.primary.birthDate;
  if (!validIso(birth)) return null;
  const firstYear = yearOf(iso(dateAtAge(birth, 22)));
  const lastYear = yearOf(iso(dateAtAge(birth, 66)));
  let backfill: number | null = null;
  const years: number[] = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    const amount = coveredAnnual(plan, person, year);
    if (backfill == null && amount > 0) backfill = amount;
    years.push(amount);
  }
  if (backfill == null) return null;
  const firstCovered = years.findIndex((amount) => amount > 0);
  const filled = years.map((amount, index) => (index < firstCovered ? backfill : amount));
  const top = [...filled].sort((a, b) => b - a).slice(0, 35);
  while (top.length < 35) top.push(0);
  const aime = Math.floor(top.reduce((sum, n) => sum + n, 0) / 420);
  if (aime <= 0) return null;
  return piaFromAime(aime);
}

function hasSsRow(plan: Plan, person: SsEarner): boolean {
  return plan.incomes.some((stream) => {
    if (stream.kind !== "ss") return false;
    if (person === "spouse") return stream.person === "spouse";
    return stream.person === "primary" || stream.person === "household";
  });
}

/** Social Security rows a Yes would add. Does not include anyone who already has one. */
export function ssIncomesToCreate(
  plan: Plan,
  idFor: (person: SsEarner) => string,
): IncomeStream[] {
  const rows: IncomeStream[] = [];
  for (const person of ["primary", "spouse"] as const) {
    if (hasSsRow(plan, person)) continue;
    const pia = estimatePiaAtFra(plan, person);
    if (pia == null) continue;
    const birth = person === "spouse" ? plan.spouse.birthDate : plan.primary.birthDate;
    const window = ssScheduleDates(birth, 67, plan.assumptions.projectionEndAge);
    if (!window) continue;
    const name = person === "spouse" ? plan.spouse.name.trim() || "Spouse" : plan.primary.name.trim() || "Primary";
    rows.push({
      id: idFor(person),
      name: `${name}'s Social Security`,
      kind: "ss",
      monthlyAmount: 0,
      startDate: window.startDate,
      endDate: window.endDate,
      colaPct: null,
      taxTreatment: "ss",
      person,
      ssPia: pia,
      ssClaimAge: 67,
      ssFra: 67,
      ssEstimated: true,
    });
  }
  return rows;
}

/** Refresh estimated Social Security amounts. A typed row is left alone. */
export function refreshEstimatedSocialSecurity(plan: Plan): Plan {
  let changed = false;
  const incomes = plan.incomes.map((stream) => {
    if (stream.kind !== "ss" || stream.ssEstimated !== true) return stream;
    if (stream.person !== "primary" && stream.person !== "spouse") return stream;
    const pia = estimatePiaAtFra(plan, stream.person);
    if (pia == null) return stream;
    const next: IncomeStream = { ...stream, ssPia: pia };
    const claim = stream.ssClaimAge ?? 67;
    if (claim === 67) {
      const birth = ssBirthFor(plan, stream);
      const window = ssScheduleDates(birth, 67, plan.assumptions.projectionEndAge);
      if (window && stream.startDate === window.startDate) {
        next.endDate = window.endDate;
      }
    }
    if (next.ssPia !== stream.ssPia || next.endDate !== stream.endDate) {
      changed = true;
      return next;
    }
    return stream;
  });
  return changed ? { ...plan, incomes } : plan;
}