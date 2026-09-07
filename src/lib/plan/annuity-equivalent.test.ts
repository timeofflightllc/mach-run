import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import {
  guaranteedAnnuityEquivalent,
  presentValueOfGuaranteedStream,
  ZERO_RISK_DISCOUNT_PCT,
} from "./annuity-equivalent.ts";
import type { IncomeStream } from "./types.ts";

function mil(partial: Partial<IncomeStream>): IncomeStream {
  return {
    id: "inc-mil",
    name: "Military retired pay",
    kind: "military",
    monthlyAmount: 1000,
    startDate: "2026-09-01",
    endDate: "2027-08-01",
    colaPct: 0,
    taxTreatment: "ordinary",
    person: "primary",
    ...partial,
  };
}

test("level 12-month check PV matches growing-annuity formula at 4%", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-09-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultColaPct = 0;
  const stream = mil({ colaPct: 0 });
  plan.incomes = [stream];
  const r = (1 + ZERO_RISK_DISCOUNT_PCT / 100) ** (1 / 12) - 1;
  // First check is this month (annuity-due).
  const expected = (1000 * (1 - (1 + r) ** -12) / r) * (1 + r);
  const pv = presentValueOfGuaranteedStream(plan, stream);
  assert.ok(Math.abs(pv - expected) < 2, `pv ${pv} vs ${expected}`);
});

test("salary is not treated as a guaranteed annuity", () => {
  const plan = createDefaultPlan();
  plan.incomes = [
    mil({
      id: "inc-job",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 20000,
      endDate: null,
    }),
  ];
  assert.equal(guaranteedAnnuityEquivalent(plan), null);
});

test("two guaranteed checks stack in the combined total", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-09-01";
  plan.primary.birthDate = "1979-06-15";
  plan.incomes = [
    mil({ id: "inc-mil", monthlyAmount: 8000, endDate: null, colaPct: 2.5 }),
    mil({
      id: "inc-va",
      name: "VA disability",
      kind: "va",
      monthlyAmount: 4000,
      startDate: "2026-09-01",
      endDate: null,
      colaPct: 2.5,
      taxTreatment: "tax_free",
    }),
  ];
  const eq = guaranteedAnnuityEquivalent(plan);
  assert.ok(eq);
  assert.equal(eq.lines.length, 2);
  assert.ok(eq.totalPvToday > 1_000_000);
  assert.ok(Math.abs(eq.totalPvToday - eq.lines[0].pvToday - eq.lines[1].pvToday) < 1);
});
