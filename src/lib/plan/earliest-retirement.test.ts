import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { earliestWorkableRetirement } from "./earliest-retirement.ts";
import type { IncomeStream, Plan, Portfolio, SpendingPhase } from "./types.ts";

function base(): Plan {
  const plan = createDefaultPlan();
  plan.primary = { name: "Test", birthDate: "1980-01-15" };
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.asOfPinned = true;
  plan.assumptions.projectionEndAge = 50;
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultColaPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.assumptions.ordinaryTaxRatePct = 0;
  return plan;
}

function portfolio(value: number): Portfolio {
  return {
    id: "port",
    name: "Brokerage",
    kind: "taxable",
    owner: "primary",
    currentValue: value,
    returnPct: 0,
    taxBucket: "taxable",
    spendable: true,
    includeInNetWorth: true,
  };
}

function spend(amount: number): SpendingPhase {
  return {
    id: "spend",
    label: "Living",
    monthlyAmount: amount,
    startDate: "2026-01-01",
    endDate: null,
  };
}

test("a funded plan can stop earned pay this month", () => {
  const plan = base();
  plan.portfolios = [portfolio(2_000_000)];
  plan.spending = [spend(2_000)];
  const rec = earliestWorkableRetirement(plan);
  assert.equal(rec.date, "2026-01-01");
});

test("a plan that runs out has no workable retirement date", () => {
  const plan = base();
  plan.portfolios = [portfolio(1_000)];
  plan.spending = [spend(8_000)];
  const rec = earliestWorkableRetirement(plan);
  assert.equal(rec.date, null);
});

test("salary that is the only cover lasts until the longevity month", () => {
  const plan = base();
  plan.spending = [spend(4_000)];
  const salary: IncomeStream = {
    id: "job",
    name: "Job",
    kind: "salary",
    monthlyAmount: 5_000,
    startDate: "2026-01-01",
    endDate: null,
    colaPct: 0,
    taxTreatment: "ordinary",
    person: "primary",
  };
  plan.incomes = [salary];
  const rec = earliestWorkableRetirement(plan);
  assert.equal(rec.date, "2030-01-01");
  assert.equal(rec.age, 49);
});
