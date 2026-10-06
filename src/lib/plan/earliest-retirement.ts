import { addMonths, addYears, differenceInMonths } from "date-fns";
import {
  ageYears,
  dateAtAge,
  formatMonthYear,
  iso,
  monthStart,
  validIso,
} from "./dates.ts";
import { simulate, spendingWindow, streamWindow } from "./engine.ts";
import type { IncomeKind, Plan, SpendingPhase } from "./types.ts";

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

function monthKey(date: string | null | undefined): string {
  return (date || "").slice(0, 7);
}

/** Drop a phase so it never pays. */
function dropPhase(phase: SpendingPhase, opened: string): SpendingPhase {
  return {
    ...phase,
    tiedToStageId: undefined,
    startDayAfterPrevious: false,
    monthlyAmount: 0,
    startDate: opened,
    endDate: iso(addMonths(monthStart(opened), -1)),
  };
}

/**
 * Spending dated to the retirement goal (or later) starts when earned pay stops.
 * Working-years spending that ends before the goal stops then too, so the two
 * do not stack and the goal-dated budget is not left sitting in a later year.
 * A mortgage or other liability keeps its real dates. A phase already running
 * through the goal is left alone — that is the budget, and it is already on.
 */
function spendingRetiringOn(plan: Plan, retireIso: string): SpendingPhase[] {
  const goal = plan.assumptions.retirementGoalDate;
  if (!goal || !validIso(goal)) return plan.spending;
  const goalKey = monthKey(goal);
  const retireKey = monthKey(retireIso);
  if (!goalKey || retireKey >= goalKey) return plan.spending;

  const shift = differenceInMonths(monthStart(goal), monthStart(retireIso));
  const stopWork = iso(addMonths(monthStart(retireIso), -1));

  return plan.spending.map((phase) => {
    if (phase.liabilityId) return phase;
    const win = spendingWindow(plan, phase);
    const opened = win.start || phase.startDate || plan.assumptions.asOfDate;
    const start = monthKey(opened);
    const end = win.end ? monthKey(win.end) : null;

    if (start >= goalKey) {
      return {
        ...phase,
        tiedToStageId: undefined,
        startDayAfterPrevious: false,
        startDate: iso(addMonths(monthStart(opened), -shift)),
        endDate: win.end ? iso(addMonths(monthStart(win.end), -shift)) : null,
      };
    }

    if (end && end < goalKey) {
      if (end < retireKey) {
        return {
          ...phase,
          tiedToStageId: undefined,
          startDayAfterPrevious: false,
          startDate: opened,
          endDate: win.end,
        };
      }
      if (start > retireKey) return dropPhase(phase, opened);
      return {
        ...phase,
        tiedToStageId: undefined,
        startDayAfterPrevious: false,
        startDate: opened,
        endDate: stopWork,
      };
    }

    if (start > retireKey) {
      return {
        ...phase,
        tiedToStageId: undefined,
        startDayAfterPrevious: false,
        startDate: retireIso,
        endDate: win.end,
      };
    }

    return phase;
  });
}

/** True when a non-liability phase is dated to the goal month or later. */
function goalDatedSpending(plan: Plan): boolean {
  const goal = plan.assumptions.retirementGoalDate;
  if (!goal || !validIso(goal)) return false;
  const goalKey = monthKey(goal);
  return plan.spending.some((phase) => {
    if (phase.liabilityId) return false;
    const win = spendingWindow(plan, phase);
    return monthKey(win.start || phase.startDate) >= goalKey;
  });
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
    spending: spendingRetiringOn(plan, retireIso),
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

export function recommendedRetirementBluf(plan: Plan, rec: RecommendedRetirement): string {
  const endAge = plan.assumptions.projectionEndAge;
  if (!rec.date) {
    return `No date lets earned pay stop and still cover spending through age ${endAge}.`;
  }
  const when = formatMonthYear(rec.date);
  const ageBit = rec.age != null ? ` (age ${rec.age})` : "";
  const lead = `Earliest earned pay can stop: ${when}${ageBit}.`;
  const goal = plan.assumptions.retirementGoalDate;
  if (!goal || !validIso(goal)) return lead;
  const g = goal.slice(0, 7);
  const r = rec.date.slice(0, 7);
  if (g === r) return `${lead} That is your goal date.`;
  if (g > r) return `${lead} Earlier than the goal date you set.`;
  return `${lead} Your goal date is earlier, so spending does not last to age ${endAge} on that date.`;
}

export function recommendedRetirementCopy(plan: Plan, rec: RecommendedRetirement): string {
  const endAge = plan.assumptions.projectionEndAge;
  if (!rec.date) {
    return `This plan does not cover spending through age ${endAge}. No retirement date makes income plus the portfolio last that long.`;
  }
  const when = formatMonthYear(rec.date);
  const ageBit = rec.age != null ? ` (age ${rec.age})` : "";
  const pulled =
    goalDatedSpending(plan) &&
    monthKey(rec.date) < monthKey(plan.assumptions.retirementGoalDate);
  const lead = `Earliest earned pay can stop: ${when}${ageBit}. Salary, bonus, allowance, and other income end that month, including paychecks that have not started yet. ${
    pulled
      ? "Spending dated to the goal date starts that month too, instead of waiting. "
      : ""
  }Pension, military retired pay, VA, Social Security, other retirement income, and the portfolio then have to cover spending through age ${endAge} on their own.`;
  const goal = plan.assumptions.retirementGoalDate;
  if (!goal || !validIso(goal)) return lead;
  const g = goal.slice(0, 7);
  const r = rec.date.slice(0, 7);
  if (g === r) return `${lead} Your retirement goal date is that month.`;
  if (g > r) {
    return `${lead} That is earlier than the goal date you set. It is the first month this spending still lasts to age ${endAge}, not a date to retire on by itself.`;
  }
  return `${lead} Your goal date is earlier than that, so this plan does not cover spending through age ${endAge} if you retire on the date you set.`;
}
