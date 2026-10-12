import { childIdFromOwner } from "./family-owners.ts";
import { dateAtAge, iso, validIso } from "./dates.ts";
import type { Plan, Portfolio } from "./types.ts";

/** Blank means the 529 stays in the plan. A number is the child-owner's birthday it is spent. */
export function sunsetAgeOf(portfolio: Portfolio): number | null {
  if (portfolio.kind !== "529") return null;
  const age = portfolio.sunsetAge;
  if (age == null || !Number.isFinite(age) || age <= 0) return null;
  return Math.min(99, Math.round(age));
}

export function child529StopDate(
  birthDate: string | null | undefined,
  age: number | null,
): string | null {
  if (age == null || !validIso(birthDate)) return null;
  return iso(dateAtAge(birthDate as string, age));
}

/** Stop month (YYYY-MM). Null when this 529 has no sunset age, child, or birthday. */
export function portfolio529StopMonth(plan: Plan, portfolio: Portfolio): string | null {
  const age = sunsetAgeOf(portfolio);
  if (age == null) return null;
  const id = childIdFromOwner(portfolio.owner);
  if (!id) return null;
  const child = (plan.children ?? []).find((row) => row.id === id);
  const stop = child529StopDate(child?.birthDate, age);
  return stop ? stop.slice(0, 7) : null;
}

/** True from the birthday month on. The balance is spent and out of the run. */
export function five29Ended(plan: Plan, portfolio: Portfolio, monthKey: string): boolean {
  const stop = portfolio529StopMonth(plan, portfolio);
  if (!stop) return false;
  return monthKey >= stop;
}
