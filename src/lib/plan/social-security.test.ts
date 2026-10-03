import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import {
  estimatePiaAtFra,
  refreshEstimatedSocialSecurity,
  ssIncomesToCreate,
} from "./social-security.ts";
import type { IncomeStream, Plan } from "./types.ts";

function salary(partial: Partial<IncomeStream> & Pick<IncomeStream, "id" | "monthlyAmount">): IncomeStream {
  return {
    name: "Pay",
    kind: "salary",
    startDate: "2001-06-15",
    endDate: "2045-06-15",
    colaPct: 0,
    taxTreatment: "ordinary",
    person: "primary",
    ...partial,
  };
}

function planWith(streams: IncomeStream[], birth = "1979-06-15"): Plan {
  const plan = createDefaultPlan();
  plan.primary = { name: "Cain", birthDate: birth };
  plan.assumptions.projectionEndAge = 95;
  plan.incomes = streams;
  return plan;
}

test("$120,000 level earnings estimate PIA 3563.20", () => {
  const plan = planWith([salary({ id: "job", monthlyAmount: 10_000 })]);
  assert.equal(estimatePiaAtFra(plan, "primary"), 3563.2);
});

test("wages above the base cap at $184,500", () => {
  const plan = planWith([salary({ id: "job", monthlyAmount: 30_000 })]);
  const capped = planWith([salary({ id: "job", monthlyAmount: 184_500 / 12 })]);
  assert.equal(estimatePiaAtFra(plan, "primary"), 4369.4);
  assert.equal(estimatePiaAtFra(plan, "primary"), estimatePiaAtFra(capped, "primary"));
});

test("pension and VA do not count as covered pay", () => {
  const base = planWith([salary({ id: "job", monthlyAmount: 10_000 })]);
  const plan = planWith([
    salary({ id: "job", monthlyAmount: 10_000 }),
    {
      id: "pen",
      name: "Pension",
      kind: "pension",
      monthlyAmount: 8_000,
      startDate: "2001-06-15",
      endDate: "2045-06-15",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
    {
      id: "va",
      name: "VA",
      kind: "va",
      monthlyAmount: 4_000,
      startDate: "2001-06-15",
      endDate: null,
      colaPct: 0,
      taxTreatment: "tax_free",
      person: "primary",
    },
  ]);
  assert.equal(estimatePiaAtFra(plan, "primary"), estimatePiaAtFra(base, "primary"));
});

test("Yes creates one primary Social Security row and not a second", () => {
  const plan = planWith([salary({ id: "job", monthlyAmount: 10_000 })]);
  const created = ssIncomesToCreate(plan, () => "ss-primary");
  assert.equal(created.length, 1);
  assert.equal(created[0]?.person, "primary");
  assert.equal(created[0]?.ssPia, 3563.2);
  assert.equal(created[0]?.ssClaimAge, 67);
  assert.equal(created[0]?.ssEstimated, true);
  assert.equal(created[0]?.startDate, "2046-06-15");
  assert.equal(created[0]?.endDate, "2074-06-15");
  plan.incomes = [...plan.incomes, ...created];
  assert.equal(ssIncomesToCreate(plan, () => "ss-again").length, 0);
});

test("No adds nothing", () => {
  const plan = planWith([salary({ id: "job", monthlyAmount: 10_000 })]);
  const before = plan.incomes.length;
  assert.equal(plan.incomes.some((row) => row.kind === "ss"), false);
  assert.equal(plan.incomes.length, before);
});

test("spouse not on file gets no estimate and no row", () => {
  const plan = planWith([
    salary({ id: "job", monthlyAmount: 10_000, person: "spouse" }),
  ]);
  plan.spouse = { name: "", birthDate: "" };
  assert.equal(estimatePiaAtFra(plan, "spouse"), null);
  assert.equal(ssIncomesToCreate(plan, () => "ss").length, 0);
});

test("spouse salary estimates the spouse and is not added to the primary", () => {
  const plan = planWith([salary({ id: "job", monthlyAmount: 10_000 })]);
  const primaryOnly = estimatePiaAtFra(plan, "primary");
  plan.spouse = { name: "Sarah", birthDate: "1986-03-04" };
  plan.incomes.push(salary({ id: "hers", monthlyAmount: 5_000, person: "spouse" }));
  assert.equal(estimatePiaAtFra(plan, "primary"), primaryOnly);
  const spousePia = estimatePiaAtFra(plan, "spouse");
  assert.ok(spousePia != null && spousePia !== primaryOnly);
  const rows = ssIncomesToCreate(plan, (person) => `ss-${person}`);
  assert.deepEqual(
    rows.map((row) => row.person),
    ["primary", "spouse"],
  );
  assert.equal(rows[1]?.name, "Social Security — Sarah");
  assert.equal(rows[1]?.ssPia, spousePia);
});

test("Calculate refreshes an estimated PIA and leaves a typed one", () => {
  const plan = planWith([salary({ id: "job", monthlyAmount: 10_000 })]);
  const [row] = ssIncomesToCreate(plan, () => "ss-primary");
  assert.ok(row);
  plan.incomes.push(row);
  plan.incomes[0] = salary({ id: "job", monthlyAmount: 12_000 });
  const next = refreshEstimatedSocialSecurity(plan);
  assert.equal(next.incomes.find((item) => item.id === "ss-primary")?.ssPia, 3863.2);
  const typed = refreshEstimatedSocialSecurity({
    ...next,
    incomes: next.incomes.map((item) =>
      item.id === "ss-primary" ? { ...item, ssPia: 1500, ssEstimated: false } : item,
    ),
  });
  assert.equal(typed.incomes.find((item) => item.id === "ss-primary")?.ssPia, 1500);
});
