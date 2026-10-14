import type { SimResult } from "./types.ts";

export interface CashShortYear {
  year: number;
  asked: number;
  left: number;
  missed: number;
}

/** Years where the contribution request is bigger than income − tax − spending. */
export function cashShortYears(sim: SimResult): CashShortYear[] {
  const rows: CashShortYear[] = [];
  for (const cap of sim.yearCaps ?? []) {
    if (cap.kind !== "cash") continue;
    const asked = Math.max(0, cap.planned - cap.employerMatch);
    const left = Math.max(0, cap.leftover);
    const missed = Math.max(0, asked - left);
    if (missed <= 1) continue;
    rows.push({ year: cap.year, asked, left, missed });
  }
  return rows;
}

/** Years through `throughYear` that parked leftover as cash. Sweep was blank. */
export function cashParkedYears(sim: SimResult, throughYear: number): number[] {
  const years = new Set<number>();
  for (const month of sim.months ?? []) {
    if (month.year > throughYear) continue;
    if ((month.detail?.cashParked ?? 0) > 1) years.add(month.year);
  }
  return [...years].sort((a, b) => a - b);
}

function yearList(years: number[]): string {
  if (years.length <= 1) return String(years[0] ?? "");
  if (years.length === 2) return `${years[0]} and ${years[1]}`;
  return `${years.slice(0, -1).join(", ")}, and ${years[years.length - 1]}`;
}

/**
 * Null when no year is short: the caller can still offer an extra monthly amount.
 * When other years parked cash, name only the short years. The old blanket line
 * stays for a plan that is short in every year and never parks cash.
 */
export function paycheckGapNote(shortYears: number[], parkedYears: number[]): string | null {
  if (shortYears.length === 0) return null;
  const others = parkedYears.filter((year) => !shortYears.includes(year));
  if (others.length === 0) {
    return "The paycheck does not have room for the extra saving that would close this.";
  }
  const listed = shortYears.length <= 4 ? yearList(shortYears) : `${shortYears.length} years`;
  const verb = shortYears.length === 1 ? "is" : "are";
  return `Only ${listed} ${verb} short. Other years are parking leftover as cash, and that cash is already inside this number.`;
}
