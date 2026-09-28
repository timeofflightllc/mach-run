import assert from "node:assert/strict";
import test from "node:test";
import { openAdvisories, overlapMonth } from "./advisories.ts";
import { createDefaultPlan } from "./defaults.ts";
import type { Plan } from "./types.ts";

test("overlap month is the later start when both are still open", () => {
  assert.equal(
    overlapMonth(
      { start: "2030-01-01", end: null },
      { start: "2026-08-01", end: null },
    )?.slice(0, 7),
    "2030-01",
  );
  assert.equal(
    overlapMonth(
      { start: "2030-01-01", end: null },
      { start: "2026-08-01", end: "2029-12-01" },
    ),
    null,
  );
});

function twoSalaries(): Plan {
  const plan = createDefaultPlan();
  plan.incomes = [
    {
      id: "a",
      name: "Boeing",
      kind: "salary",
      monthlyAmount: 10000,
      startDate: "2026-08-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
    {
      id: "b",
      name: "Guard",
      kind: "salary",
      monthlyAmount: 2000,
      startDate: "2028-01-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
    {
      id: "va",
      name: "VA",
      kind: "va",
      monthlyAmount: 4000,
      startDate: "2026-08-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "tax_free",
      person: "primary",
    },
  ];
  return plan;
}

test("two salaries on the same months ask once on the later card", () => {
  const rows = openAdvisories(twoSalaries());
  const income = rows.filter((row) => row.kind === "overlap" && row.step === "income");
  assert.equal(income.length, 1);
  assert.equal(income[0].cardId, "card-income-b");
  assert.match(income[0].body, /Boeing/);
  assert.match(income[0].body, /paid/);
  assert.equal(income[0].endOther?.id, "a");
  assert.equal(income[0].endOther?.endDate.slice(0, 7), "2027-12");
  assert.equal(income[0].detail.kind, "overlap");
  if (income[0].detail.kind === "overlap") {
    assert.equal(income[0].detail.other.name, "Boeing");
    assert.equal(income[0].detail.current.name, "Guard");
    assert.equal(income[0].detail.current.amount + income[0].detail.other.amount, 12000);
  }
});

test("a kept answer stays kept until an amount changes", () => {
  const plan = twoSalaries();
  const first = openAdvisories(plan).find((row) => row.cardId === "card-income-b");
  assert.ok(first);
  plan.confirmations = [{ id: first.id, fingerprint: first.fingerprint }];
  assert.equal(
    openAdvisories(plan).some((row) => row.id === first.id),
    false,
  );
  plan.incomes[1].monthlyAmount = 3000;
  assert.equal(
    openAdvisories(plan).some((row) => row.cardId === "card-income-b"),
    true,
  );
});

test("a contribution larger than income minus taxes minus spending is named on that card", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.assumptions.defaultColaPct = 0;
  plan.primary.birthDate = "1979-01-01";
  plan.assumptions.projectionEndAge = 50;
  plan.incomes = [
    {
      id: "job",
      name: "Job",
      kind: "salary",
      monthlyAmount: 2000,
      startDate: "2026-01-01",
      endDate: "2026-12-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [
    {
      id: "sp",
      label: "Spend",
      monthlyAmount: 1500,
      startDate: "2026-01-01",
      endDate: "2026-12-01",
    },
  ];
  plan.portfolios = [
    {
      id: "t",
      name: "Taxable",
      kind: "taxable",
      owner: "primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.contributions = [
    {
      id: "c",
      label: "Too much",
      portfolioId: "t",
      monthlyAmount: 2000,
      startDate: "2026-01-01",
      endDate: "2026-12-01",
    },
  ];
  const cash = openAdvisories(plan).filter((row) => row.kind === "cash");
  assert.equal(cash.length, 1);
  assert.match(cash[0].body, /\$2,000 a month, \$24,000 for the year/);
  assert.equal(cash[0].cardId, "card-contributions-c");
});

test("a November start counts November and December, not one month of $5,000", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.assumptions.defaultColaPct = 0;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.primary.birthDate = "1979-01-01";
  plan.assumptions.projectionEndAge = 51;
  plan.incomes = [];
  plan.spending = [];
  plan.portfolios = [
    {
      id: "t",
      name: "Fidelity Non Qualified",
      kind: "taxable",
      owner: "primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.contributions = [
    {
      id: "c",
      label: "Non Qualified post BGS",
      portfolioId: "t",
      monthlyAmount: 5000,
      startDate: "2029-11-01",
      endDate: "2040-11-25",
    },
  ];
  const cash = openAdvisories(plan).find((row) => row.kind === "cash");
  assert.ok(cash);
  assert.match(cash.body, /November and December 2029/);
  assert.match(cash.body, /\$5,000 a month, \$10,000 for those two months/);
  assert.doesNotMatch(cash.body, /asked to invest \$5,000/);
  assert.equal(cash.detail.kind, "cash");
  if (cash.detail.kind === "cash") {
    assert.deepEqual(
      cash.detail.months.map((month) => month.date.slice(0, 7)),
      ["2029-11", "2029-12"],
    );
    assert.equal(cash.detail.months[0].asked, 5000);
    assert.equal(cash.detail.months[1].asked, 5000);
    assert.equal(cash.detail.months[0].got, 0);
    assert.equal(cash.detail.months[1].got, 0);
  }
});

test("an IRS cap stop is not a paycheck conflict", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2027-01-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultColaPct = 0;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.primary.birthDate = "1979-01-01";
  plan.assumptions.projectionEndAge = 50;
  plan.incomes = [
    {
      id: "bgs",
      name: "Boeing BGS",
      kind: "salary",
      monthlyAmount: 30000,
      startDate: "2027-01-01",
      endDate: "2027-12-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [];
  plan.portfolios = [
    {
      id: "k",
      name: "Boeing 401k Roth",
      kind: "401k_roth",
      owner: "primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "roth",
      spendable: false,
      includeInNetWorth: true,
    },
  ];
  plan.contributions = [
    {
      id: "c",
      label: "Matt 401k Roth",
      portfolioId: "k",
      monthlyAmount: 0,
      amountMode: "percent",
      percentOfIncome: 10,
      percentOfIncomeId: "bgs",
      startDate: "2027-01-01",
      endDate: "2027-12-01",
      capToIrsLimit: true,
    },
  ];
  assert.equal(
    openAdvisories(plan).some((row) => row.kind === "cash"),
    false,
  );
});

test("the IRS cap does not hide a real paycheck shortfall", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2027-01-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultColaPct = 0;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.primary.birthDate = "1979-01-01";
  plan.assumptions.projectionEndAge = 50;
  plan.incomes = [
    {
      id: "bgs",
      name: "Boeing BGS",
      kind: "salary",
      monthlyAmount: 1000,
      startDate: "2027-01-01",
      endDate: "2027-12-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [];
  plan.portfolios = [
    {
      id: "k",
      name: "Boeing 401k Roth",
      kind: "401k_roth",
      owner: "primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "roth",
      spendable: false,
      includeInNetWorth: true,
    },
  ];
  plan.contributions = [
    {
      id: "c",
      label: "Matt 401k Roth",
      portfolioId: "k",
      monthlyAmount: 3000,
      startDate: "2027-01-01",
      endDate: "2027-12-01",
      capToIrsLimit: true,
    },
  ];
  const cash = openAdvisories(plan).find((row) => row.kind === "cash");
  assert.ok(cash);
  assert.match(cash.body, /\$3,000 a month, \$36,000 for the year/);
  assert.match(cash.body, /\$12,000 of that will be invested/);
});

test("a $1 contribution is invested when the paycheck has room", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.assumptions.defaultColaPct = 0;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.primary.birthDate = "1979-01-01";
  plan.assumptions.projectionEndAge = 50;
  plan.incomes = [
    {
      id: "pay",
      name: "Pay",
      kind: "salary",
      monthlyAmount: 10000,
      startDate: "2026-01-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [];
  plan.portfolios = [
    {
      id: "t",
      name: "Taxable",
      kind: "taxable",
      owner: "primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.contributions = [
    {
      id: "c",
      label: "Test",
      portfolioId: "t",
      monthlyAmount: 1,
      startDate: "2027-01-01",
      endDate: "2027-12-01",
    },
  ];
  assert.equal(
    openAdvisories(plan).some((row) => row.kind === "cash"),
    false,
  );
});

test("a $1 contribution with no paycheck says the paycheck is already short", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.assumptions.defaultColaPct = 0;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.primary.birthDate = "1979-01-01";
  plan.assumptions.projectionEndAge = 50;
  plan.incomes = [];
  plan.spending = [];
  plan.portfolios = [
    {
      id: "t",
      name: "Taxable",
      kind: "taxable",
      owner: "primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.contributions = [
    {
      id: "c",
      label: "Test",
      portfolioId: "t",
      monthlyAmount: 1,
      startDate: "2027-01-01",
      endDate: "2027-12-01",
    },
  ];
  const cash = openAdvisories(plan).find((row) => row.kind === "cash");
  assert.ok(cash);
  assert.match(cash.body, /This is not an IRS limit/);
  assert.match(cash.body, /nothing is left to invest/);
  assert.match(cash.body, /income \$0\.00/);
  if (cash.detail.kind === "cash") {
    assert.equal(cash.detail.months[0].got, 0);
    assert.ok(cash.detail.months[0].leftover <= 0.5);
  }
});
