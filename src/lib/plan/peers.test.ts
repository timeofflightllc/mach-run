import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { simulate } from "./engine.ts";
import { buildPeerBrief, percentileFromKnots } from "./peers.ts";

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
  assert.match(brief.headline, /top \d+%/i);
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
