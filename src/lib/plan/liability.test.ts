import assert from "node:assert/strict";
import test from "node:test";
import { remainingMortgage } from "./mortgage.ts";
import { remainingLiability, syncLiabilitySpending } from "./liability.ts";
import { simulate } from "./engine.ts";
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
  assert.equal(next.noLiabilities, false);
});

test("no-liabilities confirmation sticks only while the list is empty", () => {
  const empty = ensurePlan({ ...createDefaultPlan(), noLiabilities: true });
  assert.equal(empty.noLiabilities, true);
  const withLoan = ensurePlan({ ...empty, liabilities: [loan] });
  assert.equal(withLoan.noLiabilities, false);
  const cleared = ensurePlan({ ...withLoan, liabilities: [], noLiabilities: true });
  assert.equal(cleared.noLiabilities, true);
});

test("a checked liability becomes one spending line and is not counted twice", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.inflationPct = 3;
  plan.assumptions.ordinaryTaxRatePct = 0;
  plan.primary.birthDate = "1980-01-15";
  plan.spending = [];
  plan.incomes = [];
  plan.liabilities = [
    {
      id: "car",
      name: "Truck",
      kind: "car",
      balance: 2400,
      aprPct: 0,
      monthlyPi: 200,
      originationDate: "2026-01-01",
      termYears: 1,
      includeInSpending: true,
      owner: "primary",
    },
  ];
  const spending = syncLiabilitySpending(plan);
  assert.equal(spending.length, 1);
  assert.equal(spending[0]?.label, "Truck");
  assert.equal(spending[0]?.monthlyAmount, 200);
  assert.equal(spending[0]?.startDate.slice(0, 7), "2026-01");
  assert.equal(spending[0]?.endDate?.slice(0, 7), "2026-12");
  const sim = simulate({ ...plan, spending });
  const at = (key: string) => sim.months.find((m) => m.date.startsWith(key))?.spending ?? -1;
  assert.ok(Math.abs(at("2026-01") - 200) < 1);
  assert.ok(Math.abs(at("2026-06") - 200) < 1);
  assert.ok(Math.abs(at("2026-12") - 200) < 1);
  assert.ok(at("2027-01") < 1);
  const lines = sim.months.find((m) => m.date.startsWith("2026-06"))?.detail.spendingLines ?? [];
  assert.equal(lines.filter((row) => row.label === "Truck").length, 1);
  const off = syncLiabilitySpending({
    ...plan,
    spending,
    liabilities: [{ ...plan.liabilities[0], includeInSpending: false }],
  });
  assert.equal(off.length, 0);
});
