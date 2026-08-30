import assert from "node:assert/strict";
import test from "node:test";
import {
  mortgagePaymentDue,
  originalPrincipal,
  remainingMortgage,
} from "./mortgage.ts";
import type { Mortgage } from "./types.ts";

const m: Mortgage = {
  originationDate: "2020-08-01",
  aprPct: 6,
  monthlyPi: 1_000,
  termYears: 30,
  includeInSpending: true,
};

test("original principal from P&I, APR, and term", () => {
  const p = originalPrincipal(m);
  // 1000 / month, 6%, 360 mo ≈ $166,791
  assert.ok(p > 166_000 && p < 168_000);
});

test("remaining balance is original at origination month", () => {
  const p = originalPrincipal(m);
  const rem = remainingMortgage(m, "2020-08-01");
  assert.ok(Math.abs(rem - p) < 1);
});

test("remaining falls after years of payments and hits ~0 at term", () => {
  const start = remainingMortgage(m, "2020-08-01");
  const mid = remainingMortgage(m, "2035-08-01");
  const end = remainingMortgage(m, "2050-08-01");
  assert.ok(mid < start);
  assert.ok(mid > 50_000);
  assert.ok(end < 1);
});

test("P&I drops out of spending after payoff", () => {
  assert.equal(mortgagePaymentDue(m, "2020-08-01"), 1_000);
  assert.equal(mortgagePaymentDue({ ...m, includeInSpending: false }, "2020-08-01"), 0);
  assert.equal(mortgagePaymentDue(m, "2050-08-01"), 0);
});
