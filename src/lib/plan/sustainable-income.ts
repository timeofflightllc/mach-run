import { simulate } from "./engine.ts";
import type { Plan } from "./types.ts";

export type SustainableIncome = {
  /** Annual income in the same retirement year if spending is as high as the plan can stand. */
  nominal: number;
  real: number;
};

function withExtraSpending(plan: Plan, extraMonthly: number): Plan {
  const start = plan.assumptions.retirementGoalDate;
  if (!start || Math.abs(extraMonthly) < 1) return plan;
  return {
    ...plan,
    spending: [
      ...plan.spending,
      {
        id: "sustainable-probe",
        label: "Probe",
        monthlyAmount: extraMonthly,
        startDate: start,
        endDate: null,
      },
    ],
  };
}

/**
 * The most annual income that first full retirement year can pay, including
 * the withdrawals your spending asks for, without the plan running out.
 * Null when there is no retirement year to measure.
 */
export function sustainableRetirementIncome(plan: Plan): SustainableIncome | null {
  const base = simulate(plan);
  const scheduled = base.retirement;
  if (!scheduled || scheduled.incomeYear == null || !plan.assumptions.retirementGoalDate) return null;

  const read = (extraMonthly: number) => {
    const sim = Math.abs(extraMonthly) < 1 ? base : simulate(withExtraSpending(plan, extraMonthly));
    return {
      lasts: sim.depletedAge == null,
      nominal: sim.retirement?.annualIncome ?? scheduled.annualIncome,
      real: sim.retirement?.annualIncomeReal ?? scheduled.annualIncomeReal,
    };
  };

  const floor = -plan.spending.reduce((sum, phase) => sum + Math.max(0, phase.monthlyAmount), 0);
  let lo = floor;
  let hi = 0;
  if (base.depletedAge == null) {
    lo = 0;
    hi = 2_000;
    let guard = 0;
    while (read(hi).lasts && hi < 1_000_000 && guard < 14) {
      lo = hi;
      hi *= 2;
      guard += 1;
    }
  }

  for (let step = 0; step < 12 && hi - lo > 25; step += 1) {
    const mid = (lo + hi) / 2;
    if (read(mid).lasts) lo = mid;
    else hi = mid;
  }

  const best = read(lo);
  return { nominal: best.nominal, real: best.real };
}
