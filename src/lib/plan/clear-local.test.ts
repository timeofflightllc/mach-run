import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";

test("blank guest plan has no accounts or contributions", () => {
  const plan = createDefaultPlan();
  assert.equal(plan.portfolios.length, 0);
  assert.equal(plan.contributions.length, 0);
  assert.equal((plan.liabilities ?? []).length, 0);
});
