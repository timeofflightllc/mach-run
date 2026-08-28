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

test("non-qualified annuity withdrawals tax earnings before basis", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1970-01-01";
  plan.assumptions.ordinaryTaxRatePct = 20;
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.incomes = [];
  plan.spending = [
    {
      id: "sp-1",
      label: "Spend",
      monthlyAmount: 4000,
      startDate: "2026-08-01",
      endDate: null,
    },
  ];
  plan.portfolios = [
    {
      id: "ann",
      name: "Annuity",
      kind: "annuity",
      owner: "Primary",
      currentValue: 100_000,
      costBasis: 80_000,
      returnPct: 0,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  const result = simulate(plan);
  const m0 = result.months[0];
  assert.ok(m0);
  assert.ok(Math.abs(m0.withdrawals - 5000) < 2);
  assert.ok(Math.abs(m0.spendableEnd - 95_000) < 2);
});

test("pension and other retirement count as guaranteed cash flow", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1970-01-01";
  plan.incomes = [
    {
      id: "frs",
      name: "Susan FRS",
      kind: "pension",
      monthlyAmount: 3000,
      startDate: "2026-08-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "spouse",
    },
    {
      id: "job",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 5000,
      startDate: "2026-08-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [];
  const result = simulate(plan);
  const m0 = result.months[0];
  assert.ok(m0);
  assert.ok(Math.abs(m0.income - 8000) < 1);
  assert.ok(Math.abs(m0.guaranteed - 3000) < 1);
});

test("percent-of-income contribution plus employer match", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1970-01-01";
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.incomes = [
    {
      id: "job",
      name: "Boeing",
      kind: "salary",
      monthlyAmount: 10000,
      startDate: "2026-08-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [
    {
      id: "sp-1",
      label: "Spend",
      monthlyAmount: 0,
      startDate: "2026-08-01",
      endDate: null,
    },
  ];
  plan.portfolios = [
    {
      id: "k",
      name: "401k",
      kind: "401k",
      owner: "Primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "pre_tax",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.contributions = [
    {
      id: "c1",
      label: "Deferral",
      portfolioId: "k",
      monthlyAmount: 0,
      startDate: "2026-08-01",
      endDate: null,
      amountMode: "percent",
      percentOfIncome: 10,
      percentOfIncomeId: "job",
      employerMatch: true,
      employerMatchPct: 50,
    },
  ];
  const result = simulate(plan);
  const m0 = result.months[0];
  assert.ok(m0);
  // 10% of 10k = 1000 employee + 500 match
  assert.ok(Math.abs(m0.contributions - 1500) < 2);
  assert.ok(Math.abs(m0.spendableEnd - 1500) < 2);
});

test("percent contribution and match end when the income ends", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1970-01-01";
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.incomes = [
    {
      id: "job",
      name: "Boeing",
      kind: "salary",
      monthlyAmount: 10000,
      startDate: "2026-08-01",
      endDate: "2027-08-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [
    {
      id: "sp-1",
      label: "Spend",
      monthlyAmount: 0,
      startDate: "2026-08-01",
      endDate: null,
    },
  ];
  plan.portfolios = [
    {
      id: "k",
      name: "401k",
      kind: "401k",
      owner: "Primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "pre_tax",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.contributions = [
    {
      id: "c1",
      label: "Deferral",
      portfolioId: "k",
      monthlyAmount: 99999,
      startDate: "2020-01-01",
      endDate: null,
      amountMode: "percent",
      percentOfIncome: 10,
      percentOfIncomeId: "job",
      employerMatch: true,
      employerMatchPct: 100,
    },
  ];
  const result = simulate(plan);
  const during = result.months.find((m) => m.date.startsWith("2026-08"));
  const after = result.months.find((m) => m.date.startsWith("2027-09"));
  assert.ok(during && after);
  assert.ok(during.contributions > 1000);
  assert.ok(after.contributions < 1);
});

test("IRS cap: $3000/mo 401k stops when $24,500 is full; match follows", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1985-06-01";
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.incomes = [
    {
      id: "job",
      name: "Boeing",
      kind: "salary",
      monthlyAmount: 20000,
      startDate: "2026-01-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [
    {
      id: "sp-1",
      label: "Spend",
      monthlyAmount: 0,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  plan.portfolios = [
    {
      id: "k",
      name: "401k Roth",
      kind: "401k_roth",
      owner: "primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "roth",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.contributions = [
    {
      id: "c1",
      label: "Boeing",
      portfolioId: "k",
      monthlyAmount: 3000,
      startDate: "2026-01-01",
      endDate: null,
      amountMode: "fixed",
      employerMatch: true,
      employerMatchPct: 100,
      capToIrsLimit: true,
    },
  ];
  const result = simulate(plan);
  const jan = result.months.find((m) => m.date.startsWith("2026-01"));
  const sep = result.months.find((m) => m.date.startsWith("2026-09"));
  const oct = result.months.find((m) => m.date.startsWith("2026-10"));
  assert.ok(jan && sep && oct);
  assert.ok(Math.abs(jan.contributions - 6000) < 2);
  assert.ok(Math.abs(sep.contributions - 1000) < 2);
  assert.ok(oct.contributions < 1);
});



