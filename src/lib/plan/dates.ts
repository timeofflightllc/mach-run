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

/** Two-digit / leading-zero years (0029) become 20xx so date pickers cannot end a paycheck in year 29. */
export function coerceIsoDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = iso.trim();
  const m = s.match(/^(\d{1,4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (!m) return s;
  let y = Number(m[1]);
  if (y < 100) y += 2000;
  const mo = String(Number(m[2])).padStart(2, "0");
  const day = String(Number(m[3] ?? 1)).padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${mo}-${day}`;
}

export function parseDate(iso: string): Date {
  const s = coerceIsoDate(iso) || iso.trim();
  const m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return parseISO(s.slice(0, 10));
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1));
}

/** Calendar year-month, timezone-safe. */
export function yearMonth(iso: string): string {
  const s = coerceIsoDate(iso);
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  return "";
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
