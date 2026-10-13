import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { simulate } from "./engine.ts";
import { buildInvestmentAuditCsv } from "./audit-csv.ts";
import {
  fvGrowThenDeposit,
  monthlyRateFromAnnual,
  runDrawdown,
} from "./audit-calc.ts";
import type { Plan, Portfolio } from "./types.ts";

function roundPlan(): Plan {
  const plan = createDefaultPlan();
  plan.primary = { name: "Audit", birthDate: "1980-01-01" };
  plan.spouse = { name: "", birthDate: "" };
  plan.children = [];
  plan.assumptions = {
    ...plan.assumptions,
    asOfDate: "2026-01-01",
    inflationPct: 0,
    defaultReturnPct: 0,
    ordinaryTaxRatePct: 0,
    ssTaxablePct: 0,
    projectionEndAge: 50,
    careerEndDate: "2040-01-01",
    militaryRetireDate: "2040-01-01",
    sweepPortfolioId: "acct-taxable",
    dollars: "nominal",
    retirementGoalDate: "2040-01-01",
  };
  plan.incomes = [];
  plan.contributions = [];
  plan.spending = [];
  plan.portfolios = [];
  plan.stages = [];
  return plan;
}

function taxable(value: number): Portfolio {
  return {
    id: "acct-taxable",
    name: "Taxable",
    kind: "taxable",
    owner: "Joint",
    currentValue: value,
    returnPct: null,
    taxBucket: "taxable",
    spendable: true,
    includeInNetWorth: true,
  };
}

function near(actual: number, expected: number, cents = 1) {
  assert.ok(
    Math.abs(actual - expected) < cents,
    `expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`,
  );
}

function month(sim: ReturnType<typeof simulate>, yyyymm: string) {
  const m = sim.months.find((row) => row.date.startsWith(yyyymm));
  assert.ok(m, `missing month ${yyyymm}`);
  return m!;
}

test("audit A: 0% return, $100k pile, $10k/mo leftover all swept — 12 months", () => {
  const plan = roundPlan();
  plan.portfolios = [taxable(100_000)];
  plan.incomes = [
    {
      id: "inc",
      name: "Pay",
      kind: "salary",
      monthlyAmount: 10_000,
      startDate: "2026-01-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  const sim = simulate(plan);
  const dec = month(sim, "2026-12");
  // Independent: 100000 + 12 * 10000
  near(dec.spendableEnd, fvGrowThenDeposit(100_000, 0, 12, 10_000));
  near(dec.spendableEnd, 220_000);
  near(dec.income, 10_000);
  near(dec.contributions, 10_000);
});

test("audit B: leftover $5k funds $1k contribution then $4k sweep", () => {
  const plan = roundPlan();
  plan.portfolios = [
    taxable(100_000),
    {
      id: "acct-roth",
      name: "Roth",
      kind: "roth",
      owner: "Primary",
      currentValue: 50_000,
      returnPct: 0,
      taxBucket: "roth",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.incomes = [
    {
      id: "inc",
      name: "Pay",
      kind: "salary",
      monthlyAmount: 10_000,
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
      monthlyAmount: 5_000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  plan.contributions = [
    {
      id: "c-roth",
      label: "Roth $1k",
      portfolioId: "acct-roth",
      monthlyAmount: 1_000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  const sim = simulate(plan);
  const jan = month(sim, "2026-01");
  near(jan.income, 10_000);
  near(jan.spending, 5_000);
  near(jan.contributions, 5_000);
  // 100k + 4k sweep, 50k + 1k contrib
  near(jan.spendableEnd, 155_000);
  const dec = month(sim, "2026-12");
  near(dec.spendableEnd, 100_000 + 50_000 + 12 * 5_000);
});

test("audit C: 12% annual, no cash flow — 12 months is exactly +12%", () => {
  const plan = roundPlan();
  plan.assumptions.defaultReturnPct = 12;
  plan.portfolios = [taxable(100_000)];
  const sim = simulate(plan);
  const dec = month(sim, "2026-12");
  const r = monthlyRateFromAnnual(0.12);
  near(dec.spendableEnd, fvGrowThenDeposit(100_000, r, 12, 0), 2);
  near(dec.spendableEnd, 112_000, 2);
});

test("audit D: 12% annual + $10k/mo sweep — closed-form ordinary annuity", () => {
  const plan = roundPlan();
  plan.assumptions.defaultReturnPct = 12;
  plan.portfolios = [taxable(100_000)];
  plan.incomes = [
    {
      id: "inc",
      name: "Pay",
      kind: "salary",
      monthlyAmount: 10_000,
      startDate: "2026-01-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  const sim = simulate(plan);
  const dec = month(sim, "2026-12");
  const r = monthlyRateFromAnnual(0.12);
  const expected = fvGrowThenDeposit(100_000, r, 12, 10_000);
  near(dec.spendableEnd, expected, 2);
});

test("audit E: 20% tax, $10k pay, $4k spend, 0% return — leftover $4k swept", () => {
  const plan = roundPlan();
  plan.assumptions.ordinaryTaxRatePct = 20;
  plan.portfolios = [taxable(100_000)];
  plan.incomes = [
    {
      id: "inc",
      name: "Pay",
      kind: "salary",
      monthlyAmount: 10_000,
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
      monthlyAmount: 4_000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  const sim = simulate(plan);
  const jan = month(sim, "2026-01");
  near(jan.tax, 2_000);
  near(jan.contributions, 4_000);
  near(jan.spendableEnd, 104_000);
  const dec = month(sim, "2026-12");
  near(dec.spendableEnd, 100_000 + 12 * 4_000);
});

test("audit F: $12k pile, $1k/mo spend, 0% return — empty after 12 months", () => {
  const plan = roundPlan();
  plan.portfolios = [taxable(12_000)];
  plan.spending = [
    {
      id: "sp",
      label: "Spend",
      monthlyAmount: 1_000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  const sim = simulate(plan);
  const independent = runDrawdown(12_000, 0, 12, 1_000);
  const dec = month(sim, "2026-12");
  near(dec.spendableEnd, independent.end, 2);
  near(dec.spendableEnd, 0, 2);
  near(dec.withdrawals, 1_000);
});

test("audit G: planned contrib bigger than leftover is capped — identity holds", () => {
  const plan = roundPlan();
  plan.portfolios = [taxable(100_000)];
  plan.incomes = [
    {
      id: "inc",
      name: "Pay",
      kind: "salary",
      monthlyAmount: 10_000,
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
      monthlyAmount: 8_000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  plan.contributions = [
    {
      id: "c",
      label: "Want $10k",
      portfolioId: "acct-taxable",
      monthlyAmount: 10_000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  plan.assumptions.sweepPortfolioId = null;
  const sim = simulate(plan);
  const jan = month(sim, "2026-01");
  near(jan.income, 10_000);
  near(jan.spending, 8_000);
  near(jan.contributions, 2_000);
  near(jan.income + jan.withdrawals, jan.tax + jan.spending + jan.contributions);
  near(jan.spendableEnd, 102_000);
});

test("audit H: blank sweep holds leftover as cash instead of spending it", () => {
  const plan = roundPlan();
  plan.portfolios = [taxable(100_000)];
  plan.assumptions.sweepPortfolioId = null;
  plan.incomes = [
    {
      id: "inc",
      name: "Pay",
      kind: "salary",
      monthlyAmount: 20_000,
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
      label: "Life",
      monthlyAmount: 8_000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  plan.contributions = [
    {
      id: "c",
      label: "Save 2k",
      portfolioId: "acct-taxable",
      monthlyAmount: 2_000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  const sim = simulate(plan);
  const jan = month(sim, "2026-01");
  near(jan.income, 20_000);
  near(jan.contributions, 2_000);
  near(jan.spending, 8_000);
  near(jan.detail?.unallocatedSpent ?? -1, 0);
  near(jan.detail?.cashParked ?? 0, 10_000);
  near(jan.detail?.cashOnHand ?? 0, 10_000);
  near(jan.detail?.spendingLines[0]?.amount ?? 0, 8_000);
  near(
    jan.income + jan.withdrawals + (jan.detail?.cashDrawn ?? 0),
    jan.tax + jan.spending + jan.contributions + (jan.detail?.cashParked ?? 0),
  );
  near(jan.spendableEnd, 112_000);
  const dec = month(sim, "2026-12");
  near(dec.spendableEnd, 100_000 + 12 * 2_000 + 12 * 10_000);
  near(dec.detail?.cashOnHand ?? 0, 120_000);
});

test("audit CSV opens with a reviewer prompt before the trace", () => {
  const plan = roundPlan();
  plan.portfolios = [taxable(1_000)];
  const csv = buildInvestmentAuditCsv(plan, simulate(plan, { audit: true }));
  const lines = csv.split("\n");
  assert.equal(lines[0], "section,step,instruction");
  assert.match(lines[1] ?? "", /^review_order,1,/);
  assert.ok(csv.includes("CONFIRMED BUGS"));
  assert.ok(csv.includes("Do not assume the software is correct"));
  assert.ok(csv.includes("SAMPLES I RECOMPUTED"));
  const dictionaryAt = lines.findIndex((line) => line.startsWith("dictionary,"));
  assert.ok(dictionaryAt > 10, "dictionary should follow the review order");
});

function sectionTable(csv: string, name: string): { header: string[]; rows: string[][] } {
  let pending: string[] | null = null;
  let header: string[] = [];
  const rows: string[][] = [];
  for (const line of csv.split("\n")) {
    if (!line) continue;
    const cells = line.split(",");
    if (cells[0] === "section") {
      pending = cells.slice(1);
      continue;
    }
    if (cells[0] !== name) continue;
    if (header.length === 0 && pending) header = pending;
    rows.push(cells.slice(1));
  }
  return { header, rows };
}

test("audit income rows show a yearly bonus as one check", () => {
  const plan = roundPlan();
  plan.assumptions.sweepPortfolioId = null;
  plan.portfolios = [
    {
      id: "k",
      name: "401k",
      kind: "401k",
      owner: "primary",
      currentValue: 0,
      returnPct: 0,
      taxBucket: "pre_tax",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.incomes = [
    {
      id: "bonus",
      name: "BGS Bonus",
      kind: "bonus",
      monthlyAmount: 6_666.67,
      payCadence: "year",
      payAmount: 80_000,
      startDate: "2027-09-01",
      endDate: "2029-09-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.contributions = [
    {
      id: "match",
      label: "Bonus match",
      portfolioId: "k",
      monthlyAmount: 0,
      startDate: "2027-09-01",
      endDate: null,
      stopDate: "2028-09-01",
      amountMode: "percent",
      percentOfIncome: 10,
      percentOfIncomeId: "bonus",
      employerMatch: true,
      employerMatchPct: 100,
    },
  ];
  const csv = buildInvestmentAuditCsv(plan, simulate(plan, { audit: true }));
  assert.match(
    csv,
    /cadence year deposits pay_amount \(or monthly times 12 when pay_amount is blank\) in the anniversary month only/,
  );

  const incomes = sectionTable(csv, "incomes");
  assert.deepEqual(incomes.header.slice(4, 7), ["monthly_today", "pay_cadence", "pay_amount"]);
  const bonusIn = incomes.rows.find((row) => row[0] === "bonus");
  assert.ok(bonusIn);
  assert.equal(bonusIn[4], "6666.67");
  assert.equal(bonusIn[5], "year");
  assert.equal(bonusIn[6], "80000.00");

  const contributions = sectionTable(csv, "contributions");
  assert.ok(contributions.header.includes("stop_date"));
  const stopAt = contributions.header.indexOf("stop_date");
  assert.equal(contributions.rows[0]?.[stopAt], "2028-09-01");

  const windows = sectionTable(csv, "windows");
  const matchWindow = windows.rows.find((row) => row[1] === "match");
  assert.ok(matchWindow);
  assert.equal(matchWindow.at(-1), "none");

  const income = sectionTable(csv, "month_income");
  const nominalAt = income.header.indexOf("nominal");
  const idAt = income.header.indexOf("income_id");
  const dateAt = income.header.indexOf("date");
  const sep = income.rows.filter((row) => row[dateAt] === "2027-09-01" && row[idAt] === "bonus");
  assert.equal(sep.length, 1);
  assert.equal(sep[0]?.[nominalAt], "80000.00");
  assert.equal(
    income.rows.some((row) => row[dateAt] === "2027-10-01" && row[idAt] === "bonus"),
    false,
  );

  const home = sectionTable(csv, "month_household");
  const hDate = home.header.indexOf("date");
  const hIncome = home.header.indexOf("income");
  const hMatch = home.header.indexOf("employer_match");
  for (const key of ["2027-09-01", "2027-10-01"]) {
    const nominals = income.rows
      .filter((row) => row[dateAt] === key)
      .reduce((sum, row) => sum + Number(row[nominalAt]), 0);
    const month = home.rows.find((row) => row[hDate] === key);
    assert.ok(month, key);
    near(Number(month[hIncome]), nominals + Number(month[hMatch] || 0));
  }
});
