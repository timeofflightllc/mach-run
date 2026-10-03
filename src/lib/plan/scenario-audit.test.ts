/**
 * Ten named households through simulate(), then an independent checker
 * that does not import engine month-loop internals.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { simulate } from "./engine.ts";
import {
  fvGrowThenDeposit,
  monthlyRateFromAnnual,
} from "./audit-calc.ts";
import { remainingLiability } from "./liability.ts";
import { remainingMortgage } from "./mortgage.ts";
import { ssBenefitFromPia } from "./social-security.ts";
import { vaSchedularPay } from "./va.ts";
import type { Plan, SimResult } from "./types.ts";

const CENTS = 2;

function near(actual: number, expected: number, tol = CENTS, label = "") {
  const ok = Math.abs(actual - expected) < tol;
  assert.ok(
    ok,
    `${label} expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`,
  );
}

function blankPlan(): Plan {
  const plan = createDefaultPlan();
  plan.children = [];
  plan.stages = [];
  plan.incomes = [];
  plan.spending = [];
  plan.contributions = [];
  plan.portfolios = [];
  plan.liabilities = [];
  plan.assumptions = {
    ...plan.assumptions,
    asOfDate: "2026-01-01",
    inflationPct: 0,
    defaultColaPct: 0,
    defaultReturnPct: 0,
    ordinaryTaxRatePct: 0,
    ssTaxablePct: 0,
    projectionEndAge: 90,
    careerEndDate: "2040-01-01",
    militaryRetireDate: "2040-01-01",
    sweepPortfolioId: null,
    dollars: "nominal",
    retirementGoalDate: "2040-01-01",
    nestEggGoal: null,
  };
  return plan;
}

/** Cash identity when leftover is fully parked (sweep or contrib). */
function assertCashIdentity(sim: SimResult, label: string, years = 12) {
  for (const y of sim.years.slice(0, years)) {
    const left = y.income + y.withdrawals;
    const right = y.tax + y.spending + y.contributions;
    assert.ok(
      Math.abs(left - right) < CENTS,
      `${label} ${y.year}: income+drawn ${left.toFixed(2)} vs tax+spend+saved ${right.toFixed(2)}`,
    );
  }
}

function assertNetWorthIdentity(sim: SimResult, plan: Plan, label: string) {
  for (const m of sim.months.slice(0, 24)) {
    const at = new Date(`${m.date.slice(0, 10)}T00:00:00`);
    let assets = 0;
    let debts = 0;
    for (const p of plan.portfolios) {
      if (!p.includeInNetWorth) continue;
      assets += m.byBucket[p.taxBucket] === undefined ? 0 : 0;
    }
    // Use snapshot assets/liabilities the engine published; independently
    // recompute debts from the loan schedules.
    for (const p of plan.portfolios) {
      if (p.kind === "real_estate" && p.includeInNetWorth) {
        debts += remainingMortgage(p.mortgage, at);
      }
    }
    for (const l of plan.liabilities ?? []) {
      debts += remainingLiability(l, at);
    }
    near(m.liabilitiesEnd, debts, 3, `${label} ${m.date} debts`);
    near(m.netWorthEnd, m.assetsEnd - m.liabilitiesEnd, 3, `${label} ${m.date} NW`);
  }
}

function month(sim: SimResult, yyyymm: string) {
  const m = sim.months.find((row) => row.date.startsWith(yyyymm));
  assert.ok(m, `missing month ${yyyymm}`);
  return m!;
}

test("10 households: engine vs independent checker", () => {
  const reports: string[] = [];

  // 1. Alex Rivera — 0% everything, leftover all swept.
  {
    const plan = blankPlan();
    plan.primary = { name: "Alex Rivera", birthDate: "1995-03-12" };
    plan.portfolios = [
      {
        id: "a-tax",
        name: "Brokerage",
        kind: "taxable",
        owner: "Alex Rivera",
        currentValue: 40_000,
        returnPct: 0,
        taxBucket: "taxable",
        spendable: true,
        includeInNetWorth: true,
      },
    ];
    plan.assumptions.sweepPortfolioId = "a-tax";
    plan.incomes = [
      {
        id: "a-job",
        name: "Software",
        kind: "salary",
        monthlyAmount: 8_000,
        startDate: "2026-01-01",
        endDate: null,
        colaPct: 0,
        taxTreatment: "ordinary",
        person: "primary",
      },
    ];
    plan.spending = [
      {
        id: "a-sp",
        label: "Rent life",
        monthlyAmount: 3_000,
        startDate: "2026-01-01",
        endDate: null,
      },
    ];
    const sim = simulate(plan);
    assertCashIdentity(sim, "Alex");
    const dec = month(sim, "2026-12");
    near(dec.spendableEnd, fvGrowThenDeposit(40_000, 0, 12, 5_000));
    near(dec.spendableEnd, 100_000);
    reports.push("Alex Rivera: 40k + 12×5k leftover = 100k — match");
  }

  // 2. Blake Chen — 12% return, closed-form annuity.
  {
    const plan = blankPlan();
    plan.primary = { name: "Blake Chen", birthDate: "1988-07-01" };
    plan.assumptions.defaultReturnPct = 12;
    plan.portfolios = [
      {
        id: "b-tax",
        name: "Taxable",
        kind: "taxable",
        owner: "Blake Chen",
        currentValue: 100_000,
        returnPct: null,
        taxBucket: "taxable",
        spendable: true,
        includeInNetWorth: true,
      },
    ];
    plan.assumptions.sweepPortfolioId = "b-tax";
    plan.incomes = [
      {
        id: "b-job",
        name: "Consulting",
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
    assertCashIdentity(sim, "Blake");
    const dec = month(sim, "2026-12");
    const r = monthlyRateFromAnnual(0.12);
    near(dec.spendableEnd, fvGrowThenDeposit(100_000, r, 12, 10_000), 2, "Blake FV");
    reports.push("Blake Chen: 12% + 10k/mo sweep closed-form — match");
  }

  // 3. Casey Okonkwo — 20% tax, leftover math.
  {
    const plan = blankPlan();
    plan.primary = { name: "Casey Okonkwo", birthDate: "1982-11-20" };
    plan.assumptions.ordinaryTaxRatePct = 20;
    plan.portfolios = [
      {
        id: "c-tax",
        name: "Sweep",
        kind: "taxable",
        owner: "Casey Okonkwo",
        currentValue: 50_000,
        returnPct: 0,
        taxBucket: "taxable",
        spendable: true,
        includeInNetWorth: true,
      },
    ];
    plan.assumptions.sweepPortfolioId = "c-tax";
    plan.incomes = [
      {
        id: "c-job",
        name: "W-2",
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
        id: "c-sp",
        label: "Bills",
        monthlyAmount: 4_000,
        startDate: "2026-01-01",
        endDate: null,
      },
    ];
    const sim = simulate(plan);
    assertCashIdentity(sim, "Casey");
    const jan = month(sim, "2026-01");
    near(jan.tax, 2_000, 1, "Casey tax");
    near(jan.contributions, 4_000, 1, "Casey save");
    near(jan.spendableEnd, 54_000, 1, "Casey Jan");
    reports.push("Casey Okonkwo: 10k − 20% tax − 4k spend = 4k saved — match");
  }

  // 4. Dana Patel — retired drawdown, 0% return.
  {
    const plan = blankPlan();
    plan.primary = { name: "Dana Patel", birthDate: "1960-01-15" };
    plan.assumptions.retirementGoalDate = "2026-01-01";
    plan.portfolios = [
      {
        id: "d-ira",
        name: "IRA",
        kind: "ira",
        owner: "Dana Patel",
        currentValue: 24_000,
        returnPct: 0,
        taxBucket: "pre_tax",
        spendable: true,
        includeInNetWorth: true,
      },
    ];
    plan.spending = [
      {
        id: "d-sp",
        label: "Retirement spend",
        monthlyAmount: 2_000,
        startDate: "2026-01-01",
        endDate: null,
      },
    ];
    const sim = simulate(plan);
    const dec = month(sim, "2026-12");
    near(dec.spendableEnd, 0, 2, "Dana empty");
    near(dec.withdrawals, 2_000, 2, "Dana last draw");
    assert.ok(sim.depletedAge != null, "Dana should deplete");
    reports.push("Dana Patel: 24k / 2k/mo = empty in 12 months — match");
  }

  // 5. Ellis Morgan — planned contrib bigger than leftover is capped.
  {
    const plan = blankPlan();
    plan.primary = { name: "Ellis Morgan", birthDate: "1990-05-05" };
    plan.portfolios = [
      {
        id: "e-tax",
        name: "Brokerage",
        kind: "taxable",
        owner: "Ellis Morgan",
        currentValue: 10_000,
        returnPct: 0,
        taxBucket: "taxable",
        spendable: true,
        includeInNetWorth: true,
      },
    ];
    plan.assumptions.sweepPortfolioId = null;
    plan.incomes = [
      {
        id: "e-job",
        name: "Sales",
        kind: "salary",
        monthlyAmount: 6_000,
        startDate: "2026-01-01",
        endDate: null,
        colaPct: 0,
        taxTreatment: "ordinary",
        person: "primary",
      },
    ];
    plan.spending = [
      {
        id: "e-sp",
        label: "Life",
        monthlyAmount: 5_000,
        startDate: "2026-01-01",
        endDate: null,
      },
    ];
    plan.contributions = [
      {
        id: "e-c",
        label: "Want 4k",
        portfolioId: "e-tax",
        monthlyAmount: 4_000,
        startDate: "2026-01-01",
        endDate: null,
      },
    ];
    const sim = simulate(plan);
    const jan = month(sim, "2026-01");
    near(jan.income, 6_000);
    near(jan.spending, 5_000);
    near(jan.contributions, 1_000, 1, "Ellis cap");
    near(jan.income + jan.withdrawals, jan.tax + jan.spending + jan.contributions);
    reports.push("Ellis Morgan: cannot save 4k from 1k leftover — capped — match");
  }

  // 6. Fran Walsh — house mortgage + car loan, net worth = assets − debts.
  {
    const plan = blankPlan();
    plan.primary = { name: "Fran Walsh", birthDate: "1978-09-09" };
    plan.portfolios = [
      {
        id: "f-house",
        name: "Home",
        kind: "real_estate",
        owner: "Fran Walsh",
        currentValue: 400_000,
        returnPct: 0,
        taxBucket: "none",
        spendable: false,
        includeInNetWorth: true,
        mortgage: {
          originationDate: "2020-01-01",
          aprPct: 4,
          monthlyPi: 1_500,
          termYears: 30,
          includeInSpending: false,
          associated: true,
        },
      },
      {
        id: "f-cash",
        name: "Cash",
        kind: "cash",
        owner: "Fran Walsh",
        currentValue: 20_000,
        returnPct: 0,
        taxBucket: "taxable",
        spendable: true,
        includeInNetWorth: true,
      },
    ];
    plan.liabilities = [
      {
        id: "f-car",
        name: "Car",
        kind: "car",
        balance: 12_000,
        aprPct: 6,
        monthlyPi: 400,
        originationDate: "2025-01-01",
        termYears: 5,
        includeInSpending: false,
        owner: "Fran Walsh",
      },
    ];
    const sim = simulate(plan);
    assertNetWorthIdentity(sim, plan, "Fran");
    const jan = month(sim, "2026-01");
    const at = new Date("2026-01-01T00:00:00");
    const houseDebt = remainingMortgage(plan.portfolios[0].mortgage, at);
    const carDebt = remainingLiability(plan.liabilities[0], at);
    near(jan.assetsEnd, 420_000, 1, "Fran assets");
    near(jan.liabilitiesEnd, houseDebt + carDebt, 3, "Fran debts");
    near(jan.netWorthEnd, 420_000 - houseDebt - carDebt, 3, "Fran NW");
    reports.push(
      `Fran Walsh: NW ${jan.netWorthEnd.toFixed(0)} = 420k − house − car — match`,
    );
  }

  // 7. Gray Nguyen — military + VA table vs engine income.
  {
    const plan = blankPlan();
    plan.primary = { name: "Gray Nguyen", birthDate: "1985-02-02" };
    plan.spouse = { name: "Pat Nguyen", birthDate: "1987-04-04" };
    plan.children = [
      { id: "g-kid", name: "Sam", birthDate: "2015-06-01" },
    ];
    plan.incomes = [
      {
        id: "g-mil",
        name: "Retired pay",
        kind: "military",
        monthlyAmount: 7_000,
        startDate: "2026-01-01",
        endDate: null,
        colaPct: 0,
        taxTreatment: "ordinary",
        person: "primary",
      },
      {
        id: "g-va",
        name: "VA",
        kind: "va",
        monthlyAmount: 0,
        startDate: "2026-01-01",
        endDate: null,
        colaPct: 0,
        taxTreatment: "tax_free",
        person: "primary",
        vaRatingPct: 100,
        vaSpouseDependent: true,
        vaChildAware: true,
      },
    ];
    const sim = simulate(plan);
    const jan = month(sim, "2026-01");
    const va = vaSchedularPay(100, true, 1);
    near(jan.incomeByKind.military ?? 0, 7_000, 1, "Gray mil");
    near(jan.incomeByKind.va ?? 0, va, 2, "Gray VA table");
    near(jan.income, 7_000 + va, 2, "Gray total");
    reports.push(`Gray Nguyen: VA 100%+spouse+1 kid table ${va} — match`);
  }

  // 8. Harper Diaz — SS claiming 62 vs independent PIA math.
  {
    const plan = blankPlan();
    plan.primary = { name: "Harper Diaz", birthDate: "1964-01-01" };
    plan.incomes = [
      {
        id: "h-ss",
        name: "SS Harper",
        kind: "ss",
        monthlyAmount: 0,
        startDate: "2026-01-01",
        endDate: null,
        colaPct: 0,
        taxTreatment: "ss",
        person: "primary",
        ssPia: 2_000,
        ssClaimAge: 62,
        ssFra: 67,
      },
    ];
    const sim = simulate(plan);
    const expected = ssBenefitFromPia(2_000, 62, 67);
    near(expected, 1_400, 2, "Harper PIA 70%");
    const row = sim.months.find((m) => (m.incomeByKind.ss ?? 0) > 0);
    assert.ok(row, "Harper SS should start");
    near(row!.incomeByKind.ss ?? 0, expected, 2, "Harper SS month");
    reports.push(`Harper Diaz: PIA 2000 at 62 = ${expected} — match`);
  }

  // 9. Indigo Brooks — 401k match is extra, not from leftover.
  {
    const plan = blankPlan();
    plan.primary = { name: "Indigo Brooks", birthDate: "1979-06-15" };
    plan.portfolios = [
      {
        id: "i-401",
        name: "401k",
        kind: "401k",
        owner: "Indigo Brooks",
        currentValue: 80_000,
        returnPct: 0,
        taxBucket: "pre_tax",
        spendable: true,
        includeInNetWorth: true,
      },
      {
        id: "i-tax",
        name: "Sweep",
        kind: "taxable",
        owner: "Indigo Brooks",
        currentValue: 10_000,
        returnPct: 0,
        taxBucket: "taxable",
        spendable: true,
        includeInNetWorth: true,
      },
    ];
    plan.assumptions.sweepPortfolioId = "i-tax";
    plan.incomes = [
      {
        id: "i-job",
        name: "Boeing",
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
        id: "i-sp",
        label: "House",
        monthlyAmount: 10_000,
        startDate: "2026-01-01",
        endDate: null,
      },
    ];
    plan.contributions = [
      {
        id: "i-c",
        label: "401k 2k",
        portfolioId: "i-401",
        monthlyAmount: 2_000,
        startDate: "2026-01-01",
        endDate: null,
        employerMatch: true,
        employerMatchPct: 50,
      },
    ];
    const sim = simulate(plan);
    assertCashIdentity(sim, "Indigo");
    const jan = month(sim, "2026-01");
    // leftover 10k: 2k employee + 8k sweep + 1k match
    near(jan.incomeByKind.employer_match ?? 0, 1_000, 1, "Indigo match");
    near(jan.contributions, 2_000 + 8_000 + 1_000, 2, "Indigo funded");
    near(jan.byBucket.pre_tax, 80_000 + 2_000 + 1_000, 2, "Indigo 401k");
    near(jan.byBucket.taxable, 10_000 + 8_000, 2, "Indigo sweep");
    reports.push("Indigo Brooks: 50% match on 2k = 1k extra, not from paycheck — match");
  }

  // 10. Jules Sato — dual income, two accounts, identity + year-1 pile.
  {
    const plan = blankPlan();
    plan.primary = { name: "Jules Sato", birthDate: "1975-12-01" };
    plan.spouse = { name: "Rin Sato", birthDate: "1977-08-20" };
    plan.portfolios = [
      {
        id: "j-roth",
        name: "Roth",
        kind: "roth_ira",
        owner: "Jules Sato",
        currentValue: 30_000,
        returnPct: 0,
        taxBucket: "roth",
        spendable: true,
        includeInNetWorth: true,
      },
      {
        id: "j-tax",
        name: "Brokerage",
        kind: "taxable",
        owner: "Joint",
        currentValue: 70_000,
        returnPct: 0,
        taxBucket: "taxable",
        spendable: true,
        includeInNetWorth: true,
      },
    ];
    plan.assumptions.sweepPortfolioId = "j-tax";
    plan.incomes = [
      {
        id: "j-a",
        name: "Jules W-2",
        kind: "salary",
        monthlyAmount: 9_000,
        startDate: "2026-01-01",
        endDate: "2035-01-01",
        colaPct: 0,
        taxTreatment: "ordinary",
        person: "primary",
      },
      {
        id: "j-b",
        name: "Rin W-2",
        kind: "salary",
        monthlyAmount: 6_000,
        startDate: "2026-01-01",
        endDate: "2038-01-01",
        colaPct: 0,
        taxTreatment: "ordinary",
        person: "spouse",
      },
    ];
    plan.spending = [
      {
        id: "j-sp",
        label: "Family",
        monthlyAmount: 8_000,
        startDate: "2026-01-01",
        endDate: null,
      },
    ];
    plan.contributions = [
      {
        id: "j-c",
        label: "Roth 500",
        portfolioId: "j-roth",
        monthlyAmount: 500,
        startDate: "2026-01-01",
        endDate: "2040-01-01",
      },
    ];
    const sim = simulate(plan);
    assertCashIdentity(sim, "Jules");
    const jan = month(sim, "2026-01");
    near(jan.income, 15_000);
    near(jan.spending, 8_000);
    // leftover 7k: 500 Roth + 6500 sweep
    near(jan.contributions, 7_000);
    near(jan.spendableEnd, 100_000 + 7_000);
    const y2026 = sim.years.find((y) => y.year === 2026)!;
    near(y2026.endSpendable, 100_000 + 12 * 7_000);
    reports.push("Jules Sato: 15k income − 8k spend = 7k saved (0.5 Roth + 6.5 sweep) — match");
  }

  for (const line of reports) {
    // eslint-disable-next-line no-console
    console.log(line);
  }
  assert.equal(reports.length, 10);
});
