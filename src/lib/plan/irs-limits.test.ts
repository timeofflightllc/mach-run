import assert from "node:assert/strict";
import { test } from "node:test";
import {
  annualizedMonthly,
  irsAnnualCap,
  irsEmployeeAnnualLimit,
  irsOverLimitWarning,
} from "./irs-limits.ts";

test("Roth IRA / IRA cap is $7,500 for 2026", () => {
  assert.equal(irsEmployeeAnnualLimit("roth_ira"), 7500);
  assert.equal(irsEmployeeAnnualLimit("ira"), 7500);
});

test("401k / 401k Roth / TSP cap is $24,500 for 2026", () => {
  assert.equal(irsEmployeeAnnualLimit("401k"), 24500);
  assert.equal(irsEmployeeAnnualLimit("401k_roth"), 24500);
  assert.equal(irsEmployeeAnnualLimit("tsp"), 24500);
});

test("taxable and cash have no IRS employee deferral cap", () => {
  assert.equal(irsEmployeeAnnualLimit("taxable"), null);
  assert.equal(irsEmployeeAnnualLimit("cash"), null);
  assert.equal(irsOverLimitWarning("taxable", 50_000), null);
});

test("Roth IRA $500/mo is under the cap — no warning", () => {
  assert.equal(annualizedMonthly(500), 6000);
  assert.equal(irsOverLimitWarning("roth_ira", 500), null);
});

test("Roth IRA $800/mo × 12 exceeds $7,500 — warning, input not capped", () => {
  const w = irsOverLimitWarning("roth_ira", 800);
  assert.ok(w);
  assert.match(w!, /7,500/);
  assert.match(w!, /9,600/);
  assert.match(w!, /not blocking/);
});

test("401k $2,000/mo is under $24,500 — no warning", () => {
  assert.equal(irsOverLimitWarning("401k", 2000), null);
});

test("401k $2,100/mo × 12 exceeds $24,500 — warning", () => {
  const w = irsOverLimitWarning("401k_roth", 2100);
  assert.ok(w);
  assert.match(w!, /24,500/);
  assert.match(w!, /25,200/);
});

test("catch-up: 50+ 401k is $32,500; 60–63 is $35,750; IRA 50+ is $8,600", () => {
  assert.equal(irsAnnualCap("401k", 49), 24500);
  assert.equal(irsAnnualCap("401k", 50), 32500);
  assert.equal(irsAnnualCap("401k_roth", 62), 35750);
  assert.equal(irsAnnualCap("401k", 64), 32500);
  assert.equal(irsAnnualCap("roth_ira", 49), 7500);
  assert.equal(irsAnnualCap("roth_ira", 50), 8600);
});
