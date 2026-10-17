import assert from "node:assert/strict";
import test from "node:test";
import { accountCanPay, appendQuizAccount, nestEggForAskedMonth, quizPlan, retireCaption, retirementIso } from "./quiz-plan.ts";
import { vaPayTodayDollars, vaSchedularPay } from "./va.ts";

const today = new Date(2026, 9, 15);

test("retirement is January of birth year plus age, or this month if that January has passed", () => {
  assert.equal(retirementIso(1994, 55, today), "2049-01-01");
  assert.equal(retireCaption(1994, 55, today), "That's 2049.");
  assert.equal(retirementIso(1970, 55, today), "2026-10-01");
  assert.equal(retireCaption(1970, 55, today), "That's this year.");
});

test("everything they have is one traditional pile named All accounts", () => {
  const plan = quizPlan(
    {
      monthlyNeed: 5000,
      retireAge: 55,
      birthYear: 1994,
      accountName: "TSP",
      kind: "roth_ira",
      balance: 400000,
      monthlySave: 500,
      pay: "none",
      payMonthly: 0,
      scope: "all",
    },
    today,
  );
  assert.equal(plan.portfolios.length, 1);
  assert.equal(plan.portfolios[0]?.name, "All accounts");
  assert.equal(plan.portfolios[0]?.kind, "ira");
  assert.equal(plan.portfolios[0]?.taxBucket, "pre_tax");
  assert.equal(plan.portfolios[0]?.currentValue, 400000);
});

test("a VA rating and dependents use the 2026 table, with no spouse", () => {
  const plan = quizPlan(
    {
      monthlyNeed: 5000,
      retireAge: 55,
      birthYear: 1994,
      accountName: "TSP",
      kind: "tsp",
      balance: 50000,
      monthlySave: 0,
      pay: "va",
      payMonthly: 1,
      pays: { military: 0, va: 1, pension: 0 },
      vaRating: 100,
      vaDependents: 1,
    },
    today,
  );
  const va = plan.incomes.find((row) => row.kind === "va");
  const table = vaSchedularPay(100, false, 1);
  assert.equal(va?.monthlyAmount, table);
  assert.equal(va?.vaRatingPct, undefined);
  assert.equal(va?.vaSpouseDependent, undefined);
  assert.equal(plan.children.length, 0);
  assert.equal(plan.spouse.name, "");
  assert.equal(plan.spouse.birthDate, "");
  assert.equal(vaPayTodayDollars(plan, va!, today), table);
  const withSpouse = quizPlan(
    {
      monthlyNeed: 5000,
      retireAge: 55,
      birthYear: 1994,
      accountName: "TSP",
      kind: "tsp",
      balance: 50000,
      monthlySave: 0,
      pay: "va",
      payMonthly: 1,
      pays: { military: 0, va: 1, pension: 0 },
      vaRating: 100,
      vaDependents: 1,
      vaSpouse: true,
    },
    today,
  );
  const spousePay = withSpouse.incomes.find((row) => row.kind === "va");
  assert.equal(spousePay?.monthlyAmount, vaSchedularPay(100, true, 1));
  assert.equal(spousePay?.vaRatingPct, undefined);
  assert.equal(spousePay?.vaSpouseDependent, undefined);
  assert.equal(withSpouse.children.length, 0);
  assert.equal(withSpouse.spouse.name, "");
  assert.equal(vaPayTodayDollars(withSpouse, spousePay!, today), vaSchedularPay(100, true, 1));
});

test("the sketch is one account, savings stop before retirement, and spending starts then", () => {
  const plan = quizPlan(
    {
      monthlyNeed: 5000,
      retireAge: 55,
      birthYear: 1994,
      accountName: "",
      kind: "tsp",
      balance: 50000,
      monthlySave: 500,
      pay: "military",
      payMonthly: 2000,
    },
    today,
  );
  assert.equal(plan.primary.birthDate, "1994-01-01");
  assert.equal(plan.primary.name, "");
  assert.equal(plan.assumptions.dollars, "real");
  assert.equal(plan.assumptions.retirementGoalDate, "2049-01-01");
  assert.equal(plan.assumptions.careerEndDate, "2049-01-01");
  assert.equal(plan.assumptions.militaryRetireDate, "2049-01-01");
  assert.equal(plan.portfolios.length, 1);
  assert.equal(plan.portfolios[0]?.name, "TSP");
  assert.equal(plan.portfolios[0]?.kind, "tsp");
  assert.equal(plan.portfolios[0]?.currentValue, 50000);
  assert.equal(plan.contributions.length, 1);
  assert.equal(plan.contributions[0]?.endDate, "2048-12-01");
  assert.equal(plan.spending[0]?.startDate, "2049-01-01");
  assert.equal(plan.spending[0]?.monthlyAmount, 5000);
  const military = plan.incomes.find((row) => row.kind === "military");
  assert.equal(military?.startDate, "2049-01-01");
  assert.equal(plan.incomes.some((row) => row.name === "Put in each month"), false);
  assert.equal(plan.children.length, 0);
  assert.equal(plan.liabilities.length, 0);
  assert.equal(plan.spouse.birthDate, "");
  assert.equal(plan.assumptions.goalMode, "nest");
  assert.equal(plan.assumptions.incomeGoalMonthly, null);
});

test("VA starts now and a pension starts at retirement", () => {
  const va = quizPlan(
    {
      monthlyNeed: 4000,
      retireAge: 60,
      birthYear: 1990,
      accountName: "Brokerage",
      kind: "taxable",
      balance: 10000,
      monthlySave: 0,
      pay: "va",
      payMonthly: 1500,
    },
    today,
  );
  assert.equal(va.incomes[0]?.startDate, va.assumptions.asOfDate);
  assert.equal(va.incomes[0]?.taxTreatment, "tax_free");
  assert.equal(va.contributions.length, 0);
  const pension = quizPlan(
    {
      monthlyNeed: 4000,
      retireAge: 60,
      birthYear: 1990,
      accountName: "IRA",
      kind: "ira",
      balance: 10000,
      monthlySave: 100,
      pay: "pension",
      payMonthly: 800,
    },
    today,
  );
  assert.equal(pension.incomes.find((row) => row.kind === "pension")?.startDate, "2050-01-01");
  assert.equal(pension.assumptions.militaryRetireDate, "2026-09-01");
});

test("more than one paycheck can sit beside the account", () => {
  const plan = quizPlan(
    {
      monthlyNeed: 5000,
      retireAge: 55,
      birthYear: 1994,
      accountName: "TSP",
      kind: "tsp",
      balance: 50000,
      monthlySave: 0,
      pay: "none",
      payMonthly: 0,
      pays: { military: 3200, va: 1800, pension: 0 },
    },
    today,
  );
  assert.equal(plan.incomes.find((row) => row.kind === "military")?.monthlyAmount, 3200);
  assert.equal(plan.incomes.find((row) => row.kind === "military")?.startDate, "2049-01-01");
  assert.equal(plan.incomes.find((row) => row.kind === "va")?.monthlyAmount, 1800);
  assert.equal(plan.incomes.find((row) => row.kind === "va")?.taxTreatment, "tax_free");
  assert.equal(plan.incomes.find((row) => row.kind === "va")?.startDate, plan.assumptions.asOfDate);
  assert.equal(plan.incomes.find((row) => row.kind === "pension"), undefined);
  assert.equal(plan.assumptions.militaryRetireDate, "2049-01-01");
  assert.equal(accountCanPay(plan), accountCanPay(quizPlan({ ...{
    monthlyNeed: 5000, retireAge: 55, birthYear: 1994, accountName: "TSP", kind: "tsp", balance: 50000, monthlySave: 0, pay: "none", payMonthly: 0,
  } }, today)));
});

test("an unfunded contribution does not grow the account, and guaranteed pay still does not", () => {
  const base = {
    monthlyNeed: 8000,
    retireAge: 55,
    birthYear: 1994,
    accountName: "Roth",
    kind: "roth_ira" as const,
    balance: 200000,
    payMonthly: 3000,
  };
  const plain = accountCanPay(quizPlan({ ...base, monthlySave: 0, pay: "none" }, today));
  const saving = accountCanPay(quizPlan({ ...base, monthlySave: 500, pay: "none" }, today));
  const withPay = accountCanPay(quizPlan({ ...base, monthlySave: 500, pay: "military" }, today));
  assert.equal(saving, plain);
  assert.equal(withPay, saving);
});

test("the nest egg is the capital that pays the month they asked for", () => {
  const asked = {
    monthlyNeed: 8000,
    retireAge: 60,
    birthYear: 1985,
    accountName: "TSP",
    kind: "tsp" as const,
    balance: 200000,
    monthlySave: 500,
    pay: "military" as const,
    payMonthly: 3000,
  };
  const nest = nestEggForAskedMonth(asked, today);
  const half = nestEggForAskedMonth({ ...asked, monthlyNeed: 4000 }, today);
  const roth = nestEggForAskedMonth({ ...asked, kind: "roth_ira" }, today);
  const later = nestEggForAskedMonth({ ...asked, retireAge: 70 }, today);
  assert.ok(nest > 1_000_000);
  assert.ok(Math.abs(nest / 2 - half) / nest < 0.02);
  assert.ok(roth < nest);
  assert.ok(later < nest);
});

test("a first name on the sketch is the first word only", () => {
  const named = quizPlan(
    {
      firstName: "Cain Olde",
      monthlyNeed: 5000,
      retireAge: 55,
      birthYear: 1994,
      accountName: "TSP",
      kind: "tsp",
      balance: 50000,
      monthlySave: 0,
      pay: "none",
      payMonthly: 0,
    },
    today,
  );
  assert.equal(named.primary.name, "Cain");
});

test("a signed-in quiz adds the account and leaves the rest of the household", () => {
  const existing = quizPlan(
    {
      monthlyNeed: 7000,
      retireAge: 57,
      birthYear: 1979,
      accountName: "TSP",
      kind: "tsp",
      balance: 180000,
      monthlySave: 1000,
      pay: "none",
      payMonthly: 0,
    },
    today,
  );
  existing.primary.name = "Cain";
  existing.spouse = { ...existing.spouse, name: "Sarah", birthDate: "1986-01-01" };
  const keptId = existing.portfolios[0]?.id;
  const sketch = quizPlan(
    {
      firstName: "Someone",
      monthlyNeed: 3000,
      retireAge: 50,
      birthYear: 1990,
      accountName: "Brokerage",
      kind: "taxable",
      balance: 10000,
      monthlySave: 200,
      pay: "military",
      payMonthly: 4000,
    },
    today,
  );
  const merged = appendQuizAccount(existing, sketch);
  assert.equal(existing.portfolios.length, 1);
  assert.equal(merged.portfolios.length, 2);
  assert.equal(merged.portfolios[0]?.id, keptId);
  assert.equal(merged.portfolios[0]?.currentValue, 180000);
  assert.equal(merged.portfolios[1]?.name, "Brokerage");
  assert.equal(merged.portfolios[1]?.kind, "taxable");
  assert.equal(merged.portfolios[1]?.currentValue, 10000);
  assert.equal(merged.contributions.length, 2);
  assert.equal(merged.contributions[1]?.portfolioId, merged.portfolios[1]?.id);
  assert.equal(merged.primary.name, "Cain");
  assert.equal(merged.spouse.name, "Sarah");
  assert.equal(merged.assumptions.retirementGoalDate, existing.assumptions.retirementGoalDate);
  assert.equal(merged.spending[0]?.monthlyAmount, 7000);
  assert.equal(merged.incomes.some((row) => row.kind === "military"), false);
  assert.equal(merged.incomes.filter((row) => row.name === "Put in each month").length, 0);
});
