import { addMonth, dateAtAge, iso, monthStart, yearlyRateToMonthly } from "./dates.ts";
import { simulate } from "./engine.ts";
import type { Plan, Portfolio, SimResult } from "./types.ts";

export type SustainableIncome = {
  /** Annual income in the same retirement year if spending is as high as the plan can stand. */
  nominal: number;
  real: number;
  /** Portfolio withdrawals inside that income. Not pension, VA, Social Security, or military pay. */
  withdrawalNominal: number;
  withdrawalReal: number;
  /** Non-qualified annuity withdrawals inside the withdrawal figures. */
  annuityNominal: number;
  annuityReal: number;
};

const WITHDRAW_ORDER = ["none", "taxable", "pre_tax", "roth"] as const;

function annualReturn(plan: Plan, portfolio: Portfolio, monthKey: string): number {
  const goal = plan.assumptions.retirementGoalDate?.slice(0, 7) ?? "";
  const keepsOwn =
    portfolio.kind === "real_estate" || portfolio.kind === "cash" || portfolio.kind === "annuity";
  if (goal && monthKey >= goal && !keepsOwn) {
    const pct = plan.assumptions.retirementReturnPct;
    return (Number.isFinite(pct) ? pct : 5) / 100;
  }
  return (portfolio.returnPct ?? plan.assumptions.defaultReturnPct) / 100;
}

/** Spendable investments at the goal date, nominal dollars. The house is not one of them. */
function pileAtGoal(
  plan: Plan,
  sim: SimResult,
): { accounts: Portfolio[]; values: Map<string, number>; index: number } | null {
  const goal = plan.assumptions.retirementGoalDate;
  if (!goal) return null;
  const accounts = plan.portfolios.filter((row) => row.spendable && row.kind !== "real_estate");
  if (accounts.length === 0) return null;
  const values = new Map<string, number>();
  let index = 1;
  for (const row of sim.balancesAtRetirement ?? []) {
    if (row.real > 100 && row.nominal > 0) index = row.nominal / row.real;
    if (accounts.some((account) => account.id === row.id)) values.set(row.id, Math.max(0, row.nominal));
  }
  for (const account of accounts) {
    if (!values.has(account.id)) values.set(account.id, Math.max(0, account.currentValue));
  }
  return { accounts, values, index: Math.max(index, 1e-9) };
}

function canWithdraw(
  plan: Plan,
  accounts: Portfolio[],
  start: Map<string, number>,
  monthlyReal: number,
  index: number,
): boolean {
  const goal = plan.assumptions.retirementGoalDate;
  if (!goal) return false;
  const values = new Map(start);
  const taxR = plan.assumptions.ordinaryTaxRatePct / 100;
  const inflate = yearlyRateToMonthly(plan.assumptions.inflationPct / 100);
  const endKey = iso(monthStart(iso(dateAtAge(plan.primary.birthDate, plan.assumptions.projectionEndAge)))).slice(0, 7);
  let cursor = monthStart(goal);
  let need = monthlyReal * index;
  for (let guard = 0; guard < 1200; guard += 1) {
    const key = iso(cursor).slice(0, 7);
    if (key > endKey) return true;
    for (const account of accounts) {
      const rate = yearlyRateToMonthly(annualReturn(plan, account, key));
      values.set(account.id, (values.get(account.id) ?? 0) * (1 + rate));
    }
    let remaining = need;
    for (const bucket of WITHDRAW_ORDER) {
      if (remaining <= 0.5) break;
      for (const account of accounts) {
        if (account.taxBucket !== bucket || remaining <= 0.5) continue;
        const balance = values.get(account.id) ?? 0;
        if (balance <= 0) continue;
        if (bucket === "pre_tax" && taxR < 0.99) {
          const gross = Math.min(balance, remaining / (1 - taxR));
          values.set(account.id, balance - gross);
          remaining -= gross * (1 - taxR);
        } else {
          const take = Math.min(balance, remaining);
          values.set(account.id, balance - take);
          remaining -= take;
        }
      }
    }
    if (remaining > 1) return false;
    need *= 1 + inflate;
    cursor = addMonth(cursor);
  }
  return true;
}

function guaranteedMonthlyReal(plan: Plan, sim: SimResult, index: number): number {
  const goal = plan.assumptions.retirementGoalDate?.slice(0, 7);
  if (!goal) return 0;
  const month = sim.months.find((row) => row.date.slice(0, 7) === goal);
  return (month?.guaranteed ?? 0) / index;
}

/**
 * Illustration only. The most that can be withdrawn from the investments
 * held at the retirement goal, in today's dollars, through longevity.
 * It does not read the spending you typed, and it does not change the plan.
 */
export function sustainableRetirementIncome(plan: Plan, sim?: SimResult): SustainableIncome | null {
  if (!plan.assumptions.retirementGoalDate) return null;
  const ran = sim ?? simulate(plan);
  const pile = pileAtGoal(plan, ran);
  if (!pile) return null;

  let lo = 0;
  let hi = 2_000;
  let guard = 0;
  while (canWithdraw(plan, pile.accounts, pile.values, hi, pile.index) && hi < 1_000_000 && guard < 18) {
    lo = hi;
    hi *= 2;
    guard += 1;
  }
  for (let step = 0; step < 22 && hi - lo > 1; step += 1) {
    const mid = (lo + hi) / 2;
    if (canWithdraw(plan, pile.accounts, pile.values, mid, pile.index)) lo = mid;
    else hi = mid;
  }

  const monthly = lo;
  const guaranteed = guaranteedMonthlyReal(plan, ran, pile.index);
  const withdrawalReal = monthly * 12;
  const withdrawalNominal = withdrawalReal * pile.index;
  return {
    nominal: withdrawalNominal + guaranteed * 12 * pile.index,
    real: withdrawalReal + guaranteed * 12,
    withdrawalNominal,
    withdrawalReal,
    annuityNominal: 0,
    annuityReal: 0,
  };
}

/** Annuity account draws in that calendar year, nominal dollars. */
export function annuityDrawnNominal(plan: Plan, sim: SimResult, incomeYear: number): number {
  const ids = new Set(plan.portfolios.filter((row) => row.kind === "annuity").map((row) => row.id));
  if (ids.size === 0) return 0;
  const year = sim.years.find((row) => row.year === incomeYear);
  return (year?.drawnLines ?? [])
    .filter((line) => ids.has(line.id))
    .reduce((sum, line) => sum + line.amount, 0);
}
