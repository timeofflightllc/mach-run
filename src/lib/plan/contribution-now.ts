import { yearMonth } from "./dates.ts";
import type { ContributionRule, Plan } from "./types.ts";

function ruleWindow(plan: Plan, rule: ContributionRule): { start: string; end: string | null } {
  if (rule.amountMode === "percent" && rule.percentOfIncomeId) {
    const inc = plan.incomes.find((s) => s.id === rule.percentOfIncomeId);
    if (inc) return { start: inc.startDate || plan.assumptions.asOfDate, end: inc.endDate };
  }
  return {
    start: rule.startDate || plan.assumptions.asOfDate,
    end: rule.endDate,
  };
}

/** True if this rule is in force in the as-of calendar month. */
export function contributionActiveOnAsOf(plan: Plan, rule: ContributionRule): boolean {
  const asOfYm = yearMonth(plan.assumptions.asOfDate);
  const { start, end } = ruleWindow(plan, rule);
  const startYm = yearMonth(start);
  if (!asOfYm || !startYm) return false;
  if (startYm > asOfYm) return false;
  if (end) {
    const endYm = yearMonth(end);
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

/** Match dollars when those rules are on (includes future start dates, skips ended). */
export function scheduledEmployerMatchMonthly(plan: Plan): number {
  return plan.contributions.reduce((sum, rule) => {
    if (!contributionMatchStillScheduled(plan, rule)) return sum;
    return sum + matchMonthlyNow(plan, rule);
  }, 0);
}

/** Match-checked and not already ended — includes rules that start after as-of. */
export function contributionMatchStillScheduled(plan: Plan, rule: ContributionRule): boolean {
  if (!rule.employerMatch) return false;
  const asOfYm = yearMonth(plan.assumptions.asOfDate);
  if (!asOfYm) return false;
  const { end } = ruleWindow(plan, rule);
  if (end) {
    const endYm = yearMonth(end);
    if (endYm && endYm < asOfYm) return false;
  }
  return true;
}