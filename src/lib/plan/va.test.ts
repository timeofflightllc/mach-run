import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { simulate } from "./engine.ts";
import { monthStart } from "./dates.ts";
import {
  VA_RATES_2026,
  childrenUnder18,
  vaPayTodayDollars,
  vaSchedularPay,
} from "./va.ts";
import type { IncomeStream } from "./types.ts";

function near(a: number, b: number, cents = 0.02) {
  assert.ok(Math.abs(a - b) < cents, `expected ${b}, got ${a}`);
}

test("2026 VA.gov table: 100% spouse + 1 child, extra kids add $109.11", () => {
  near(vaSchedularPay(100, true, 0), 4158.17);
  near(vaSchedularPay(100, true, 1), 4318.99);
  near(vaSchedularPay(100, true, 3), 4318.99 + 2 * 109.11);
  near(vaSchedularPay(100, false, 0), 3938.58);
  near(vaSchedularPay(70, true, 1), 2074.45);
  near(vaSchedularPay(20, true, 3), 356.66);
});

test("30–90 additional-child column matches VA.gov", () => {
  near(VA_RATES_2026[30].additionalChild, 32);
  near(VA_RATES_2026[60].additionalChild, 65);
  near(VA_RATES_2026[90].additionalChild, 98);
  near(vaSchedularPay(50, true, 2), 1322.9 + 54);
});

test("rating + kids steps down to veteran+spouse as each child turns 18", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-08-01";
  plan.assumptions.inflationPct = 0;
  plan.spouse = { name: "Spouse", birthDate: "1982-01-01" };
  plan.children = [
    { id: "a", name: "A", birthDate: "2008-09-01" },
    { id: "b", name: "B", birthDate: "2010-01-01" },
    { id: "c", name: "C", birthDate: "2012-01-01" },
  ];
  const stream: IncomeStream = {
    id: "va",
    name: "VA",
    kind: "va",
    monthlyAmount: 0,
    startDate: "2026-08-01",
    endDate: null,
    colaPct: 0,
    taxTreatment: "tax_free",
    person: "primary",
    vaRatingPct: 100,
    vaSpouseDependent: true,
  };
  plan.incomes = [stream];
  plan.spending = [];

  const asOf = monthStart("2026-08-01");
  assert.equal(childrenUnder18(plan.children, asOf).length, 3);
  near(vaPayTodayDollars(plan, stream, asOf), 4318.99 + 2 * 109.11);
  near(vaPayTodayDollars(plan, stream, monthStart("2026-09-01")), 4318.99 + 109.11);
  near(vaPayTodayDollars(plan, stream, monthStart("2028-01-01")), 4318.99);
  near(vaPayTodayDollars(plan, stream, monthStart("2030-01-01")), 4158.17);

  const sim = simulate(plan);
  const aug = sim.months.find((m) => m.date.startsWith("2026-08"));
  const sep = sim.months.find((m) => m.date.startsWith("2026-09"));
  near(aug?.income ?? 0, 4318.99 + 2 * 109.11, 0.05);
  near(sep?.income ?? 0, 4318.99 + 109.11, 0.05);
});

test("no rating and no typed amount pays nothing", () => {
  const plan = createDefaultPlan();
  const stream: IncomeStream = {
    id: "va",
    name: "VA",
    kind: "va",
    monthlyAmount: 0,
    startDate: "2026-08-01",
    endDate: null,
    colaPct: 0,
    taxTreatment: "tax_free",
    person: "primary",
  };
  assert.equal(vaPayTodayDollars(plan, stream, monthStart("2026-08-01")), 0);
});
