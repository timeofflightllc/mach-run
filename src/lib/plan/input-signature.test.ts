import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { planInputSignature } from "./input-signature.ts";

function sample() {
  const plan = createDefaultPlan();
  plan.assumptions = {
    ...plan.assumptions,
    asOfDate: "2026-08-01",
    asOfPinned: true,
    defaultReturnPct: 7,
    defaultColaPct: 2.5,
    inflationPct: 2.5,
    ordinaryTaxRatePct: 22,
    dollars: "real",
  };
  plan.liabilities = [
    {
      id: "car",
      name: "Car",
      kind: "car",
      balance: 10000,
      aprPct: 5,
      monthlyPi: 300,
      originationDate: "2024-01",
      termYears: 5,
      includeInSpending: true,
      owner: "primary",
    },
  ];
  return plan;
}

test("nominal return changes the signature", () => {
  const plan = sample();
  const before = planInputSignature(plan);
  plan.assumptions = { ...plan.assumptions, defaultReturnPct: 8 };
  assert.notEqual(planInputSignature(plan), before);
});

test("inflation, COLA, and tax change the signature", () => {
  const plan = sample();
  const before = planInputSignature(plan);
  plan.assumptions = { ...plan.assumptions, inflationPct: 3 };
  assert.notEqual(planInputSignature(plan), before);
  const cola = planInputSignature(plan);
  plan.assumptions = { ...plan.assumptions, defaultColaPct: 3 };
  assert.notEqual(planInputSignature(plan), cola);
  const tax = planInputSignature(plan);
  plan.assumptions = { ...plan.assumptions, ordinaryTaxRatePct: 24 };
  assert.notEqual(planInputSignature(plan), tax);
});

test("deleting a liability changes the signature", () => {
  const plan = sample();
  const before = planInputSignature(plan);
  plan.liabilities = [];
  assert.notEqual(planInputSignature(plan), before);
});

test("Today $ / Future $ does not change the signature", () => {
  const plan = sample();
  const before = planInputSignature(plan);
  plan.assumptions = { ...plan.assumptions, dollars: "nominal" };
  assert.equal(planInputSignature(plan), before);
});

test("confirming no liabilities does not change the signature", () => {
  const plan = sample();
  plan.liabilities = [];
  const before = planInputSignature(plan);
  plan.noLiabilities = true;
  assert.equal(planInputSignature(plan), before);
});
