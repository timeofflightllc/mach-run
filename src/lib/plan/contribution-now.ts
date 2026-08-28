import { inRange, monthStart } from "./dates.ts";
import type { ContributionRule, Plan } from "./types.ts";

/** DateInput stores YYYY-MM; as-of is YYYY-MM-DD. Normalize so the window compares. */
function asDay(iso: string): string {
  const s = iso.trim();
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  return s;
}

/** True if this rule is in force on the plan as-of month (month inputs vs day dates). */
export function contributionActiveOnAsOf(plan: Plan, rule: ContributionRule): boolean {
  const at = monthStart(asDay(plan.assumptions.asOfDate));
  return inRange(at, asDay(rule.startDate), rule.endDate ? asDay(rule.endDate) : null);
}

export function employeeMonthlyNow(plan: Plan, rule: ContributionRule): number {
  if (rule.amountMode === "percent") {
    const inc = plan.incomes.find((s) => s.id === rule.percentOfIncomeId);
    if (inc) return Math.max(0, (inc.monthlyAmount * (rule.percentOfIncome ?? 0)) / 100);
  }
  return Math.max(0, rule.monthlyAmount || 0);
}

export function matchMonthlyNow(plan: Plan, rule: ContributionRule): number {
  // Checkbox is the only switch. Do not infer match from account kind.
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
