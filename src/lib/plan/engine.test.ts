import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { simulate } from "./engine.ts";
import { ssBenefitFromPia } from "./social-security.ts";
import type { IncomeStream } from "./types.ts";

test("SS claiming: FRA is 100%, 62 is 70%, 70 is 124%", () => {
  assert.equal(ssBenefitFromPia(1000, 67, 67), 1000);
  assert.ok(Math.abs(ssBenefitFromPia(1000, 62, 67) - 700) < 1);
  assert.ok(Math.abs(ssBenefitFromPia(1000, 70, 67) - 1240) < 1);
});

test("default plan runs with blank income", () => {
  const plan = createDefaultPlan();
  const result = simulate(plan);
  assert.ok(result.months.length > 400);
  assert.ok(plan.incomes.every((i) => i.monthlyAmount === 0));
  assert.equal(plan.portfolios.length, 0);
  assert.ok(result.years.length > 40);
});

test("named income stages drive the run", () => {
  const plan = createDefaultPlan();
  const salary: IncomeStream = {
    id: "inc-job",
    name: "W-2",
    kind: "salary",
    monthlyAmount: 20000,
    startDate: "2026-08-01",
    endDate: "2036-09-01",
    colaPct: 0,
    taxTreatment: "ordinary",
    person: "primary",
  };
  const pension: IncomeStream = {
    id: "inc-pen",
    name: "Pension",
    kind: "military",
    monthlyAmount: 8000,
    startDate: "2026-09-01",
    endDate: null,
    colaPct: null,
    taxTreatment: "ordinary",
    person: "primary",
  };
  plan.incomes = [salary, pension];
  plan.portfolios = [
    {
      id: "port-test",
      name: "Brokerage",
      kind: "taxable",
      owner: "Joint",
      currentValue: 500000,
      returnPct: null,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.assumptions.sweepPortfolioId = "port-test";
  const result = simulate(plan);
  const sep = result.months.find((m) => m.date.startsWith("2026-09"));
  assert.ok(sep);
  assert.ok((sep?.incomeByKind.salary ?? 0) > 15000);
  assert.ok((sep?.incomeByKind.military ?? 0) > 7000);
  assert.equal(result.depletedAge, null);
  assert.equal(result.stageMarks[0]?.label, "W-2");
});

test("cash flow identity: income + drawn = tax + spend + saved", () => {
  const plan = createDefaultPlan();
  plan.incomes = [
    {
      id: "inc-job",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 20000,
      startDate: "2026-08-01",
      endDate: "2036-09-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.portfolios = [
    {
      id: "port-test",
      name: "Brokerage",
      kind: "taxable",
      owner: "Joint",
      currentValue: 10000,
      returnPct: null,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.assumptions.sweepPortfolioId = "port-test";
  plan.contributions = [
    {
      id: "c-fat",
      label: "Too much",
      portfolioId: "port-test",
      monthlyAmount: 50000,
      startDate: "2026-08-01",
      endDate: "2028-08-01",
    },
  ];
  const result = simulate(plan);
  for (const y of result.years.slice(0, 12)) {
    const left = y.income + y.withdrawals;
    const right = y.tax + y.spending + y.contributions;
    assert.ok(
      Math.abs(left - right) < 2,
      `${y.year}: ${left.toFixed(2)} vs ${right.toFixed(2)}`,
    );
  }
  assert.ok(result.fundingGaps.length > 0);
});

test("retirement goal date snapshots spendable and income", () => {
  const plan = createDefaultPlan();
  plan.assumptions.retirementGoalDate = "2036-09-01";
  plan.incomes = [
    {
      id: "inc-job",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 10000,
      startDate: "2026-08-01",
      endDate: "2036-09-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
    {
      id: "inc-pen",
      name: "Pension",
      kind: "military",
      monthlyAmount: 6000,
      startDate: "2036-09-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  const result = simulate(plan);
  assert.ok(result.retirement);
  assert.equal(result.retirement?.date.slice(0, 7), "2036-09");
  assert.ok((result.retirement?.annualIncome ?? 0) > 60_000);
  const monthly = result.retirement?.monthlyIncome ?? 0;
  const annual = result.retirement?.annualIncome ?? 0;
  assert.ok(Math.abs(monthly * 12 - annual) < 1);
});

test("retirement as-of matches current spendable and monthly = annual/12", () => {
  const plan = createDefaultPlan();
  plan.assumptions.retirementGoalDate = plan.assumptions.asOfDate;
  plan.incomes = [
    {
      id: "inc-job",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 20000,
      startDate: "2026-09-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.portfolios = [
    {
      id: "port-test",
      name: "Brokerage",
      kind: "taxable",
      owner: "Joint",
      currentValue: 847700,
      returnPct: null,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  const result = simulate(plan);
  assert.equal(result.retirement?.now, true);
  assert.equal(result.retirement?.spendable, 847700);
  const a = result.retirement?.annualIncome ?? 0;
  const m = result.retirement?.monthlyIncome ?? 0;
  assert.ok(a > 100000);
  assert.ok(Math.abs(m * 12 - a) < 1);
});
