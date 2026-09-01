import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { simulate } from "./engine.ts";
import { buildPeerBrief, debtSentence, nestEggTrack, percentileFromKnots } from "./peers.ts";

test("percentile interpolates between knots", () => {
  const knots = [
    { p: 25, v: 100 },
    { p: 50, v: 200 },
    { p: 75, v: 400 },
  ];
  assert.equal(percentileFromKnots(200, knots), 50);
  assert.ok(percentileFromKnots(150, knots) > 25);
  assert.ok(percentileFromKnots(150, knots) < 50);
  assert.ok(percentileFromKnots(10_000, knots) >= 75);
});

test("brief is blunt when the household is empty", () => {
  const plan = createDefaultPlan();
  const sim = simulate(plan);
  const brief = buildPeerBrief(plan, sim, { expanded: true });
  assert.match(brief.headline, /nothing to rank/i);
  assert.ok(brief.runAt.length > 0);
});

test("brief ranks a fat nest egg in the 45–54 band", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1976-01-01";
  plan.portfolios = [
    {
      id: "p1",
      name: "Brokerage",
      kind: "taxable",
      owner: "Joint",
      currentValue: 2_200_000,
      returnPct: null,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.incomes = [
    {
      id: "inc",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 12_000,
      startDate: "2026-08-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  const sim = simulate(plan);
  const brief = buildPeerBrief(plan, sim, { expanded: true });
  assert.ok((brief.nwPercentile ?? 0) >= 85);
  assert.ok((brief.incomePercentile ?? 0) >= 60);
  assert.match(brief.paragraphs.join(" "), /top \d+%/i);
  assert.match(brief.headline, /on track|financial independence|good shape|well done|early|partway|underway/i);
});

test("brief sees income that starts after as-of", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1976-01-01";
  plan.incomes = [
    {
      id: "inc-job",
      name: "BGS",
      kind: "salary",
      monthlyAmount: 18000,
      startDate: "2027-01-01",
      endDate: "2036-09-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.portfolios = [
    {
      id: "p1",
      name: "Brokerage",
      kind: "taxable",
      owner: "Joint",
      currentValue: 400000,
      returnPct: null,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  const sim = simulate(plan);
  assert.ok((sim.months[0]?.income ?? 0) < 1, "month 0 has no paycheck yet");
  const brief = buildPeerBrief(plan, sim, { expanded: true });
  assert.ok(brief.annualIncome > 100000);
  assert.match(brief.paragraphs.join(" "), /BGS/);
  assert.doesNotMatch(brief.paragraphs.join(" "), /No income on the run/);
});

test("free and paid generate the same full OODA; expanded is a clip flag", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1976-01-01";
  plan.portfolios = [
    {
      id: "p1",
      name: "Brokerage",
      kind: "taxable",
      owner: "Joint",
      currentValue: 400_000,
      returnPct: null,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.incomes = [
    {
      id: "inc",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 12_000,
      startDate: "2026-08-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  const sim = simulate(plan);
  const short = buildPeerBrief(plan, sim, { expanded: false });
  const full = buildPeerBrief(plan, sim, { expanded: true });
  assert.equal(short.expanded, false);
  assert.equal(full.expanded, true);
  assert.equal(short.paragraphs.length, full.paragraphs.length);
  assert.ok(full.paragraphs.length > 4);
  assert.doesNotMatch(short.paragraphs.join(" "), /short OODA/i);
  assert.match(full.paragraphs.join(" "), /RMD/);
  assert.match(full.paragraphs.join(" "), /Accounts on this run/);
});

test("nest egg goal says extra monthly when the pile will miss", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1976-01-01";
  plan.assumptions.retirementGoalDate = "2041-01-01";
  plan.assumptions.nestEggGoal = 3_000_000;
  plan.assumptions.defaultReturnPct = 7;
  plan.assumptions.inflationPct = 2.5;
  plan.portfolios = [
    {
      id: "p1",
      name: "Brokerage",
      kind: "taxable",
      owner: "Joint",
      currentValue: 50_000,
      returnPct: null,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.incomes = [];
  plan.contributions = [];
  plan.spending = [
    {
      id: "sp-1",
      label: "Spend",
      monthlyAmount: 0,
      startDate: "2026-08-01",
      endDate: null,
    },
  ];
  const sim = simulate(plan);
  const track = nestEggTrack(plan, sim);
  assert.ok(track);
  assert.equal(track.onTrack, false);
  assert.ok(track.extraMonthly > 1000);
  const brief = buildPeerBrief(plan, sim, { expanded: true });
  assert.match(brief.headline, /not on track/i);
  assert.match(brief.paragraphs.join(" "), /more per month/i);
});

test("debt sentence names remaining principal and last payoff year", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-08-01";
  plan.portfolios = [
    {
      id: "house",
      name: "House",
      kind: "real_estate",
      owner: "joint",
      currentValue: 400_000,
      returnPct: 0,
      taxBucket: "none",
      spendable: false,
      includeInNetWorth: true,
      mortgage: {
        originationDate: "2020-08-01",
        aprPct: 4,
        monthlyPi: 1500,
        termYears: 30,
        includeInSpending: true,
        associated: true,
      },
    },
  ];
  plan.liabilities = [
    {
      id: "lia-car",
      name: "Car",
      kind: "car",
      balance: 20_000,
      originationDate: "2023-08-01",
      aprPct: 6,
      monthlyPi: 400,
      termYears: 6,
      includeInSpending: true,
      owner: "primary",
    },
  ];
  const line = debtSentence(plan);
  assert.ok(line);
  assert.match(line, /Remaining debt now is/);
  assert.match(line, /Last modeled loan pays off Aug 2050/);
  const sim = simulate(plan);
  const brief = buildPeerBrief(plan, sim, { expanded: true });
  assert.match(brief.paragraphs.join(" "), /Remaining debt now is/);
});

test("debt sentence is null when there are no loans", () => {
  const plan = createDefaultPlan();
  assert.equal(debtSentence(plan), null);
});

test("OODA paychecks sort by start date and print month then year", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1976-01-01";
  plan.incomes = [
    {
      id: "later",
      name: "Pension",
      kind: "pension",
      monthlyAmount: 2000,
      startDate: "2036-09-01",
      endDate: null,
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
    {
      id: "earlier",
      name: "W-2",
      kind: "salary",
      monthlyAmount: 10_000,
      startDate: "2026-08-01",
      endDate: "2036-08-01",
      colaPct: 0,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  plan.portfolios = [
    {
      id: "p1",
      name: "Brokerage",
      kind: "taxable",
      owner: "Joint",
      currentValue: 100_000,
      returnPct: null,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  const sim = simulate(plan);
  const pay = buildPeerBrief(plan, sim, { expanded: true }).sections.find(
    (s) => s.title === "Paychecks",
  );
  assert.ok(pay);
  const w2 = pay.body.indexOf("W-2");
  const pension = pay.body.indexOf("Pension");
  assert.ok(w2 >= 0 && pension > w2);
  assert.match(pay.body, /Aug 2026/);
  assert.match(pay.body, /Sep 2036/);
  assert.doesNotMatch(pay.body, /2026-08/);
});

