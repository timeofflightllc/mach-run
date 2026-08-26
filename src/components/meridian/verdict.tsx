import { usd } from "@/lib/plan/format";
import type { Plan, SimResult } from "@/lib/plan/types";
import { monthlyIncomeAt, startingSpendable } from "@/lib/plan/engine";
import { monthStart } from "@/lib/plan/dates";

export function Verdict({ plan, sim }: { plan: Plan; sim: SimResult }) {
  const real = plan.assumptions.dollars === "real";
  const atTerm = real ? sim.spendableAtEndReal : sim.spendableAtEnd;
  const unit = real ? "today's dollars" : "nominal";
  const start = startingSpendable(plan);
  const incomeNow = monthlyIncomeAt(plan, monthStart(plan.assumptions.asOfDate));
  const hasIncome =
    incomeNow > 0 ||
    plan.incomes.some((i) => i.monthlyAmount > 0 || (i.ssPia ?? 0) > 0) ||
    sim.years.some((y) => y.income > 1);

  let body: string;
  if (!hasIncome) {
    body = `No income on the run yet. Add a named paycheck under Income — amount, start, and end — and hit Calculate.`;
  } else if (sim.depletedAge != null) {
    body = `Spendable accounts run out at age ${sim.depletedAge} (${sim.depletedYear}). Raise income, extend a stage, or cut spending before that date.`;
  } else {
    body = `The plan funds spending through age ${plan.assumptions.projectionEndAge} with ${usd(atTerm)} remaining (${unit}).`;
  }

  const ret = sim.retirement;
  let retLine = " Set a retirement goal date in Family to key the Spendable strip.";
  if (ret) {
    const pile = usd(real ? ret.spendableReal : ret.spendable);
    const annual = usd(real ? ret.annualIncomeReal : ret.annualIncome);
    const monthly = usd(real ? ret.monthlyIncomeReal : ret.monthlyIncome, true);
    if (ret.now) {
      retLine = ` Retirement goal is this month, so spendable at retirement is the current pile (${pile}). First-year modeled income is ${annual} (${monthly}/mo average).`;
    } else {
      retLine = ` At retirement (${ret.date.slice(0, 7)}) spendable is ${pile} (${unit}). First-year modeled income is ${annual} (${monthly}/mo average).`;
    }
  } else if (plan.assumptions.retirementGoalDate) {
    retLine = "";
  }

  return (
    <div className="rounded-xl bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--color-border)]">
      <p className="font-display text-xl font-medium leading-snug text-fg sm:text-2xl">
        {body}
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Current spendable {usd(start)}. Remaining at age{" "}
        {plan.assumptions.projectionEndAge} is {usd(atTerm)} ({unit}).
        {retLine}
      </p>
    </div>
  );
}
