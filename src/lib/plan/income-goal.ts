import { simulate } from "./engine.ts";
import { sustainableRetirementIncome } from "./sustainable-income.ts";
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

function lastsMonthly(plan: Plan, includeGuaranteed: boolean): number | null {
  const room = sustainableRetirementIncome(plan);
  if (!room) return null;
  if (includeGuaranteed) return room.real / 12;
  return Math.max(0, room.withdrawalReal - room.annuityReal) / 12;
}

function monthBefore(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 2, 1));
  return date.toISOString().slice(0, 10);
}

function withExtraInvest(plan: Plan, extraMonthly: number): Plan | null {
  const end = plan.assumptions.retirementGoalDate;
  const start = plan.assumptions.asOfDate;
  if (!end || !start || end <= start || extraMonthly < 1) return null;
  const accounts = plan.portfolios.filter((row) => row.kind !== "real_estate");
  const dest =
    accounts.find((row) => row.spendable && row.taxBucket === "taxable" && row.kind !== "annuity") ??
    accounts.find((row) => row.spendable && row.kind !== "annuity") ??
    accounts[0];
  if (!dest) return null;
  return {
    ...plan,
    incomes: [
      ...plan.incomes,
      {
        id: "goal-invest-pay",
        name: "Extra invest",
        kind: "other",
        monthlyAmount: extraMonthly,
        startDate: start,
        endDate: monthBefore(end),
        colaPct: 0,
        taxTreatment: "tax_free",
        person: "primary",
      },
    ],
    contributions: [
      {
        id: "goal-invest-probe",
        label: "Extra invest",
        portfolioId: dest.id,
        monthlyAmount: extraMonthly,
        startDate: start,
        endDate: end,
        endAtRetirement: true,
        amountMode: "fixed",
      },
      ...plan.contributions,
    ],
  };
}

/**
 * Extra dollars to invest each month, from now until the goal date, so the
 * income that still lasts reaches `wantedMonthly` in today's dollars.
 * Zero when the goal is already met. Null when saving more cannot close it.
 */
export function extraMonthlyToReach(
  plan: Plan,
  wantedMonthly: number,
  includeGuaranteed: boolean,
  already: number,
): number | null {
  if (already + 1 >= wantedMonthly) return 0;
  const trial = (extra: number) => {
    const next = withExtraInvest(plan, extra);
    if (!next) return null;
    return lastsMonthly(next, includeGuaranteed);
  };
  const step = 250;
  const raised = trial(step);
  if (raised == null || raised <= already + 1) return null;
  const perDollar = (raised - already) / step;
  let guess = Math.min(100_000, Math.max(step, (wantedMonthly - already) / perDollar));
  const atGuess = trial(guess);
  if (atGuess == null) return Math.ceil(guess / 25) * 25;
  if (Math.abs(atGuess - wantedMonthly) <= 50) return Math.ceil(guess / 25) * 25;
  const slope = guess === step ? perDollar : (atGuess - raised) / (guess - step);
  if (!(slope > 0)) return atGuess >= wantedMonthly ? Math.ceil(guess / 25) * 25 : null;
  const anchor = guess === step ? already : raised;
  const anchorSave = guess === step ? 0 : step;
  const solved = anchorSave + (wantedMonthly - anchor) / slope;
  const capped = Math.min(100_000, Math.max(25, solved));
  const rounded = Math.ceil(capped / 25) * 25;
  const check = trial(rounded);
  if (check == null || check + 25 >= wantedMonthly) return rounded;
  const lift = (check - (atGuess ?? already)) / Math.max(1, rounded - guess);
  if (!(lift > 0)) return rounded;
  return Math.ceil(Math.min(100_000, rounded + (wantedMonthly - check) / lift) / 25) * 25;
}
