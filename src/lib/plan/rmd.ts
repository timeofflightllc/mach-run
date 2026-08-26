import { ageYears, inRange, validIso } from "./dates.ts";
import type { Plan, Portfolio } from "./types.ts";

/**
 * IRS Uniform Lifetime Table (Reg. §1.401(a)(9)-9), ages 72–120.
 * RMD = prior year-end balance / factor.
 */
const UNIFORM_LIFETIME: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
  79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
  86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
  93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8,
  100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3,
  107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
  114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
};

export type RmdClass = "none" | "ira" | "workplace";

/** SECURE 2.0: 73 if born 1951–1959, 75 if born 1960+. */
export function rmdStartAge(birthIso: string): number | null {
  if (!validIso(birthIso)) return null;
  const year = Number(birthIso.slice(0, 4));
  if (year <= 1950) return 72;
  if (year <= 1959) return 73;
  return 75;
}

export function uniformLifetimeFactor(age: number): number {
  const a = Math.max(72, Math.min(120, Math.floor(age)));
  return UNIFORM_LIFETIME[a] ?? 2.0;
}

export function rmdClass(p: Portfolio): RmdClass {
  if (p.kind === "roth" || p.kind === "roth_ira" || p.kind === "401k_roth") return "none";
  if (p.taxBucket === "roth") return "none";
  if (p.taxBucket !== "pre_tax") return "none";
  if (p.kind === "401k" || p.kind === "tsp") return "workplace";
  return "ira";
}

export function ownerBirth(plan: Plan, p: Portfolio): string {
  if (/spouse/i.test(p.owner)) return plan.spouse.birthDate;
  return plan.primary.birthDate;
}

export function ageInCalendarYear(birthIso: string, year: number): number {
  return ageYears(birthIso, new Date(year, 11, 31));
}

/**
 * Still-working exception: current-employer 401(k)/TSP only, and only
 * while salary/wages is on AND this account is receiving contributions.
 * IRAs have no still-working exception. Roth accounts have no lifetime RMD.
 */
export function rmdDueThisMonth(
  plan: Plan,
  p: Portfolio,
  at: Date,
  salaryOn: boolean,
  contributing: boolean,
): boolean {
  const kind = rmdClass(p);
  if (kind === "none") return false;
  const birth = ownerBirth(plan, p);
  const start = rmdStartAge(birth);
  if (start == null) return false;
  const age = ageInCalendarYear(birth, at.getFullYear());
  if (age < start) return false;
  if (kind === "workplace" && salaryOn && contributing) return false;
  return true;
}

export function monthlyRmd(priorYearEnd: number, age: number): number {
  if (priorYearEnd <= 0) return 0;
  const f = uniformLifetimeFactor(age);
  if (f <= 0) return 0;
  return priorYearEnd / f / 12;
}
