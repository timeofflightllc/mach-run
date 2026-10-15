import { simulate } from "./engine.ts";
import type { Plan, SimResult } from "./types.ts";

export type IncomeGap = {
  wanted: number;
  projected: number;
  short: number;
  fill: number;
};

/** First full retirement year versus the monthly paycheck they asked for. Today's dollars. */
export function incomeGap(plan: Plan, sim: SimResult): IncomeGap | null {
  const wanted = plan.assumptions.incomeGoalMonthly ?? 0;
  const projected = sim.retirement?.monthlyIncomeReal ?? null;
  if (wanted <= 0 || projected == null) return null;
  const short = wanted - projected;
  const fill = wanted > 0 ? Math.min(100, Math.max(0, (projected / wanted) * 100)) : 0;
  return { wanted, projected, short, fill };
}

/**
 * Spendable wealth at retirement, in today's dollars, if the first fixed
 * contribution is $100 a month higher from now until it already ends.
 * Null when this run has no fixed contribution to raise.
 */
export function spendableWithExtraSave(plan: Plan, extraMonthly = 100): number | null {
  const rule = plan.contributions.find(
    (row) => (row.amountMode ?? "fixed") === "fixed" && row.monthlyAmount > 0,
  );
  if (!rule) return null;
  const next: Plan = {
    ...plan,
    contributions: plan.contributions.map((row) =>
      row.id === rule.id ? { ...row, monthlyAmount: row.monthlyAmount + extraMonthly } : row,
    ),
  };
  return simulate(next).retirement?.spendableReal ?? null;
}
