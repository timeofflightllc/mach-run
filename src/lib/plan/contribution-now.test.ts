import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { activeEmployerMatchMonthly } from "./contribution-now.ts";
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
