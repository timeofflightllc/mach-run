import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { simulate } from "./engine.ts";
import { sustainableRetirementIncome } from "./sustainable-income.ts";

test("a funded plan can withdraw more than the spending it scheduled", () => {
  const plan = createDefaultPlan();
  plan.primary = { name: "Test", birthDate: "1980-01-15" };
  plan.assumptions.asOfDate = "2026-08-01";
  plan.assumptions.retirementGoalDate = "2036-09-01";
  plan.assumptions.projectionEndAge = 90;
  plan.portfolios = [
    {
      id: "brokerage",
      name: "Brokerage",
      kind: "taxable",
      owner: "primary",
      currentValue: 2_000_000,
      returnPct: 5,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.spending = [
    {
      id: "live",
      label: "Living",
      monthlyAmount: 4000,
      startDate: "2036-09-01",
      endDate: null,
    },
  ];
  const scheduled = simulate(plan).retirement?.annualIncome ?? 0;
  const room = sustainableRetirementIncome(plan);
  assert.ok(room);
  assert.ok(scheduled > 0);
  assert.ok(room.nominal + 1 >= scheduled);
  assert.ok(room.withdrawalNominal >= 0);
  assert.ok(room.withdrawalNominal <= room.nominal + 1);
});

test("a nest egg can pay far more than the old room-left figure", () => {
  const plan = createDefaultPlan();
  plan.primary = { name: "Test", birthDate: "1979-06-01" };
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.retirementGoalDate = "2036-01-01";
  plan.assumptions.projectionEndAge = 105;
  plan.assumptions.inflationPct = 2.5;
  plan.assumptions.defaultReturnPct = 7;
  plan.assumptions.retirementReturnPct = 5;
  plan.assumptions.ordinaryTaxRatePct = 22;
  plan.incomes = [];
  plan.spending = [];
  plan.contributions = [];
  plan.portfolios = [
    {
      id: "brokerage",
      name: "Brokerage",
      kind: "taxable",
      owner: "primary",
      currentValue: 3_680_000,
      returnPct: 7,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  const room = sustainableRetirementIncome(plan);
  assert.ok(room);
  assert.ok(room.withdrawalReal / 12 > 8_000);
});

test("retirement spending already entered does not shrink the investment withdrawal", () => {
  const plan = createDefaultPlan();
  plan.primary = { name: "Test", birthDate: "1980-06-01" };
  plan.assumptions.asOfDate = "2035-11-01";
  plan.assumptions.retirementGoalDate = "2035-11-01";
  plan.assumptions.projectionEndAge = 105;
  plan.assumptions.inflationPct = 2.5;
  plan.assumptions.defaultReturnPct = 8;
  plan.assumptions.retirementReturnPct = 6;
  plan.assumptions.ordinaryTaxRatePct = 22;
  plan.incomes = [
    {
      id: "mil",
      name: "Military",
      kind: "military",
      monthlyAmount: 7000,
      startDate: "2035-11-01",
      endDate: null,
      colaPct: 2.5,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.spending = [
    {
      id: "live",
      label: "Living",
      monthlyAmount: 8551,
      startDate: "2035-11-01",
      endDate: null,
    },
  ];
  plan.contributions = [];
  plan.portfolios = [
    {
      id: "brokerage",
      name: "Brokerage",
      kind: "taxable",
      owner: "primary",
      currentValue: 3_902_283,
      returnPct: 8,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  const room = sustainableRetirementIncome(plan);
  assert.ok(room);
  assert.ok(room.withdrawalReal / 12 > 8_000);
});

test("retirement return replaces the account rate, and cash keeps its own", () => {
  const plan = createDefaultPlan();
  plan.primary = { name: "Test", birthDate: "1980-01-01" };
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.retirementGoalDate = "2026-01-01";
  plan.assumptions.projectionEndAge = 50;
  plan.assumptions.retirementReturnPct = 5;
  plan.assumptions.inflationPct = 0;
  plan.incomes = [];
  plan.spending = [];
  plan.contributions = [];
  plan.portfolios = [
    {
      id: "brokerage",
      name: "Brokerage",
      kind: "taxable",
      owner: "primary",
      currentValue: 10_000,
      returnPct: 12,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
    {
      id: "cash",
      name: "Cash",
      kind: "cash",
      owner: "primary",
      currentValue: 10_000,
      returnPct: 0,
      taxBucket: "none",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  const year = simulate(plan).years.find((row) => row.year === 2026);
  const brokerage = year?.spendableBalances?.find((row) => row.id === "brokerage")?.amount ?? 0;
  const cash = year?.spendableBalances?.find((row) => row.id === "cash")?.amount ?? 0;
  assert.ok(Math.abs(brokerage - 10_500) < 2);
  assert.ok(Math.abs(cash - 10_000) < 1);
});
