import assert from "node:assert/strict";
import test from "node:test";
import { yearlyRateToMonthly } from "./dates.ts";
import { createDefaultPlan } from "./defaults.ts";
import { simulate } from "./engine.ts";
import { applyShock } from "./monte-carlo.ts";
import type { AccountKind, Plan } from "./types.ts";

const START = 100_000;

function quietPlan(kind: AccountKind, returnPct: number | null): Plan {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.defaultReturnPct = 7;
  plan.incomes = [];
  plan.spending = [];
  plan.contributions = [];
  plan.liabilities = [];
  plan.portfolios = [
    {
      id: "port-one",
      name: "One",
      kind,
      owner: "primary",
      currentValue: START,
      returnPct,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  return plan;
}

function afterTwelve(plan: Plan, shocks?: { stdev: number; zForYear: (year: number) => number }) {
  const sim = simulate(plan, shocks ? { shocks } : undefined);
  const month = sim.months[11];
  assert.ok(month);
  assert.equal(month.date.slice(0, 7), "2026-12");
  return month.spendableEnd;
}

function compounded(statedAnnual: number) {
  const monthly = yearlyRateToMonthly(statedAnnual);
  return START * (1 + monthly) ** 12;
}

test("no shocks compounds the stated return and matches a call with no shocks field", () => {
  const plan = quietPlan("taxable", 7);
  const plain = afterTwelve(plan);
  const emptyOpts = simulate(plan, {}).months[11]?.spendableEnd;
  assert.equal(plain, emptyOpts);
  assert.ok(Math.abs(plain - compounded(0.07)) < 0.01);
});

test("a blank return uses the family default and is shocked", () => {
  const plan = quietPlan("taxable", null);
  const shocked = afterTwelve(plan, { stdev: 0.15, zForYear: () => 1 });
  assert.ok(Math.abs(shocked - compounded(applyShock(0.07, 1, 0.15))) < 0.01);
  assert.ok(Math.abs(shocked - compounded(0.07)) > 1);
});

test("an explicit 0% account is not shocked", () => {
  const plan = quietPlan("cash", 0);
  const plain = afterTwelve(plan);
  const shocked = afterTwelve(plan, { stdev: 0.15, zForYear: () => 1 });
  assert.ok(Math.abs(plain - START) < 0.01);
  assert.ok(Math.abs(shocked - plain) < 0.01);
});

test("real estate with a positive return is not shocked", () => {
  const plan = quietPlan("real_estate", 7);
  const plain = afterTwelve(plan);
  const shocked = afterTwelve(plan, { stdev: 0.15, zForYear: () => 1 });
  assert.ok(Math.abs(plain - compounded(0.07)) < 0.01);
  assert.ok(Math.abs(shocked - plain) < 0.01);
});

test("z of 1 and a 15% swing compounds applyShock, once per calendar year", () => {
  const plan = quietPlan("taxable", 7);
  let calls = 0;
  const sim = simulate(plan, {
    shocks: {
      stdev: 0.15,
      zForYear: () => {
        calls += 1;
        return 1;
      },
    },
  });
  const shocked = sim.months[11]?.spendableEnd ?? 0;
  const years = new Set(sim.months.map((month) => month.year)).size;
  assert.equal(calls, years);
  assert.ok(calls < sim.months.length);
  assert.ok(Math.abs(shocked - compounded(applyShock(0.07, 1, 0.15))) < 0.01);
});

test("a non-finite z is treated as zero", () => {
  const plan = quietPlan("taxable", 7);
  const plain = afterTwelve(plan);
  const shocked = afterTwelve(plan, { stdev: 0.15, zForYear: () => Number.NaN });
  assert.ok(Math.abs(shocked - plain) < 0.01);
});
