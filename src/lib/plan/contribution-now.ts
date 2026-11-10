import { earlierEnd, validIso, yearMonth } from "./dates.ts";
import { streamWindow } from "./engine.ts";
import type { ContributionRule, Plan } from "./types.ts";

function isWorkplace(kind: string): boolean {
  return kind === "401k" || kind === "401k_roth" || kind === "tsp" || kind === "tsp_roth";
}

function ruleWindow(plan: Plan, rule: ContributionRule): { start: string; end: string | null } {
  if (rule.amountMode === "percent" && rule.percentOfIncomeId) {
    const inc = plan.incomes.find((s) => s.id === rule.percentOfIncomeId);
    if (inc) {
      const end =
        rule.stopDate && validIso(rule.stopDate) ? earlierEnd(inc.endDate, rule.stopDate) : inc.endDate;
      return { start: inc.startDate || plan.assumptions.asOfDate, end };
    }
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

function paycheckOpen(plan: Plan, incomeId: string | null | undefined): boolean {
  if (!incomeId) return false;
  const inc = plan.incomes.find((s) => s.id === incomeId);
  if (!inc) return false;
  const asOfYm = yearMonth(plan.assumptions.asOfDate);
  const win = streamWindow(plan, inc);
  const startYm = yearMonth(win.start);
  if (!asOfYm || !startYm || startYm > asOfYm) return false;
  if (win.end) {
    const endYm = yearMonth(win.end);
    if (endYm && endYm < asOfYm) return false;
  }
  return true;
}

/** Percent of the named paycheck. Not included in the match total. $0 unless the box is on. */
export function directMonthlyNow(plan: Plan, rule: ContributionRule): number {
  if (!rule.employerDirect) return 0;
  const dest = plan.portfolios.find((p) => p.id === rule.portfolioId);
  if (!dest || !isWorkplace(dest.kind)) return 0;
  const pct = Math.max(0, Math.min(100, rule.employerDirectPct ?? 0));
  const inc = plan.incomes.find((s) => s.id === rule.employerDirectIncomeId);
  if (!inc) return 0;
  return Math.max(0, inc.monthlyAmount || 0) * (pct / 100);
}

export function activeEmployerDirectMonthly(plan: Plan): number {
  return plan.contributions.reduce((sum, rule) => {
    if (!contributionActiveOnAsOf(plan, rule)) return sum;
    if (!paycheckOpen(plan, rule.employerDirectIncomeId)) return sum;
    return sum + directMonthlyNow(plan, rule);
  }, 0);
}

/** Direct dollars still ahead, including a start after as-of. Ended rules are left out. */
export function scheduledEmployerDirectMonthly(plan: Plan): number {
  return plan.contributions.reduce((sum, rule) => {
    if (!rule.employerDirect) return sum;
    const asOfYm = yearMonth(plan.assumptions.asOfDate);
    if (!asOfYm) return sum;
    const { end } = ruleWindow(plan, rule);
    if (end) {
      const endYm = yearMonth(end);
      if (endYm && endYm < asOfYm) return sum;
    }
    const inc = plan.incomes.find((s) => s.id === rule.employerDirectIncomeId);
    if (inc) {
      const win = streamWindow(plan, inc);
      if (win.end) {
        const endYm = yearMonth(win.end);
        if (endYm && endYm < asOfYm) return sum;
      }
    }
    return sum + directMonthlyNow(plan, rule);
  }, 0);
}