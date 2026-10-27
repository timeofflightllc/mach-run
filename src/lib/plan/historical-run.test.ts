import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { runHistorical, historicalSentence } from "./historical-run.ts";
import type { MarketYear } from "./history-table.ts";
import type { Plan } from "./types.ts";

const tiny: MarketYear[] = [
  { year: 2000, stock: 5, bond: 0, inflation: 0 },
  { year: 2001, stock: -0.5, bond: 0, inflation: 0 },
];

test("one good year survives and one bad year fails", () => {
  const count = runHistorical(oneMonthPlan(), 100, tiny);
  // $1,000 grown one month at +500% is about $1,161, then $1,100 spending leaves a balance.
  // The same month at −50% is about $944, which cannot pay $1,100.
  assert.deepEqual(count, { survived: 1, total: 2, failedStartYears: [2001] });
});

test("a start year without a full stretch is not counted", () => {
  const table: MarketYear[] = [
    { year: 2000, stock: 0, bond: 0, inflation: 0 },
    { year: 2001, stock: 0, bond: 0, inflation: 0 },
    { year: 2002, stock: 0, bond: 0, inflation: 0 },
  ];
  const plan = oneMonthPlan();
  plan.assumptions.projectionEndAge = 47;
  plan.portfolios[0].currentValue = 10_000;
  plan.spending[0].monthlyAmount = 1;
  const count = runHistorical(plan, 100, table);
  // Two years long, so 2002 has no following year. $1 a month cannot empty $10,000 at a 0% return.
  assert.deepEqual(count, { survived: 2, total: 2, failedStartYears: [] });
});

test("the result line names the percent and the failed years", () => {
  assert.equal(
    historicalSentence({ survived: 58, total: 61, failedStartYears: [1966, 1968, 1969] }, 60),
    "Survived 58 of 61 historical stretches at 60% stocks. Failed 1966, 1968, and 1969.",
  );
  assert.equal(
    historicalSentence({ survived: 61, total: 61, failedStartYears: [] }, 60),
    "Survived all 61 historical stretches at 60% stocks.",
  );
  assert.equal(
    historicalSentence({ survived: 1, total: 2, failedStartYears: [2001] }, 100),
    "Survived 1 of 2 historical stretches at 100% stocks. Failed 2001.",
  );
});

function oneMonthPlan(): Plan {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.projectionEndAge = 46;
  plan.assumptions.retirementGoalDate = null;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.assumptions.inflationPct = 0;
  plan.primary = { name: "Pat", birthDate: "1980-01-01" };
  plan.spouse = { name: "", birthDate: "" };
  plan.children = [];
  plan.stages = [];
  plan.incomes = [];
  plan.contributions = [];
  plan.liabilities = [];
  plan.portfolios = [
    {
      id: "inv",
      name: "Brokerage",
      kind: "taxable",
      owner: "primary",
      currentValue: 1_000,
      returnPct: 0,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.spending = [
    {
      id: "life",
      label: "Life",
      monthlyAmount: 1_100,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  return plan;
}
