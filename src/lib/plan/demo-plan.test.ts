import assert from "node:assert/strict";
import { test } from "node:test";
import { demoPlan, planHasEntries } from "./demo-plan.ts";
import { createDefaultPlan } from "./defaults.ts";
import { simulate } from "./engine.ts";
import { remainingLiability } from "./liability.ts";
import { remainingMortgage } from "./mortgage.ts";

test("demo household is a diligent Hale couple and does not overspend the paycheck", () => {
  const plan = demoPlan();
  assert.equal(plan.primary.birthDate, "1997-06-12");
  assert.equal(plan.spouse.birthDate, "1998-04-08");
  assert.equal(plan.children.length, 3);
  assert.equal(plan.assumptions.retirementGoalDate, "2057-06-01");
  assert.equal(plan.assumptions.militaryRetireDate, "2038-06-01");
  assert.equal(plan.assumptions.nestEggGoal, 1_800_000);
  const basic = plan.incomes.find((row) => row.id === "demo-o3");
  assert.ok(basic?.endDate);
  assert.equal(basic.monthlyAmount, 8126);
  assert.equal(basic.startDate.slice(0, 7), "2018-06");
  assert.equal(basic.endDate.slice(0, 7), "2028-05");
  assert.ok(plan.incomes.some((row) => row.kind === "military" && row.name.includes("retired")));
  assert.ok(plan.incomes.some((row) => row.kind === "ss"));
  assert.ok(plan.incomes.filter((row) => row.kind === "salary").every((row) => row.endDate));
  const result = simulate(plan);
  assert.equal(result.fundingGaps.length, 0);
  const first = result.months[0];
  assert.ok(first);
  assert.ok(first.income + 1 >= first.spending);
  const mortgage = remainingMortgage(plan.portfolios.find((p) => p.id === "demo-home")?.mortgage, plan.assumptions.asOfDate);
  const car = remainingLiability(plan.liabilities[0], plan.assumptions.asOfDate);
  assert.ok(mortgage > 200_000 && mortgage < 500_000);
  assert.ok(car > 5_000 && car < 30_000);
});

test("a blank plan is not treated as filled", () => {
  assert.equal(planHasEntries(createDefaultPlan()), false);
  const started = createDefaultPlan();
  started.primary.name = "Jordan";
  assert.equal(planHasEntries(started), true);
});
