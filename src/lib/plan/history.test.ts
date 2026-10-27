import assert from "node:assert/strict";
import test from "node:test";
import { yearlyRateToMonthly } from "./dates.ts";
import { createDefaultPlan } from "./defaults.ts";
import { simulate, type PlanHistory } from "./engine.ts";
import { MARKET_YEARS } from "./history-table.ts";
import type { Plan } from "./types.ts";

test("market table is the Damodaran annual series, 1928 through 2025", () => {
  assert.equal(MARKET_YEARS[0]?.year, 1928);
  assert.equal(MARKET_YEARS[MARKET_YEARS.length - 1]?.year, 2025);
  assert.equal(MARKET_YEARS.length, 2025 - 1928 + 1);
  const crash = MARKET_YEARS.find((row) => row.year === 2008);
  assert.ok(crash);
  assert.ok(crash.stock < -0.3);
  assert.ok(Math.abs(crash.stock - -0.3655234411) < 1e-12);
});

test("no history leaves year-end spendable on the plan's own rates", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.projectionEndAge = 90;
  plan.assumptions.inflationPct = 3;
  plan.assumptions.defaultReturnPct = 7;
  plan.assumptions.retirementReturnPct = 5;
  plan.assumptions.ordinaryTaxRatePct = 22;
  plan.primary = { name: "Pat", birthDate: "1980-01-01" };
  plan.spouse = { name: "", birthDate: "" };
  plan.children = [];
  plan.stages = [];
  plan.incomes = [
    {
      id: "job",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 8000,
      startDate: "2026-01-01",
      endDate: "2040-01-01",
      colaPct: null,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [
    {
      id: "life",
      label: "Life",
      monthlyAmount: 5000,
      spendKind: "routine",
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  plan.contributions = [];
  plan.liabilities = [];
  plan.portfolios = [
    {
      id: "p",
      name: "Brokerage",
      kind: "taxable",
      owner: "primary",
      currentValue: 250000,
      returnPct: null,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  const sim = simulate(plan);
  const at = (year: number) => sim.years.find((row) => row.year === year);
  assert.equal(at(2026)?.endSpendable.toFixed(2), "281559.40");
  assert.equal(at(2027)?.endSpendable.toFixed(2), "314391.19");
  assert.equal(at(2036)?.endSpendable.toFixed(2), "681997.16");
  assert.equal(at(2070)?.endSpendable.toFixed(2), "0.00");
  assert.equal(sim.depletedAge, 71);
});

test("a two-year history grows investments at the mix and inflates spending and COLA", () => {
  const stock = [0.1, -0.2];
  const bond = [0.02, 0.04];
  const inflation = [0.03, 0.06];
  const share = 0.5;
  const history: PlanHistory = {
    stockShare: share,
    steps: [
      { stock: stock[0], bond: bond[0], inflation: inflation[0] },
      { stock: stock[1], bond: bond[1], inflation: inflation[1] },
    ],
  };
  const plan = barePlan();
  plan.portfolios = [
    {
      id: "inv",
      name: "Brokerage",
      kind: "taxable",
      owner: "primary",
      currentValue: 100_000,
      returnPct: 99,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
    {
      id: "cash",
      name: "Cash",
      kind: "cash",
      owner: "primary",
      currentValue: 40_000,
      returnPct: 0,
      taxBucket: "none",
      spendable: false,
      includeInNetWorth: true,
    },
  ];
  plan.spending = [
    {
      id: "life",
      label: "Life",
      monthlyAmount: 1_000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  plan.assumptions.inflationPct = 9;
  plan.assumptions.ordinaryTaxRatePct = 0;

  let balance = 100_000;
  let index = 1;
  for (let t = 0; t < 24; t++) {
    const year = Math.floor(t / 12);
    const blend = share * stock[year] + (1 - share) * bond[year];
    balance *= 1 + yearlyRateToMonthly(blend);
    balance -= 1_000 * index;
    index *= 1 + yearlyRateToMonthly(inflation[year]);
  }

  const sim = simulate(plan, { history });
  const end = sim.months[23];
  assert.ok(end);
  assert.ok(Math.abs(end.spendableEnd - balance) < 0.01);
  const cash = end.detail?.spendableLines.find((row) => row.id === "cash");
  assert.equal(cash, undefined);
  const netCash = end.detail?.netWorthLines.find((row) => row.id === "cash");
  assert.ok(netCash);
  assert.ok(Math.abs(netCash.amount - 40_000) < 0.01);

  const cola = barePlan();
  cola.incomes = [
    {
      id: "job",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 1_000,
      startDate: "2026-01-01",
      endDate: null,
      colaPct: null,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  cola.assumptions.defaultColaPct = 2.5;
  cola.assumptions.inflationPct = 9;
  const paid = simulate(cola, { history });
  assert.ok(Math.abs((paid.months[0]?.income ?? 0) - 1_000) < 0.01);
  assert.ok(Math.abs((paid.months[12]?.income ?? 0) - 1_000 * (1.03)) < 0.01);
});

test("a historical run ignores Monte Carlo shocks", () => {
  const history: PlanHistory = {
    stockShare: 1,
    steps: [
      { stock: 0.08, bond: 0.02, inflation: 0.02 },
      { stock: 0.08, bond: 0.02, inflation: 0.02 },
    ],
  };
  const plan = barePlan();
  plan.portfolios = [
    {
      id: "inv",
      name: "Brokerage",
      kind: "taxable",
      owner: "primary",
      currentValue: 50_000,
      returnPct: 1,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  const calm = simulate(plan, { history });
  const shocked = simulate(plan, {
    history,
    shocks: { stdev: 0.9, zForYear: () => -4 },
  });
  assert.equal(shocked.months[23]?.spendableEnd.toFixed(2), calm.months[23]?.spendableEnd.toFixed(2));
});

function barePlan(): Plan {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.projectionEndAge = 48;
  plan.assumptions.retirementGoalDate = null;
  plan.primary = { name: "Pat", birthDate: "1980-01-01" };
  plan.spouse = { name: "", birthDate: "" };
  plan.children = [];
  plan.stages = [];
  plan.incomes = [];
  plan.spending = [];
  plan.contributions = [];
  plan.liabilities = [];
  plan.portfolios = [];
  return plan;
}
