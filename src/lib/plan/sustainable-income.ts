import { simulate } from "./engine.ts";
import type { Plan, SimResult } from "./types.ts";

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

function monthBefore(iso: string): string {
  const [year, month] = iso.slice(0, 7).split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 2, 1));
  return date.toISOString().slice(0, 10);
}

/**
 * Retirement lifestyle spending is replaced by the withdrawal being tested.
 * Debt payments stay. Spending before the goal date stays.
 */
function planForDraw(plan: Plan, monthly: number): Plan {
  const start = plan.assumptions.retirementGoalDate;
  if (!start) return plan;
  const cutoff = monthBefore(start);
  const spending = [];
  for (const phase of plan.spending) {
    if (phase.liabilityId) {
      spending.push(phase);
      continue;
    }
    if (phase.startDate >= start) continue;
    if (!phase.endDate || phase.endDate >= start) {
      spending.push({ ...phase, endDate: cutoff });
      continue;
    }
    spending.push(phase);
  }
  if (monthly >= 1) {
    spending.push({
      id: "sustainable-probe",
      label: "Withdrawal",
      monthlyAmount: monthly,
      startDate: start,
      endDate: null,
    });
  }
  return { ...plan, spending };
}

/** True when the withdrawal is paid every retirement year and the investments do not run out. */
function drawLasts(plan: Plan, sim: SimResult): boolean {
  if (sim.depletedAge != null) return false;
  const goal = plan.assumptions.retirementGoalDate;
  if (!goal) return false;
  const startYear = Number(goal.slice(0, 4));
  for (const year of sim.years) {
    if (year.year < startYear) continue;
    const covered = year.income + year.withdrawals;
    const need = year.tax + year.spending;
    if (need > covered + 1) return false;
  }
  return true;
}

function drawnThatYear(plan: Plan, sim: SimResult, incomeYear: number): { nominal: number; real: number } {
  const nominal = sim.years.find((row) => row.year === incomeYear)?.airWithdrawals ?? 0;
  const infl = plan.assumptions.inflationPct / 100;
  const asOfYear = Number(plan.assumptions.asOfDate.slice(0, 4));
  const yearsOut = Math.max(0, incomeYear - (Number.isFinite(asOfYear) ? asOfYear : incomeYear));
  return { nominal, real: nominal / (1 + infl) ** yearsOut };
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

function deflate(plan: Plan, nominal: number, incomeYear: number): number {
  const infl = plan.assumptions.inflationPct / 100;
  const asOfYear = Number(plan.assumptions.asOfDate.slice(0, 4));
  const yearsOut = Math.max(0, incomeYear - (Number.isFinite(asOfYear) ? asOfYear : incomeYear));
  return nominal / (1 + infl) ** yearsOut;
}

/**
 * The most that can be withdrawn from investments each month, in today's
 * dollars, from the retirement goal through longevity, without those
 * investments running out. Nominal and real are that withdrawal in the first
 * full retirement year. Guaranteed pay is included in nominal and real.
 */
export function sustainableRetirementIncome(plan: Plan): SustainableIncome | null {
  const scheduled = simulate(plan).retirement;
  if (!scheduled || scheduled.incomeYear == null || !plan.assumptions.retirementGoalDate) return null;

  const incomeYear = scheduled.incomeYear;
  const read = (monthly: number) => {
    const sim = simulate(planForDraw(plan, monthly));
    const drawn = drawnThatYear(plan, sim, incomeYear);
    const annuityNominal = annuityDrawnNominal(plan, sim, incomeYear);
    return {
      lasts: drawLasts(plan, sim),
      nominal: sim.retirement?.annualIncome ?? 0,
      real: sim.retirement?.annualIncomeReal ?? 0,
      withdrawalNominal: drawn.nominal,
      withdrawalReal: drawn.real,
      annuityNominal,
      annuityReal: deflate(plan, annuityNominal, incomeYear),
    };
  };

  let lo = 0;
  let hi = 2_000;
  let guard = 0;
  while (read(hi).lasts && hi < 1_000_000 && guard < 16) {
    lo = hi;
    hi *= 2;
    guard += 1;
  }

  for (let step = 0; step < 18 && hi - lo > 25; step += 1) {
    const mid = (lo + hi) / 2;
    if (read(mid).lasts) lo = mid;
    else hi = mid;
  }

  const best = read(lo);
  return {
    nominal: best.nominal,
    real: best.real,
    withdrawalNominal: best.withdrawalNominal,
    withdrawalReal: best.withdrawalReal,
    annuityNominal: best.annuityNominal,
    annuityReal: best.annuityReal,
  };
}
