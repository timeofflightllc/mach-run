import { yearMonth } from "./dates.ts";
import type { ContributionRule, Plan } from "./types.ts";

/** True if this rule is in force in the as-of calendar month. */
export function contributionActiveOnAsOf(plan: Plan, rule: ContributionRule): boolean {
  const asOfYm = yearMonth(plan.assumptions.asOfDate);
  const startYm = yearMonth(rule.startDate || plan.assumptions.asOfDate);
  if (!asOfYm || !startYm) return false;
  if (startYm > asOfYm) return false;
  if (rule.endDate) {
    const endYm = yearMonth(rule.endDate);
    if (endYm && endYm < asOfYm) return false;
  }
  return true;
}

export function employeeMonthlyNow(plan: Plan, rule: ContributionRule): number {
  if (rule.amountMode === "percent") {
    const inc = plan.incomes.find((s) => s.id === rule.percentOfIncomeId);
    if (inc) return Math.max(0, (inc.monthlyAmount * (rule.percentOfIncome ?? 0)) / 100);
  }
  return Math.max(0, rule.monthlyAmount || 0);
}

export function matchMonthlyNow(plan: Plan, rule: ContributionRule): number {
  if (!rule.employerMatch) return 0;
  const pct = Math.max(0, Math.min(100, rule.employerMatchPct ?? 0));
  return employeeMonthlyNow(plan, rule) * (pct / 100);
}

/** Employer-match dollars this month — only rules where the user checked the match box. */
export function activeEmployerMatchMonthly(plan: Plan): number {
  return plan.contributions.reduce((sum, rule) => {
    if (!contributionActiveOnAsOf(plan, rule)) return sum;
    return sum + matchMonthlyNow(plan, rule);
  }, 0);
}
