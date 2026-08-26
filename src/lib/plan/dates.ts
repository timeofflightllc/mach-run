import {
  addMonths,
  addYears,
  differenceInMonths,
  format,
  isAfter,
  isBefore,
  isEqual,
  parseISO,
  startOfMonth,
} from "date-fns";

export function parseDate(iso: string): Date {
  return parseISO(iso.slice(0, 10));
}

export function iso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function monthStart(isoDate: string): Date {
  return startOfMonth(parseDate(isoDate));
}

export function validIso(isoDate: string | null | undefined): boolean {
  if (!isoDate || isoDate.length < 8) return false;
  const d = parseDate(isoDate);
  return !Number.isNaN(d.getTime());
}

export function ageYears(birthIso: string, at: Date): number {
  if (!validIso(birthIso)) return 0;
  const birth = parseDate(birthIso);
  let age = at.getFullYear() - birth.getFullYear();
  const m = at.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function ageYearsDecimal(birthIso: string, at: Date): number {
  if (!validIso(birthIso)) return 0;
  const birth = parseDate(birthIso);
  return differenceInMonths(at, birth) / 12;
}

export function dateAtAge(birthIso: string, age: number): Date {
  return addYears(parseDate(birthIso), age);
}

export function inRange(
  at: Date,
  startIso: string,
  endIso: string | null,
): boolean {
  const start = monthStart(startIso);
  if (isBefore(at, start)) return false;
  if (!endIso) return true;
  const end = monthStart(endIso);
  return isBefore(at, end) || isEqual(at, end);
}

export function monthsBetween(a: Date, b: Date): number {
  return differenceInMonths(b, a);
}

export function addMonth(d: Date): Date {
  return addMonths(d, 1);
}

export function isSameOrAfter(a: Date, b: Date): boolean {
  return isAfter(a, b) || isEqual(a, b);
}

export function yearlyRateToMonthly(annual: number): number {
  if (annual <= -1) return 0;
  return (1 + annual) ** (1 / 12) - 1;
}
