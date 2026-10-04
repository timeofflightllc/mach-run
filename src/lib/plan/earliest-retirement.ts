import { addMonths, addYears, differenceInMonths } from "date-fns";
import {
  ageYears,
  dateAtAge,
  formatMonthYear,
  iso,
  monthStart,
  validIso,
} from "./dates.ts";
import { simulate, streamWindow } from "./engine.ts";
import type { IncomeKind, Plan } from "./types.ts";

/** Paychecks that stop when the household retires. Guaranteed income keeps paying. */
const EARNED: ReadonlySet<IncomeKind> = new Set([
  "salary",
  "bonus",
  "allowance",
  "other",
]);

export interface RecommendedRetirement {
  /** First of the month, or null when no date covers spending through longevity age. */
  date: string | null;
  age: number | null;
}

function horizonMonth(plan: Plan, start: Date): Date {
  if (validIso(plan.primary.birthDate)) {
    return monthStart(iso(dateAtAge(plan.primary.birthDate, plan.assumptions.projectionEndAge)));
  }
  return monthStart(iso(addYears(start, 40)));
}

/** Plan as if every earned paycheck has stopped by this month. Guaranteed income keeps paying. */
function planRetiringOn(plan: Plan, retireIso: string): Plan {
  const retire = retireIso.slice(0, 7);
  const incomes = plan.incomes.map((stream) => {
    if (!EARNED.has(stream.kind)) return stream;
    const win = streamWindow(plan, stream);
    const start = (win.start || plan.assumptions.asOfDate).slice(0, 7);
    const end = win.end ? win.end.slice(0, 7) : null;
    const untie = {
      tiedToStageId: undefined,
      tiedToCareer: false,
      endMonthsBeforeStage: undefined,
      endMonthsBeforeCareer: undefined,
    };
    if (end && end < retire) return stream;
    if (start > retire) {
      const opened = win.start || stream.startDate || plan.assumptions.asOfDate;
      return {
        ...stream,
        ...untie,
        monthlyAmount: 0,
        startDate: opened,
        endDate: iso(addMonths(monthStart(opened), -1)),
      };
    }
    return {
      ...stream,
      ...untie,
      startDate: win.start || stream.startDate,
      endDate: retireIso,
    };
  });
  const contributions = plan.contributions.map((rule) => {
    if (!rule.endAtRetirement) return rule;
    return { ...rule, endDate: retireIso, endWithStageId: undefined };
  });
  return {
    ...plan,
    incomes,
    contributions,
    assumptions: { ...plan.assumptions, retirementGoalDate: retireIso },
  };
}

function covers(plan: Plan, retireIso: string): boolean {
  return simulate(planRetiringOn(plan, retireIso)).depletedAge == null;
}

/**
 * Earliest month earned pay can stop and spending still lasts through longevity age.
 * Later retirement keeps more earned income, so the search is binary.
 */
export function earliestWorkableRetirement(plan: Plan): RecommendedRetirement {
  const start = monthStart(plan.assumptions.asOfDate);
  const end = horizonMonth(plan, start);
  const span = Math.max(0, differenceInMonths(end, start));
  const at = (index: number) => iso(addMonths(start, index));
  const ageAt = (date: string): number | null =>
    validIso(plan.primary.birthDate) ? ageYears(plan.primary.birthDate, monthStart(date)) : null;

  if (!covers(plan, at(span))) return { date: null, age: null };
  if (covers(plan, at(0))) return { date: at(0), age: ageAt(at(0)) };

  let lo = 0;
  let hi = span;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (covers(plan, at(mid))) hi = mid;
    else lo = mid;
  }
  const date = at(hi);
  return { date, age: ageAt(date) };
}

export function recommendedRetirementCopy(plan: Plan, rec: RecommendedRetirement): string {
  const endAge = plan.assumptions.projectionEndAge;
  if (!rec.date) {
    return `This plan does not cover spending through age ${endAge}. No retirement date makes income plus the portfolio last that long.`;
  }
  const when = formatMonthYear(rec.date);
  const ageBit = rec.age != null ? ` (age ${rec.age})` : "";
  const lead = `Earliest earned pay can stop: ${when}${ageBit}. Salary, bonus, allowance, and other income end that month, including paychecks that have not started yet. Pension, military retired pay, VA, Social Security, other retirement income, and the portfolio then have to cover spending through age ${endAge} on their own.`;
  const goal = plan.assumptions.retirementGoalDate;
  if (!goal || !validIso(goal)) return lead;
  const g = goal.slice(0, 7);
  const r = rec.date.slice(0, 7);
  if (g === r) return `${lead} Your retirement goal date is that month.`;
  if (g > r) {
    return `${lead} Your goal date is later, so you can retire earlier than you planned.`;
  }
  return `${lead} Your goal date is earlier than that, so this plan does not cover spending through age ${endAge} if you retire on the date you set.`;
}
