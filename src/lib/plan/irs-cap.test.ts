import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { simulate } from "./engine.ts";
import { irsCapPerson } from "./irs-limits.ts";
import type { Plan, PlanAudit, Portfolio } from "./types.ts";

function near(actual: number, expected: number, label: string) {
  assert.ok(Math.abs(actual - expected) < 1, `${label}: ${actual} vs ${expected}`);
}

function household(): Plan {
  const plan = createDefaultPlan();
  plan.primary = { name: "Matthew", birthDate: "1979-11-25" };
  plan.spouse = { name: "Sarah", birthDate: "1986-07-22" };
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultColaPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.assumptions.projectionEndAge = 65;
  plan.assumptions.sweepPortfolioId = null;
  plan.incomes = [
    {
      id: "pay",
      name: "Pay",
      kind: "salary",
      monthlyAmount: 20000,
      startDate: "2026-01-01",
      endDate: "2060-01-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [
    {
      id: "sp",
      label: "Spend",
      monthlyAmount: 1000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  return plan;
}

function roth(id: string, name: string, owner: string): Portfolio {
  return {
    id,
    name,
    kind: "roth_ira",
    owner,
    currentValue: 1000,
    returnPct: 0,
    taxBucket: "roth",
    spendable: true,
    includeInNetWorth: true,
  };
}

function rows(audit: PlanAudit | undefined, ruleId: string, year: number) {
  return (audit?.contributions ?? []).filter(
    (row) => row.ruleId === ruleId && row.date.startsWith(String(year)),
  );
}

function invested(audit: PlanAudit | undefined, ruleId: string, year: number) {
  return rows(audit, ruleId, year).reduce((sum, row) => sum + row.invested, 0);
}

test("Joint is not an IRS person — a spouse-named Roth uses her age", () => {
  const plan = household();
  const sarah = roth("port-sarah", "Sarah Roth IRA - AMS", "Joint");
  const matt = roth("port-matt", "Matt Roth IRA - AMS", "Joint");
  assert.equal(irsCapPerson(plan, sarah, { label: "Sarah Roth" }), "spouse");
  assert.equal(irsCapPerson(plan, matt, { label: "Matt Roth" }), "primary");
  assert.equal(irsCapPerson(plan, { name: "Roth IRA", owner: "Joint" }, { label: "IRA" }), null);
  assert.equal(
    irsCapPerson(plan, sarah, { label: "Sarah Roth", capPerson: "primary" }),
    "primary",
  );
  assert.equal(irsCapPerson(plan, matt, { label: "Matt", capPerson: "spouse" }), "spouse");
});

test("spouse Roth cap is hers — an uncapped primary Roth does not eat it", () => {
  const plan = household();
  plan.portfolios = [
    roth("port-matt", "Matt Roth IRA - AMS", "Joint"),
    roth("port-sarah", "Sarah Roth IRA - AMS", "Joint"),
  ];
  plan.contributions = [
    {
      id: "c-matt",
      label: "Matt Roth",
      portfolioId: "port-matt",
      monthlyAmount: 625,
      startDate: "2026-01-01",
      endDate: null,
      capToIrsLimit: false,
    },
    {
      id: "c-sarah",
      label: "Sarah Roth",
      portfolioId: "port-sarah",
      monthlyAmount: 625,
      startDate: "2026-01-01",
      endDate: null,
      capToIrsLimit: true,
    },
  ];
  const sim = simulate(plan, { audit: true });
  for (const year of [2027, 2028]) {
    near(invested(sim.audit, "c-sarah", year), 7500, `sarah ${year}`);
    near(invested(sim.audit, "c-matt", year), 7500, `matt ${year}`);
    for (const row of rows(sim.audit, "c-sarah", year)) {
      assert.equal(row.irsLimit, 7500, row.date);
      assert.equal(row.catchUp, false, row.date);
      near(row.invested, 625, row.date);
    }
  }
  const july = sim.months.find((m) => m.date.startsWith("2027-07"));
  assert.ok(july);
  assert.ok((july.detail?.unallocatedSpent ?? 0) > 0);
  const funded = (sim.audit?.accounts ?? []).filter((row) => row.date.startsWith("2027-"));
  for (const row of funded) {
    assert.ok(Math.abs(row.residual) < 0.05, `${row.date} ${row.accountId} residual ${row.residual}`);
  }
});

test("primary catch-up in the year he turns 50 does not raise the spouse IRA", () => {
  const plan = household();
  plan.portfolios = [
    roth("port-matt", "Matt Roth IRA - AMS", "Joint"),
    roth("port-sarah", "Sarah Roth IRA - AMS", "Joint"),
  ];
  plan.contributions = [
    {
      id: "c-matt",
      label: "Matt Roth",
      portfolioId: "port-matt",
      monthlyAmount: 800,
      startDate: "2026-01-01",
      endDate: null,
      capToIrsLimit: true,
    },
    {
      id: "c-sarah",
      label: "Sarah Roth",
      portfolioId: "port-sarah",
      monthlyAmount: 800,
      startDate: "2026-01-01",
      endDate: null,
      capToIrsLimit: true,
    },
  ];
  const sim = simulate(plan, { audit: true });
  near(invested(sim.audit, "c-matt", 2029), 8600, "matt 2029");
  near(invested(sim.audit, "c-sarah", 2029), 7500, "sarah 2029");
  for (const row of rows(sim.audit, "c-matt", 2029)) {
    assert.equal(row.irsLimit, 8600);
    assert.equal(row.catchUp, true);
  }
  for (const row of rows(sim.audit, "c-sarah", 2029)) {
    assert.equal(row.irsLimit, 7500);
    assert.equal(row.catchUp, false);
  }
});

test("spouse IRA catch-up starts the year she turns 50", () => {
  const plan = household();
  plan.portfolios = [roth("port-sarah", "Sarah Roth IRA - AMS", "Joint")];
  plan.contributions = [
    {
      id: "c-sarah",
      label: "Sarah Roth",
      portfolioId: "port-sarah",
      monthlyAmount: 800,
      startDate: "2026-01-01",
      endDate: null,
      capToIrsLimit: true,
    },
  ];
  const sim = simulate(plan, { audit: true });
  near(invested(sim.audit, "c-sarah", 2036), 8600, "sarah 2036");
  for (const row of rows(sim.audit, "c-sarah", 2036)) {
    assert.equal(row.irsLimit, 8600);
    assert.equal(row.catchUp, true);
  }
});

test("workplace employee cap follows the primary, and match is outside it", () => {
  const plan = household();
  plan.portfolios = [
    {
      id: "port-k",
      name: "Matt 401k",
      kind: "401k",
      owner: "Joint",
      currentValue: 1000,
      returnPct: 0,
      taxBucket: "pre_tax",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.contributions = [
    {
      id: "c-k",
      label: "Matt 401k",
      portfolioId: "port-k",
      monthlyAmount: 4000,
      startDate: "2026-01-01",
      endDate: null,
      capToIrsLimit: true,
      employerMatch: true,
      employerMatchPct: 100,
    },
  ];
  const sim = simulate(plan, { audit: true });
  const expectYear = (year: number, cap: number, catchUp: boolean) => {
    near(invested(sim.audit, "c-k", year), cap, `employee ${year}`);
    const match = rows(sim.audit, "c-k", year).reduce((sum, row) => sum + row.match, 0);
    near(match, cap, `match ${year}`);
    for (const row of rows(sim.audit, "c-k", year)) {
      assert.equal(row.irsLimit, cap, row.date);
      assert.equal(row.catchUp, catchUp, row.date);
    }
  };
  expectYear(2027, 24500, false);
  expectYear(2029, 32500, true);
  expectYear(2039, 35750, true);
  expectYear(2042, 35750, true);
});
