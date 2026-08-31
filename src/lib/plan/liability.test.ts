import assert from "node:assert/strict";
import test from "node:test";
import { remainingMortgage } from "./mortgage.ts";
import { remainingLiability } from "./liability.ts";
import { ensurePlan, createDefaultPlan } from "./defaults.ts";
import type { Liability, Mortgage } from "./types.ts";

const loan: Liability = {
  id: "lia-car",
  name: "Car",
  kind: "car",
  balance: 20_000,
  originationDate: "2020-08-01",
  aprPct: 6,
  monthlyPi: 1_000,
  termYears: 30,
  includeInSpending: true,
  owner: "primary",
};

const m: Mortgage = {
  originationDate: loan.originationDate,
  aprPct: loan.aprPct,
  monthlyPi: loan.monthlyPi,
  termYears: loan.termYears,
  includeInSpending: true,
  associated: true,
};

test("liability remaining matches mortgage remaining over time", () => {
  const startL = remainingLiability(loan, "2020-08-01");
  const midL = remainingLiability(loan, "2035-08-01");
  const endL = remainingLiability(loan, "2050-08-01");
  assert.ok(midL < startL);
  assert.ok(endL < 1);
  assert.ok(Math.abs(startL - remainingMortgage(m, "2020-08-01")) < 1);
  assert.ok(Math.abs(midL - remainingMortgage(m, "2035-08-01")) < 1);
});

test("old plans missing liabilities migrate to []", () => {
  const raw = createDefaultPlan() as { liabilities?: unknown };
  delete raw.liabilities;
  const next = ensurePlan(raw as ReturnType<typeof createDefaultPlan>);
  assert.deepEqual(next.liabilities, []);
});
