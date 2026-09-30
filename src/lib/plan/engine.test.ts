import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { openAdvisories } from "./advisories.ts";
import { simulate } from "./engine.ts";
import { remainingLiability } from "./liability.ts";
import { remainingMortgage } from "./mortgage.ts";
import { ssBenefitFromPia, ssScheduleDates } from "./social-security.ts";
import type { IncomeStream } from "./types.ts";

test("SS claiming: FRA is 100%, 62 is 70%, 70 is 124%", () => {
  assert.equal(ssBenefitFromPia(1000, 67, 67), 1000);
  assert.ok(Math.abs(ssBenefitFromPia(1000, 62, 67) - 700) < 1);
  assert.ok(Math.abs(ssBenefitFromPia(1000, 70, 67) - 1240) < 1);
});

test("SS dates: start at claiming age, end at projection age", () => {
  const window = ssScheduleDates("1979-06-15", 67, 95);
  assert.ok(window);
  assert.equal(window.startDate, "2046-06-15");
  assert.equal(window.endDate, "2074-06-15");
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
  const drawn = result.years[0]?.drawnLines ?? [];
  assert.equal(drawn[0]?.id, "ann");
  assert.ok((drawn[0]?.amount ?? 0) > 4000);
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
  plan.assumptions.asOfDate = "2026-08-01";
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

test("a percent contribution can stop before the paycheck ends", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1970-01-01";
  plan.assumptions.asOfDate = "2026-08-01";
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.incomes = [
    {
      id: "job",
      name: "Post BGS",
      kind: "salary",
      monthlyAmount: 10000,
      startDate: "2026-08-01",
      endDate: "2027-08-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [];
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
      label: "Post BGS Match",
      portfolioId: "k",
      monthlyAmount: 0,
      startDate: "2026-08-01",
      endDate: null,
      stopDate: "2026-12-01",
      amountMode: "percent",
      percentOfIncome: 10,
      percentOfIncomeId: "job",
      employerMatch: true,
      employerMatchPct: 100,
    },
  ];
  const result = simulate(plan);
  const dec = result.months.find((m) => m.date.startsWith("2026-12"));
  const jan = result.months.find((m) => m.date.startsWith("2027-01"));
  assert.ok(dec && jan);
  assert.ok(dec.income > 5000);
  assert.ok(dec.contributions > 1000);
  assert.ok(jan.income > 5000);
  assert.ok(jan.contributions < 1);
  const y2026 = result.years.find((y) => y.year === 2026);
  assert.ok(y2026);
  const saved = y2026.savedLines ?? [];
  assert.match(saved.map((line) => line.label).join(" "), /Post BGS Match into 401k/);
  assert.match(saved.map((line) => line.label).join(" "), /401k employer match/);
  const savedTotal = saved.reduce((sum, line) => sum + line.amount, 0);
  assert.ok(Math.abs(savedTotal - y2026.contributions) < 1);
  const balances = y2026.spendableBalances ?? [];
  assert.equal(balances.length, 1);
  assert.equal(balances[0]?.id, "k");
  assert.ok(Math.abs((balances[0]?.amount ?? 0) - y2026.endSpendable) < 1);
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
  const y2026 = result.years.find((y) => y.year === 2026);
  assert.ok(y2026);
  assert.ok(y2026.irsCut > 1);
  assert.ok(y2026.employerMatch > 1);
  const kinds = new Set(result.yearCaps.filter((c) => c.year === 2026).map((c) => c.kind));
  assert.ok(kinds.has("irs"));
  assert.ok(kinds.has("match"));
});

test("year caps: cash when planned exceeds leftover", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.primary.birthDate = "1979-01-01";
  plan.incomes = [
    {
      id: "job",
      name: "Job",
      kind: "salary",
      monthlyAmount: 2000,
      startDate: "2026-01-01",
      endDate: null,
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
      endDate: null,
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
      endDate: null,
    },
  ];
  const result = simulate(plan);
  const cash = result.yearCaps.find((c) => c.year === 2026 && c.kind === "cash");
  assert.ok(cash);
  assert.ok(cash.planned > cash.leftover + 1);
});

test("house mortgage plus car loan: net worth is assets minus both remaining principals", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-08-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.spending = [];
  plan.incomes = [];
  const mortgage = {
    originationDate: "2020-08-01",
    aprPct: 4,
    monthlyPi: 1500,
    termYears: 30,
    includeInSpending: true,
    associated: true,
  };
  plan.portfolios = [
    {
      id: "house",
      name: "House",
      kind: "real_estate",
      owner: "joint",
      currentValue: 400_000,
      returnPct: 0,
      taxBucket: "none",
      spendable: false,
      includeInNetWorth: true,
      mortgage,
    },
  ];
  const car = {
    id: "lia-car",
    name: "Car",
    kind: "car" as const,
    balance: 20_000,
    originationDate: "2023-08-01",
    aprPct: 6,
    monthlyPi: 400,
    termYears: 6,
    includeInSpending: true,
    owner: "primary",
  };
  plan.liabilities = [car];
  const result = simulate(plan);
  const first = result.months[0];
  const houseDebt = remainingMortgage(mortgage, "2026-08-01");
  const carDebt = remainingLiability(car, "2026-08-01");
  const expected = 400_000 - houseDebt - carDebt;
  assert.ok(houseDebt > 0 && carDebt > 0);
  assert.ok(Math.abs(first.netWorthEnd - expected) < 2);
  assert.ok(Math.abs(first.assetsEnd - 400_000) < 2);
  assert.ok(Math.abs(first.liabilitiesEnd - (houseDebt + carDebt)) < 2);
});

test("audit trail does not change the run and account months balance", () => {
  const plan = createDefaultPlan();
  plan.assumptions.defaultReturnPct = 6;
  plan.assumptions.asOfDate = "2026-09-01";
  plan.portfolios = [
    {
      id: "port-audit",
      name: "Brokerage",
      kind: "taxable",
      owner: "Joint",
      currentValue: 10000,
      returnPct: 6,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  const quiet = simulate(plan);
  const full = simulate(plan, { audit: true });
  assert.equal(quiet.audit, undefined);
  assert.ok(full.audit);
  assert.equal(quiet.months.length, full.months.length);
  assert.equal(quiet.months[0].spendableEnd, full.months[0].spendableEnd);
  assert.equal(quiet.months.at(-1)?.netWorthEnd, full.months.at(-1)?.netWorthEnd);
  const row = full.audit?.accounts[0];
  assert.ok(row);
  const expected =
    row.start + row.growth + row.contribution + row.match + row.sweep - row.withdrawal;
  assert.ok(Math.abs(row.end - expected) < 0.02);
  assert.ok(Math.abs(row.residual) < 0.02);
  assert.ok(full.audit?.accounts.every((item) => Math.abs(item.residual) < 0.02));
});

test("COLA steps each January and stays flat the rest of the year", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-09-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultColaPct = 0;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.primary.birthDate = "1979-01-01";
  plan.assumptions.projectionEndAge = 52;
  plan.incomes = [
    {
      id: "job",
      name: "Boeing",
      kind: "salary",
      monthlyAmount: 10000,
      startDate: "2026-09-01",
      endDate: "2028-12-01",
      colaPct: 10,
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
      label: "Ten percent",
      portfolioId: "t",
      monthlyAmount: 0,
      amountMode: "percent",
      percentOfIncome: 10,
      percentOfIncomeId: "job",
      startDate: "2026-09-01",
      endDate: "2028-12-01",
    },
  ];
  const sim = simulate(plan, { audit: true });
  const income = (ym: string) => sim.months.find((m) => m.date.startsWith(ym))?.income ?? -1;
  const asked = (ym: string) =>
    sim.audit?.contributions.find((row) => row.date.startsWith(ym))?.planned ?? -1;
  assert.equal(Math.round(income("2026-09")), 10000);
  assert.equal(Math.round(income("2026-12")), 10000);
  assert.equal(Math.round(income("2027-01")), 11000);
  assert.equal(Math.round(income("2027-06")), 11000);
  assert.equal(Math.round(income("2027-12")), 11000);
  assert.equal(Math.round(income("2028-01")), 12100);
  assert.equal(Math.round(asked("2027-01")), 1100);
  assert.equal(Math.round(asked("2027-10")), 1100);
  assert.equal(Math.round(asked("2027-12")), 1100);
  assert.equal(Math.round(asked("2028-01")), 1210);
});

test("October shortfall funds Roths before the taxable contribution listed first", () => {
  const plan = createDefaultPlan();
  plan.primary = { name: "Matt", birthDate: "1979-10-01" };
  plan.spouse = { name: "Sarah", birthDate: "1986-07-22" };
  plan.assumptions.asOfDate = "2029-10-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultColaPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.assumptions.projectionEndAge = 51;
  plan.assumptions.sweepPortfolioId = null;
  plan.incomes = [
    {
      id: "pay",
      name: "Post BGS",
      kind: "salary",
      monthlyAmount: 11363.74,
      startDate: "2029-10-01",
      endDate: "2029-11-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [];
  plan.portfolios = [
    {
      id: "nq",
      name: "Fidelity Non Qualified",
      kind: "taxable",
      owner: "joint",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
    {
      id: "matt",
      name: "Matt Roth IRA - AMS",
      kind: "roth_ira",
      owner: "primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "roth",
      spendable: false,
      includeInNetWorth: true,
    },
    {
      id: "k401",
      name: "Boeing 401k Roth",
      kind: "401k_roth",
      owner: "primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "roth",
      spendable: false,
      includeInNetWorth: true,
    },
    {
      id: "sarah",
      name: "Sarah Roth IRA - AMS",
      kind: "roth_ira",
      owner: "spouse",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "roth",
      spendable: false,
      includeInNetWorth: true,
    },
  ];
  plan.contributions = [
    {
      id: "nq",
      label: "Non Qualified",
      portfolioId: "nq",
      monthlyAmount: 16000,
      startDate: "2026-10-01",
      endDate: "2029-10-01",
    },
    {
      id: "post",
      label: "Non Qualified post BGS",
      portfolioId: "nq",
      monthlyAmount: 5000,
      startDate: "2029-11-01",
      endDate: "2029-11-01",
    },
    {
      id: "matt",
      label: "Matt Roth AMS",
      portfolioId: "matt",
      monthlyAmount: 625,
      startDate: "2026-08-26",
      endDate: "2029-11-01",
    },
    {
      id: "k401",
      label: "Matt 401k Roth",
      portfolioId: "k401",
      monthlyAmount: 2731.82,
      startDate: "2026-09-01",
      endDate: "2029-09-01",
      employerMatch: true,
      employerMatchPct: 100,
    },
    {
      id: "sarah",
      label: "Sarah Roth AMS",
      portfolioId: "sarah",
      monthlyAmount: 625,
      startDate: "2026-08-26",
      endDate: "2029-11-01",
    },
  ];
  const listed = plan.contributions.map((rule) => rule.id).join(",");
  const sim = simulate(plan, { audit: true });
  assert.equal(plan.contributions.map((rule) => rule.id).join(","), listed);
  const got = (id: string, date: string) =>
    sim.audit?.contributions.find((row) => row.ruleId === id && row.date === date);
  const octNq = got("nq", "2029-10-01");
  const octMatt = got("matt", "2029-10-01");
  const octSarah = got("sarah", "2029-10-01");
  const oct401 = got("k401", "2029-10-01");
  assert.ok(octNq && octMatt && octSarah);
  assert.equal(oct401, undefined);
  assert.ok(Math.abs((octMatt?.invested ?? 0) - 625) < 0.02);
  assert.ok(Math.abs((octSarah?.invested ?? 0) - 625) < 0.02);
  assert.ok(Math.abs((octNq?.invested ?? 0) - 10113.74) < 0.02);
  assert.equal(octNq?.match ?? 0, 0);
  const novPost = got("post", "2029-11-01");
  const novMatt = got("matt", "2029-11-01");
  const novSarah = got("sarah", "2029-11-01");
  assert.ok(novPost && novMatt && novSarah);
  assert.ok(Math.abs((novPost?.invested ?? 0) - 5000) < 0.02);
  assert.ok(Math.abs((novMatt?.invested ?? 0) - 625) < 0.02);
  assert.ok(Math.abs((novSarah?.invested ?? 0) - 625) < 0.02);
  const cash = openAdvisories(plan).find((row) => row.kind === "cash" && row.name === "Non Qualified");
  assert.ok(cash);
  assert.match(cash.body, /Tax-qualified contributions are funded first/);
  assert.match(cash.body, /Matt Roth AMS \$625\.00 and Sarah Roth AMS \$625\.00/);
  assert.doesNotMatch(cash.body, /above this one/);
});



