import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { economicHash, runOutSentence, runSurvival, survivalPercent, survivalSentence } from "./monte-carlo-run.ts";
import type { Plan } from "./types.ts";

function shortPlan(): Plan {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.projectionEndAge = 47;
  plan.assumptions.defaultReturnPct = 7;
  plan.primary = { name: "Pat", birthDate: "1980-01-01" };
  plan.spouse = { name: "", birthDate: "" };
  plan.children = [];
  plan.stages = [];
  plan.incomes = [];
  plan.spending = [];
  plan.contributions = [];
  plan.liabilities = [];
  plan.portfolios = [
    {
      id: "port-one",
      name: "Brokerage",
      kind: "taxable",
      owner: "primary",
      currentValue: 100_000,
      returnPct: 7,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  return plan;
}

test("survivalPercent rounds half up to a whole number of 100", () => {
  assert.equal(survivalPercent(847, 1000), 85);
  assert.equal(survivalPercent(844, 1000), 84);
  assert.equal(survivalPercent(845, 1000), 85);
});

test("survivalSentence is a whole number of 100", () => {
  assert.equal(
    survivalSentence(0, 99),
    "In 0 of 100 futures like this one, your money lasts through your longevity age (99).",
  );
  assert.equal(
    survivalSentence(85, 99),
    "In 85 of 100 futures like this one, your money lasts through your longevity age (99).",
  );
  assert.equal(
    survivalSentence(100, 95),
    "In 100 of 100 futures like this one, your money lasts through your longevity age (95).",
  );
});

test("runOutSentence counts the paths that failed, not the rounded rate", () => {
  assert.equal(
    runOutSentence({ survived: 960, paths: 1000, runOutAge: 92 }, 99),
    "In the 40 of 1,000 random futures that did run out of money prior to longevity age, the middle one runs out at age 92.",
  );
  assert.equal(runOutSentence({ survived: 1000, paths: 1000, runOutAge: null }, 99), null);
});

test("runOutAge is null when every future lasts", async () => {
  const score = await runSurvival(shortPlan(), "typical", {
    runOne: () => ({ depletedAge: null }),
  });
  assert.ok(score);
  assert.equal(score.runOutAge, null);
});

test("an odd count of run-out ages keeps the middle age", async () => {
  const ages = [90, 70, 80];
  let i = 0;
  const score = await runSurvival(shortPlan(), "typical", {
    runOne: () => {
      const n = i++;
      return { depletedAge: n < ages.length ? ages[n] : null };
    },
  });
  assert.ok(score);
  assert.equal(score.runOutAge, 80);
});

test("an even count of run-out ages keeps the earlier of the two middle ages", async () => {
  const ages = [90, 60, 80, 70];
  let i = 0;
  const score = await runSurvival(shortPlan(), "typical", {
    runOne: () => {
      const n = i++;
      return { depletedAge: n < ages.length ? ages[n] : null };
    },
  });
  assert.ok(score);
  assert.equal(score.runOutAge, 70);
});

test("the same plan and swing resolve the same hash and the same score", async () => {
  const plan = shortPlan();
  const first = await runSurvival(plan, "typical");
  const second = await runSurvival(plan, "typical");
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.hash, second.hash);
  assert.equal(first.score, second.score);
  assert.equal(first.survived, second.survived);
  assert.equal(first.paths, 1000);
  assert.equal(economicHash(plan, "typical"), first.hash);
});

test("renaming an account does not change the hash, changing the balance does", () => {
  const plan = shortPlan();
  const before = economicHash(plan, "typical");
  plan.portfolios[0].name = "Rainy day";
  plan.portfolios[0].institutionName = "A different bank";
  assert.equal(economicHash(plan, "typical"), before);
  plan.portfolios[0].currentValue = 100_001;
  assert.notEqual(economicHash(plan, "typical"), before);
});

test("calm and typical on the same plan do not share a hash", () => {
  const plan = shortPlan();
  assert.notEqual(economicHash(plan, "calm"), economicHash(plan, "typical"));
});

test("no spending and a positive spendable balance scores 100", async () => {
  const score = await runSurvival(shortPlan(), "rough");
  assert.ok(score);
  assert.equal(score.score, 100);
  assert.equal(score.survived, 1000);
  assert.equal(score.swing, "rough");
});

test("spending and no accounts scores 0", async () => {
  const plan = shortPlan();
  plan.portfolios = [];
  plan.spending = [
    {
      id: "spend-life",
      label: "Life",
      monthlyAmount: 1000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  const score = await runSurvival(plan, "calm");
  assert.ok(score);
  assert.equal(score.score, 0);
  assert.equal(score.survived, 0);
});

test("mutating the caller's balance after runSurvival starts does not change the score", async () => {
  const plan = shortPlan();
  plan.portfolios[0].currentValue = 10_000;
  plan.portfolios[0].returnPct = 0;
  plan.spending = [
    {
      id: "spend-life",
      label: "Life",
      monthlyAmount: 5000,
      startDate: "2026-01-01",
      endDate: null,
    },
  ];
  const pending = runSurvival(plan, "calm");
  plan.portfolios[0].currentValue = 5_000_000;
  const score = await pending;
  assert.ok(score);
  assert.equal(score.score, 0);
  assert.notEqual(score.hash, economicHash(plan, "calm"));
  const original = shortPlan();
  original.portfolios[0].currentValue = 10_000;
  original.portfolios[0].returnPct = 0;
  original.spending = plan.spending;
  assert.equal(score.hash, economicHash(original, "calm"));
});

test("a thrown simulate resolves null and does not reject", async () => {
  await assert.doesNotReject(async () => {
    const score = await runSurvival(shortPlan(), "typical", {
      runOne() {
        throw new Error("boom");
      },
    });
    assert.equal(score, null);
  });
});

test("an unknown swing resolves null and does not reject", async () => {
  const score = await runSurvival(shortPlan(), "nope");
  assert.equal(score, null);
});
