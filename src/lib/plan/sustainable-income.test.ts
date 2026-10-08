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
});
