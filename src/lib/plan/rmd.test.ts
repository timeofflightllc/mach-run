import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { simulate } from "./engine.ts";
import {
  monthlyRmd,
  rmdClass,
  rmdStartAge,
  uniformLifetimeFactor,
} from "./rmd.ts";
import type { Portfolio } from "./types.ts";

function port(partial: Partial<Portfolio> & Pick<Portfolio, "id" | "kind" | "taxBucket">): Portfolio {
  return {
    name: partial.name ?? partial.id,
    owner: partial.owner ?? "Primary",
    currentValue: partial.currentValue ?? 0,
    returnPct: 0,
    spendable: true,
    includeInNetWorth: true,
    ...partial,
  };
}

test("SECURE 2.0 RMD ages", () => {
  assert.equal(rmdStartAge("1950-06-01"), 72);
  assert.equal(rmdStartAge("1955-06-01"), 73);
  assert.equal(rmdStartAge("1959-12-31"), 73);
  assert.equal(rmdStartAge("1960-01-01"), 75);
  assert.equal(rmdStartAge("1980-01-01"), 75);
});

test("Uniform Lifetime Table: 73 is 26.5, so $265k → $10k/year", () => {
  assert.equal(uniformLifetimeFactor(73), 26.5);
  assert.ok(Math.abs(monthlyRmd(265_000, 73) * 12 - 10_000) < 1);
});

test("Roth IRA and Roth 401k have no lifetime RMD", () => {
  assert.equal(rmdClass(port({ id: "a", kind: "roth_ira", taxBucket: "roth" })), "none");
  assert.equal(rmdClass(port({ id: "b", kind: "401k_roth", taxBucket: "roth" })), "none");
  assert.equal(rmdClass(port({ id: "c", kind: "ira", taxBucket: "pre_tax" })), "ira");
  assert.equal(rmdClass(port({ id: "d", kind: "401k", taxBucket: "pre_tax" })), "workplace");
});

test("Traditional IRA at 73 is forced income even if working", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1953-01-01"; // 73 in 2026
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.incomes = [
    {
      id: "w2",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 8000,
      startDate: "2026-01-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [];
  plan.portfolios = [
    port({
      id: "ira-1",
      name: "Trad IRA",
      kind: "ira",
      taxBucket: "pre_tax",
      currentValue: 265_000,
    }),
  ];
  const sim = simulate(plan);
  const jan = sim.months.find((m) => m.date.startsWith("2026-01"));
  assert.ok(jan);
  assert.ok((jan?.incomeByKind.rmd ?? 0) > 800);
  assert.ok(sim.rmd.forced.includes("Trad IRA"));
  assert.ok(Math.abs((jan?.incomeByKind.rmd ?? 0) * 12 - 10_000) < 5);
});

test("Roth 401k never takes RMD", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1953-01-01";
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.inflationPct = 0;
  plan.incomes = [];
  plan.spending = [];
  plan.portfolios = [
    port({
      id: "r401k",
      name: "Roth 401k",
      kind: "401k_roth",
      taxBucket: "roth",
      currentValue: 400_000,
    }),
  ];
  const sim = simulate(plan);
  const jan = sim.months.find((m) => m.date.startsWith("2026-01"));
  assert.equal(jan?.incomeByKind.rmd ?? 0, 0);
  assert.ok(sim.rmd.lifetimeRothExempt.includes("Roth 401k"));
});

test("Traditional 401k skips RMD while W-2 is on and contributions hit that account", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1953-01-01";
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.incomes = [
    {
      id: "w2",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 10000,
      startDate: "2026-01-01",
      endDate: "2026-12-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [];
  plan.portfolios = [
    port({
      id: "k401",
      name: "Boeing 401k",
      kind: "401k",
      taxBucket: "pre_tax",
      currentValue: 265_000,
    }),
  ];
  plan.contributions = [
    {
      id: "c1",
      label: "Deferral",
      portfolioId: "k401",
      monthlyAmount: 1000,
      startDate: "2026-01-01",
      endDate: "2026-12-01",
    },
  ];
  const sim = simulate(plan);
  const jun = sim.months.find((m) => m.date.startsWith("2026-06"));
  const jan27 = sim.months.find((m) => m.date.startsWith("2027-01"));
  assert.equal(jun?.incomeByKind.rmd ?? 0, 0);
  assert.ok(sim.rmd.stillWorkingDeferred.includes("Boeing 401k"));
  assert.ok((jan27?.incomeByKind.rmd ?? 0) > 500, "RMD starts after salary/contrib end");
});
