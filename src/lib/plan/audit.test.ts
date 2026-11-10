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
  plan.primary = { name: "Jordan Hale", birthDate: "1979-03-15" };
  plan.spouse = { name: "Sarah Hale", birthDate: "1986-06-01" };
  plan.children = [{ id: "child-sybil", name: "Sybil Hale", birthDate: "2017-04-02" }];
  plan.portfolios = [
    {
      ...taxable(1_000),
      id: "acct-jordan-hale-991",
      name: "Jordan Hale Brokerage",
      owner: "child:child-sybil",
    },
  ];
  plan.assumptions.sweepPortfolioId = "acct-jordan-hale-991";
  const csv = buildInvestmentAuditCsv(plan, simulate(plan, { audit: true }));
  const lines = csv.split("\n");
  assert.equal(lines[0], "section,step,instruction");
  assert.match(lines[1] ?? "", /^review_order,1,/);
  assert.ok(csv.includes("VERDICT"));
  assert.ok(csv.includes("BUGS: none"));
  assert.equal(csv.includes("ChatGPT"), false);
  assert.equal(csv.includes("Grok"), false);
  assert.equal(csv.includes("Claude"), false);
  for (const secret of [
    "Jordan Hale",
    "Sarah Hale",
    "Sybil Hale",
    "1979-03-15",
    "1986-06-01",
    "2017-04-02",
    "acct-jordan-hale-991",
    "Jordan Hale Brokerage",
    "child-sybil",
    "child:child-sybil",
  ]) {
    assert.equal(csv.includes(secret), false, secret);
  }
  const accounts = sectionTable(csv, "accounts");
  assert.equal(accounts.rows[0]?.[0], "A1");
  const checks = sectionTable(csv, "checks");
  assert.deepEqual(checks.header, [
    "month",
    "code",
    "check",
    "left",
    "right",
    "difference",
    "tolerance",
    "pass",
  ]);
  const inside = checks.rows.find((row) => Math.abs(Number(row[5])) < 0.05);
  assert.ok(inside);
  assert.equal(inside?.[7], "yes");
  const household = checks.rows.find((row) => row[2] === "household_residual");
  assert.ok(household);
  assert.equal(household?.[1], "");
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
  assert.deepEqual(incomes.header.slice(3, 6), ["monthly_today", "pay_cadence", "pay_amount"]);
  const bonusIn = incomes.rows.find((row) => row[0] === "I1");
  assert.ok(bonusIn);
  assert.equal(bonusIn[incomes.header.indexOf("monthly_today")], "6666.67");
  assert.equal(bonusIn[incomes.header.indexOf("pay_cadence")], "year");
  assert.equal(bonusIn[incomes.header.indexOf("pay_amount")], "80000.00");
  assert.equal(csv.includes("BGS Bonus"), false);
  assert.equal(csv.includes("Bonus match"), false);

  const contributions = sectionTable(csv, "contributions");
  assert.ok(contributions.header.includes("stop_date"));
  const stopAt = contributions.header.indexOf("stop_date");
  assert.equal(contributions.rows[0]?.[stopAt], "2028-09-01");

  const windows = sectionTable(csv, "windows");
  const matchWindow = windows.rows.find((row) => row[1] === "C1");
  assert.ok(matchWindow);
  assert.equal(matchWindow.at(-1), "none");

  const income = sectionTable(csv, "month_income");
  const nominalAt = income.header.indexOf("nominal");
  const idAt = income.header.indexOf("code");
  const dateAt = income.header.indexOf("date");
  const sep = income.rows.filter((row) => row[dateAt] === "2027-09-01" && row[idAt] === "I1");
  assert.equal(sep.length, 1);
  assert.equal(sep[0]?.[nominalAt], "80000.00");
  assert.equal(
    income.rows.some((row) => row[dateAt] === "2027-10-01" && row[idAt] === "I1"),
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

test("audit checks pass retirement return, a lump, a match, and a 529 sunset", () => {
  const plan = roundPlan();
  plan.assumptions.defaultReturnPct = 8;
  plan.assumptions.retirementReturnPct = 6;
  plan.assumptions.retirementGoalDate = "2027-01-15";
  plan.assumptions.projectionEndAge = 55;
  plan.children = [{ id: "c1", name: "Kid One", birthDate: "2014-06-15" }];
  plan.portfolios = [
    taxable(10_000),
    {
      id: "five",
      name: "Kid One 529",
      kind: "529",
      owner: "child:c1",
      currentValue: 1_000,
      returnPct: null,
      taxBucket: "none",
      spendable: false,
      includeInNetWorth: true,
      sunsetAge: 18,
    },
    {
      id: "k",
      name: "Work 401k",
      kind: "401k",
      owner: "primary",
      currentValue: 0,
      returnPct: null,
      taxBucket: "pre_tax",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.incomes = [
    {
      id: "pay",
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
      id: "car",
      label: "New car",
      monthlyAmount: 0,
      lumpAmount: 5_000,
      spendKind: "lump",
      startDate: "2026-06-01",
      endDate: null,
    },
  ];
  plan.contributions = [
    {
      id: "college",
      label: "College",
      portfolioId: "five",
      monthlyAmount: 100,
      startDate: "2026-01-01",
      endDate: "2040-01-01",
      amountMode: "fixed",
    },
    {
      id: "match",
      label: "Match",
      portfolioId: "k",
      monthlyAmount: 500,
      startDate: "2026-01-01",
      endDate: null,
      amountMode: "fixed",
      employerMatch: true,
      employerMatchPct: 100,
    },
  ];
  const csv = buildInvestmentAuditCsv(plan, simulate(plan, { audit: true }));
  assert.equal(csv.includes("Kid One"), false);
  assert.equal(csv.includes("2014-06-15"), false);

  const spending = sectionTable(csv, "spending");
  assert.deepEqual(spending.header.slice(0, 4), ["code", "kind", "monthly_today", "lump_today"]);
  assert.deepEqual(spending.rows[0]?.slice(0, 4), ["S1", "lump", "", "5000.00"]);

  const accounts = sectionTable(csv, "accounts");
  const sunsetAt = accounts.header.indexOf("sunset_month");
  assert.equal(accounts.rows.find((row) => row[0] === "A2")?.[sunsetAt], "2032-06");

  const windows = sectionTable(csv, "windows");
  const college = windows.rows.find((row) => row[0] === "contribution" && row[1] === "C1");
  assert.ok(college);
  assert.equal(college[5], "2032-05-01");
  assert.match(college[6] ?? "", /529 sunset/);

  const trace = sectionTable(csv, "month_account");
  const rateAt = trace.header.indexOf("annual_return_pct");
  const before = trace.rows.find((row) => row[0] === "2026-12-01" && row[1] === "A1");
  const after = trace.rows.find((row) => row[0] === "2027-01-01" && row[1] === "A1");
  assert.equal(before?.[rateAt], "8.00");
  assert.equal(after?.[rateAt], "6.00");

  const checks = sectionTable(csv, "checks");
  const failed = checks.rows.filter((row) => row[7] === "no");
  assert.deepEqual(
    failed.slice(0, 3).map((row) => row.slice(0, 6)),
    [],
  );
  assert.equal(failed.length, 0);
  assert.ok(checks.rows.some((row) => row[2] === "college_spent" && row[7] === "yes"));
  assert.ok(checks.rows.some((row) => row[2] === "household_residual" && row[7] === "yes"));
});
