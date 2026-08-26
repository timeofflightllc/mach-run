import { ageYears, monthStart, validIso } from "./dates.ts";
import type { Child, IncomeStream, Plan } from "./types.ts";
import { VA_RATES_2026, isVaRating, type VaRating } from "./va-rates.ts";

export { VA_RATES_2026, VA_RATINGS, isVaRating } from "./va-rates.ts";
export type { VaRating } from "./va-rates.ts";

export function childrenUnder18(children: Child[], at: Date): Child[] {
  return children.filter((c) => validIso(c.birthDate) && ageYears(c.birthDate, at) < 18);
}

export function vaHasSpouse(plan: Plan, stream: IncomeStream): boolean {
  if (stream.vaSpouseDependent != null) return stream.vaSpouseDependent;
  return Boolean(plan.spouse.name.trim() || validIso(plan.spouse.birthDate));
}

/** Exact 2026 schedular monthly pay for rating + spouse + kids under 18. */
export function vaSchedularPay(rating: number, spouse: boolean, kids: number): number {
  if (!isVaRating(rating)) return 0;
  const row = VA_RATES_2026[rating];
  if (rating < 30) return row.veteranAlone;
  const n = Math.max(0, Math.floor(kids));
  if (n <= 0) return spouse ? row.withSpouse : row.veteranAlone;
  const first = spouse ? row.childSpouse : row.childOnly;
  return roundCents(first + Math.max(0, n - 1) * row.additionalChild);
}

export function vaRatingOf(stream: IncomeStream): VaRating | null {
  return stream.vaRatingPct != null && isVaRating(stream.vaRatingPct)
    ? stream.vaRatingPct
    : null;
}

/** Veteran + spouse (or veteran alone) with no child add-ons. */
export function vaVeteranSpouseBase(plan: Plan, stream: IncomeStream): number {
  const rating = vaRatingOf(stream);
  const spouse = vaHasSpouse(plan, stream);
  if (rating) return vaSchedularPay(rating, spouse, 0);
  return Math.max(0, stream.monthlyAmount);
}

/** Today's-dollar VA pay at `at`. COLA is applied by the engine. */
export function vaPayTodayDollars(plan: Plan, stream: IncomeStream, at: Date): number {
  const kids = childrenUnder18(plan.children ?? [], at).length;
  const spouse = vaHasSpouse(plan, stream);
  const rating = vaRatingOf(stream);
  if (rating) return vaSchedularPay(rating, spouse, kids);
  return stream.monthlyAmount || 0;
}

export function vaStepSchedule(
  plan: Plan,
  stream: IncomeStream,
): { date: string; name: string; payToday: number; kidsLeft: number }[] {
  const asOf = monthStart(plan.assumptions.asOfDate);
  const kids = (plan.children ?? [])
    .filter((c) => validIso(c.birthDate))
    .map((c) => ({ ...c, turns18: addYearsIso(c.birthDate, 18) }))
    .filter((c) => c.turns18 > asOf.toISOString().slice(0, 10))
    .sort((a, b) => a.turns18.localeCompare(b.turns18));

  return kids.map((kid) => {
    const at = monthStart(kid.turns18);
    return {
      date: kid.turns18,
      name: kid.name.trim() || "Child",
      payToday: vaPayTodayDollars(plan, stream, at),
      kidsLeft: childrenUnder18(plan.children ?? [], at).length,
    };
  });
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function addYearsIso(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return `${String(y + years).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
