import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { activeEmployerMatchMonthly, scheduledEmployerMatchMonthly } from "./contribution-now.ts";
import type { ContributionRule, Portfolio } from "./types.ts";

function ira(id: string, extra: Partial<Portfolio> = {}): Portfolio {
  return {
    id,
    name: id,
    kind: "roth_ira",
    owner: "primary",
    currentValue: 10000,
    returnPct: null,
    taxBucket: "roth",
    spendable: true,
    includeInNetWorth: true,
    ...extra,
  };
}

function k401(id: string): Portfolio {
  return {
    id,
    name: "401k Roth",
    kind: "401k_roth",
    owner: "primary",
    currentValue: 50000,
    returnPct: null,
    taxBucket: "roth",
    spendable: true,
    includeInNetWorth: true,
  };
}

function rule(partial: Partial<ContributionRule> & Pick<ContributionRule, "id" | "portfolioId">): ContributionRule {
  return {
    label: partial.id,
    monthlyAmount: 0,
    startDate: "2026-08",
    endDate: null,
    amountMode: "fixed",
    employerMatch: false,
    employerMatchPct: 0,
    ...partial,
  };
}

test("unmatched Roth IRAs do not enter the match total", () => {
  const plan = createDefaultPlan();
  plan.portfolios = [ira("ira-me"), ira("ira-spouse", { owner: "spouse" })];
  plan.contributions = [
    rule({ id: "c-me", portfolioId: "ira-me", monthlyAmount: 500 }),
    rule({ id: "c-sp", portfolioId: "ira-spouse", monthlyAmount: 500 }),
  ];
  assert.equal(activeEmployerMatchMonthly(plan), 0);
});

test("only the checked employer-match dollars count — not the Roth IRAs, not the employee 401k", () => {
  const plan = createDefaultPlan();
  plan.portfolios = [ira("ira-me"), ira("ira-spouse"), k401("k-roth")];
  plan.contributions = [
    rule({ id: "c-me", portfolioId: "ira-me", monthlyAmount: 500 }),
    rule({ id: "c-sp", portfolioId: "ira-spouse", monthlyAmount: 500 }),
    rule({
      id: "c-k",
      portfolioId: "k-roth",
      monthlyAmount: 1000,
      employerMatch: true,
      employerMatchPct: 50,
    }),
  ];
  assert.equal(activeEmployerMatchMonthly(plan), 500);
});

test("month-only end date in the as-of month still counts the checked match", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-08-28";
  plan.portfolios = [k401("k-roth")];
  plan.contributions = [
    rule({
      id: "c-k",
      portfolioId: "k-roth",
      monthlyAmount: 800,
      startDate: "2026-08",
      endDate: "2026-08",
      employerMatch: true,
      employerMatchPct: 100,
    }),
  ];
  assert.equal(activeEmployerMatchMonthly(plan), 800);
});

test("future-dated and already-ended match rules are left out", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-08-01";
  plan.portfolios = [ira("ira-me"), k401("k-roth")];
  plan.contributions = [
    rule({
      id: "future",
      portfolioId: "ira-me",
      monthlyAmount: 500,
      startDate: "2026-09-01",
    }),
    rule({
      id: "ended",
      portfolioId: "k-roth",
      monthlyAmount: 2000,
      startDate: "2025-01",
      endDate: "2026-07",
      employerMatch: true,
      employerMatchPct: 100,
    }),
  ];
  assert.equal(activeEmployerMatchMonthly(plan), 0);
});

test("percent of income plus 100% match: sentence is the match dollars only", () => {
  const plan = createDefaultPlan();
  plan.incomes = [
    {
      id: "inc-job",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 10000,
      startDate: "2026-08-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.portfolios = [k401("k-roth")];
  plan.contributions = [
    rule({
      id: "c-k",
      portfolioId: "k-roth",
      monthlyAmount: 0,
      amountMode: "percent",
      percentOfIncome: 10,
      percentOfIncomeId: "inc-job",
      startDate: "2026-08-01",
      endDate: null,
      employerMatch: true,
      employerMatchPct: 100,
    }),
  ];
  assert.equal(activeEmployerMatchMonthly(plan), 1000);
});

test("unchecked match box is $0 even on a 401k", () => {
  const plan = createDefaultPlan();
  plan.portfolios = [k401("k-roth")];
  plan.contributions = [
    rule({
      id: "c-k",
      portfolioId: "k-roth",
      monthlyAmount: 1000,
      employerMatch: false,
      employerMatchPct: 100,
    }),
  ];
  assert.equal(activeEmployerMatchMonthly(plan), 0);
});

test("401k match still counts when start is later in the as-of month", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-08-01";
  plan.portfolios = [k401("k-roth")];
  plan.contributions = [
    rule({
      id: "c-k",
      portfolioId: "k-roth",
      monthlyAmount: 2000,
      startDate: "2026-08-28",
      employerMatch: true,
      employerMatchPct: 100,
    }),
  ];
  assert.equal(activeEmployerMatchMonthly(plan), 2000);
});

test("Boeing-style: 10% of pay, 100% match, start next month — this month $0, scheduled $4000", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-08-01";
  plan.incomes = [
    {
      id: "bgs",
      name: "Boeing BGS",
      kind: "salary",
      monthlyAmount: 40000,
      startDate: "2026-09-01",
      endDate: "2029-09-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.portfolios = [k401("k-roth")];
  plan.contributions = [
    rule({
      id: "c-k",
      portfolioId: "k-roth",
      monthlyAmount: 0,
      amountMode: "percent",
      percentOfIncome: 10,
      percentOfIncomeId: "bgs",
      startDate: "2026-09",
      endDate: "2029-09",
      employerMatch: true,
      employerMatchPct: 100,
    }),
  ];
  assert.equal(activeEmployerMatchMonthly(plan), 0);
  assert.equal(scheduledEmployerMatchMonthly(plan), 4000);
});

test("percent-of-income match uses the paycheck dates even if the rule still has old start", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-08-01";
  plan.incomes = [
    {
      id: "bgs",
      name: "Boeing BGS",
      kind: "salary",
      monthlyAmount: 40000,
      startDate: "2026-08-01",
      endDate: "2029-09-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.portfolios = [k401("k-roth")];
  plan.contributions = [
    rule({
      id: "c-k",
      portfolioId: "k-roth",
      monthlyAmount: 0,
      amountMode: "percent",
      percentOfIncome: 10,
      percentOfIncomeId: "bgs",
      startDate: "2026-09-01",
      endDate: "2029-09-01",
      employerMatch: true,
      employerMatchPct: 100,
    }),
  ];
  assert.equal(activeEmployerMatchMonthly(plan), 4000);
});

test("end year 0029 is year 2029 — match is not already over", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-08-01";
  plan.incomes = [
    {
      id: "qatar",
      name: "BGS Qatar",
      kind: "salary",
      monthlyAmount: 30000,
      startDate: "2026-08-26",
      endDate: "0029-09-01",
      colaPct: 3,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.portfolios = [k401("k-roth")];
  plan.contributions = [
    rule({
      id: "c-k",
      portfolioId: "k-roth",
      amountMode: "percent",
      percentOfIncome: 10,
      percentOfIncomeId: "qatar",
      startDate: "2026-08-26",
      endDate: "0029-09-01",
      employerMatch: true,
      employerMatchPct: 100,
    }),
  ];
  assert.equal(activeEmployerMatchMonthly(plan), 3000);
});
