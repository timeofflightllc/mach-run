import assert from "node:assert/strict";
import { test } from "node:test";
import { addCap, clampPlan, paidFromStatus } from "./limits.ts";

test("free add cap grandfathers existing rows", () => {
  assert.equal(addCap(0, false, 2), 2);
  assert.equal(addCap(1, false, 2), 2);
  assert.equal(addCap(8, false, 2), 8);
  assert.equal(addCap(1, true, 2), Number.POSITIVE_INFINITY);
});

test("clampPlan keeps first N accounts and their contribution rules", () => {
  const plan = {
    portfolios: [{ id: "a" }, { id: "b" }, { id: "c" }],
    contributions: [
      { portfolioId: "a" },
      { portfolioId: "b" },
      { portfolioId: "c" },
      { portfolioId: "a" },
    ],
    incomes: [{ id: "i1" }, { id: "i2" }, { id: "i3" }],
  };
  const next = clampPlan(plan, 2, 2, 2);
  assert.equal(next.portfolios.length, 2);
  assert.equal(next.contributions.length, 2);
  assert.equal(next.incomes.length, 2);
  assert.ok(next.contributions.every((c) => c.portfolioId === "a" || c.portfolioId === "b"));
});

test("paid statuses", () => {
  assert.equal(paidFromStatus("active"), true);
  assert.equal(paidFromStatus("trialing"), true);
  assert.equal(paidFromStatus("canceled"), false);
  assert.equal(paidFromStatus("none"), false);
});
