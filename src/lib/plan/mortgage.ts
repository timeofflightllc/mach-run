import { monthStart, validIso } from "./dates.ts";
import type { Mortgage, Portfolio } from "./types.ts";

export function mortgageAssociated(m: Mortgage | null | undefined): boolean {
  if (!m) return false;
  if (m.associated === false) return false;
  if (m.associated === true) return true;
  return (m.monthlyPi || 0) > 0 && validIso(m.originationDate);
}

export function monthsBetweenMonths(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function originalPrincipal(m: Mortgage): number {
  const n = Math.max(0, Math.round((m.termYears || 0) * 12));
  const pmt = m.monthlyPi || 0;
  if (n <= 0 || pmt <= 0) return 0;
  const r = (m.aprPct || 0) / 100 / 12;
  if (r <= 0) return pmt * n;
  const pow = (1 + r) ** n;
  return pmt * (pow - 1) / (r * pow);
}

/** Remaining principal at the start of `asOf` (before that month's payment). */
export function remainingMortgage(
  m: Mortgage | null | undefined,
  asOf: string | Date,
): number {
  if (!mortgageAssociated(m) || !m || !(m.monthlyPi > 0) || !(m.termYears > 0) || !validIso(m.originationDate)) {
    return 0;
  }
  const start = monthStart(m.originationDate);
  const at = typeof asOf === "string" ? monthStart(asOf) : monthStart(
    `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, "0")}-01`,
  );
  const n = Math.max(0, Math.round(m.termYears * 12));
  const k = Math.max(0, monthsBetweenMonths(start, at));
  if (k >= n) return 0;
  const p = originalPrincipal(m);
  if (p <= 0) return 0;
  const r = (m.aprPct || 0) / 100 / 12;
  if (r <= 0) return Math.max(0, p - m.monthlyPi * k);
  const powN = (1 + r) ** n;
  const powK = (1 + r) ** k;
  return Math.max(0, p * (powN - powK) / (powN - 1));
}

export function mortgagePaymentDue(
  m: Mortgage | null | undefined,
  asOf: string | Date,
): number {
  if (!mortgageAssociated(m) || !m || !m.includeInSpending) return 0;
  const rem = remainingMortgage(m, asOf);
  if (rem <= 0.5) return 0;
  const r = (m.aprPct || 0) / 100 / 12;
  const interest = rem * r;
  return Math.min(m.monthlyPi || 0, rem + interest);
}

export function mortgagePayoffDate(m: Mortgage | null | undefined): string | null {
  if (!m || !mortgageAssociated(m) || !validIso(m.originationDate) || !(m.termYears > 0)) return null;
  const start = monthStart(m.originationDate);
  const end = new Date(start.getFullYear(), start.getMonth() + Math.round(m.termYears * 12), 1);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-01`;
}

export function emptyMortgage(): Mortgage {
  return {
    originationDate: "",
    aprPct: 0,
    monthlyPi: 0,
    termYears: 30,
    includeInSpending: false,
    associated: false,
  };
}

export function portfolioEquity(p: Portfolio, asOf: string | Date): number {
  const v = p.currentValue;
  if (p.kind !== "real_estate") return v;
  return v - remainingMortgage(p.mortgage, asOf);
}