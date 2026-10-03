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
  const accounts = full.sections.find((s) => s.title === "Accounts on this run");
  assert.equal(accounts?.table?.rows[0]?.[0], "Brokerage");
  assert.match(accounts?.table?.rows[0]?.[1] ?? "", /\$400,000/);
  assert.equal(accounts?.table?.rows[0]?.[2], "—");
});

test("account table shows today's-dollar balance entering retirement", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1976-01-01";
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 7;
  plan.assumptions.retirementGoalDate = "2036-01-01";
  plan.incomes = [];
  plan.spending = [];
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
  const row = buildPeerBrief(plan, sim, { expanded: true }).sections.find(
    (s) => s.title === "Accounts on this run",
  )?.table?.rows[0];
  assert.equal(row?.[1], "$100,000");
  assert.match(row?.[2] ?? "", /^\$19[0-9],[0-9]{3}/);
});

test("real estate at the inflation rate holds today's dollars and still compounds", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1980-11-01";
  plan.assumptions.asOfDate = "2026-09-01";
  plan.assumptions.inflationPct = 3;
  plan.assumptions.defaultReturnPct = 7;
  plan.assumptions.retirementGoalDate = "2040-11-01";
  plan.incomes = [];
  plan.spending = [];
  plan.portfolios = [
    {
      id: "house",
      name: "Shire Lane Home",
      kind: "real_estate",
      owner: "joint",
      currentValue: 600_000,
      returnPct: 3,
      taxBucket: "none",
      spendable: false,
      includeInNetWorth: true,
    },
  ];
  const sim = simulate(plan);
  const row = buildPeerBrief(plan, sim, { expanded: true }).sections.find(
    (s) => s.title === "Accounts on this run",
  )?.table?.rows[0];
  const match = /^\$([0-9,]+) \(\$([0-9,]+) today\)$/.exec(row?.[2] ?? "");
  assert.ok(match, row?.[2]);
  const nominal = Number(match?.[1].replace(/,/g, ""));
  const real = Number(match?.[2].replace(/,/g, ""));
  assert.ok(nominal > 900_000 && nominal < 930_000, row?.[2]);
  assert.ok(Math.abs(real - 600_000) < 1, row?.[2]);
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
        institutionName: "Rocket Mortgage",
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
      institutionName: "Navy Federal",
    },
  ];
  const line = debtSentence(plan);
  assert.ok(line);
  assert.match(line, /The Rocket Mortgage loan on your House is \$/);
  assert.match(line, /You pay it off in August 2050/);
  assert.match(line, /Your Navy Federal car loan is \$/);
  assert.match(line, /You pay it off in August 2029/);
  assert.doesNotMatch(line, /Remaining debt now is/);
  const sim = simulate(plan);
  const brief = buildPeerBrief(plan, sim, { expanded: true });
  assert.match(brief.paragraphs.join("\n"), /Rocket Mortgage loan on your House/);
});

test("debt sentence is null when there are no loans", () => {
  const plan = createDefaultPlan();
  assert.equal(debtSentence(plan), null);
});

test("debt sentence ties each loan to the planned retirement date", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-08-01";
  plan.assumptions.retirementGoalDate = "2040-01-01";
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
        institutionName: "Rocket Mortgage",
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
      institutionName: "Navy Federal",
    },
  ];
  const mixed = debtSentence(plan);
  assert.ok(mixed);
  assert.match(mixed, /August 2029, about 10 years before your planned retirement in January 2040/);
  assert.match(mixed, /At your planned retirement in January 2040, about \$/);
  assert.match(mixed, /will still be on it|is still owed/);
  assert.doesNotMatch(mixed, /debt free|Well done/);

  plan.assumptions.retirementGoalDate = "2060-01-01";
  const clear = debtSentence(plan);
  assert.ok(clear);
  assert.match(clear, /before your planned retirement in January 2060/);
  assert.match(clear, /You reach that retirement date with these loans paid off\.\s+Well done\./);
  assert.doesNotMatch(clear, /is still owed/);
});

test("debt sentence praises a light debt-to-asset ratio and flags a heavy one", () => {
  const light = createDefaultPlan();
  light.assumptions.asOfDate = "2026-08-01";
  light.portfolios = [
    {
      id: "cash",
      name: "Savings",
      kind: "taxable",
      owner: "primary",
      currentValue: 1_000_000,
      returnPct: 0,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  light.liabilities = [
    {
      id: "small",
      name: "Card",
      kind: "credit_card",
      balance: 1_200,
      originationDate: "2026-08-01",
      aprPct: 0,
      monthlyPi: 100,
      termYears: 1,
      includeInSpending: true,
      owner: "primary",
    },
  ];
  const praised = debtSentence(light);
  assert.ok(praised);
  assert.match(praised, /light load/);
  assert.match(praised, /29%/);

  const heavy = createDefaultPlan();
  heavy.assumptions.asOfDate = "2026-08-01";
  heavy.portfolios = [
    {
      id: "cash",
      name: "Savings",
      kind: "taxable",
      owner: "primary",
      currentValue: 50_000,
      returnPct: 0,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  heavy.liabilities = [
    {
      id: "big",
      name: "Personal",
      kind: "personal",
      balance: 120_000,
      originationDate: "2026-08-01",
      aprPct: 0,
      monthlyPi: 1_000,
      termYears: 10,
      includeInSpending: true,
      owner: "primary",
    },
  ];
  const warned = debtSentence(heavy);
  assert.ok(warned);
  assert.match(warned, /larger than what you own/);
  assert.match(warned, /tight spot, not a verdict/);
  assert.doesNotMatch(warned, /light load/);
});

test("debt section scores the ratio at retirement against today", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1976-01-01";
  plan.assumptions.asOfDate = "2026-08-01";
  plan.assumptions.inflationPct = 0;
  plan.assumptions.defaultReturnPct = 0;
  plan.assumptions.retirementGoalDate = "2036-01-01";
  plan.assumptions.projectionEndAge = 95;
  plan.incomes = [];
  plan.spending = [];
  plan.portfolios = [
    {
      id: "cash",
      name: "Savings",
      kind: "taxable",
      owner: "primary",
      currentValue: 400_000,
      returnPct: 0,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  plan.liabilities = [
    {
      id: "note",
      name: "Personal",
      kind: "personal",
      balance: 200_000,
      originationDate: "2026-08-01",
      aprPct: 0,
      monthlyPi: 1_000,
      termYears: 30,
      includeInSpending: true,
      owner: "primary",
    },
  ];
  const open = debtSentence(plan, simulate(plan));
  assert.ok(open);
  assert.match(open, /At retirement in January 2036/);
  assert.match(open, /in today's dollars/);
  assert.match(open, /lighter than the 90% you carry now/);
  assert.match(open, /large share of what you own is still pledged/);

  plan.liabilities[0].termYears = 2;
  plan.liabilities[0].monthlyPi = 10_000;
  const clear = debtSentence(plan, simulate(plan));
  assert.ok(clear);
  assert.match(clear, /debt-to-asset ratio there is zero/);
  assert.match(clear, /You walk in clear/);

  plan.assumptions.retirementGoalDate = null;
  const unset = debtSentence(plan, simulate(plan));
  assert.ok(unset);
  assert.match(unset, /Set a retirement goal date in Family/);
});

test("debt at retirement names the statement balance and today's dollars", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1976-01-01";
  plan.assumptions.asOfDate = "2026-08-01";
  plan.assumptions.inflationPct = 3;
  plan.assumptions.retirementGoalDate = "2040-11-01";
  plan.assumptions.projectionEndAge = 95;
  plan.incomes = [];
  plan.spending = [];
  plan.portfolios = [
    {
      id: "house",
      name: "Shire Lane Home",
      kind: "real_estate",
      owner: "joint",
      currentValue: 500_000,
      returnPct: 3,
      taxBucket: "none",
      spendable: false,
      includeInNetWorth: true,
      mortgage: {
        originationDate: "2021-04-01",
        aprPct: 3,
        monthlyPi: 2000,
        termYears: 30,
        includeInSpending: true,
        associated: true,
        institutionName: "Rocket Mortgage",
      },
    },
  ];
  const text = debtSentence(plan, simulate(plan)) ?? "";
  const loan = text.match(
    /about \$([0-9,]+) in future dollars \(\$([0-9,]+) in today's dollars\) is still owed\./,
  );
  assert.ok(loan, text);
  const statement = Number(loan[1].replace(/,/g, ""));
  const today = Number(loan[2].replace(/,/g, ""));
  assert.ok(statement > today);
  assert.doesNotMatch(text, /Individual loan/);
  assert.match(text, /Your total debt is \$/);
  assert.match(text, /what is still owed is about [0-9.]+% of your assets in today's dollars/);
  assert.doesNotMatch(
    text,
    new RegExp(`debt is \\$${loan[1]} in future dollars`),
  );
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
  assert.ok(pay.columns?.rows.length === 2);
  assert.equal(pay.columns?.rows[0]?.name, "W-2");
  assert.equal(pay.columns?.rows[1]?.name, "Pension");
  const w2 = pay.body.indexOf("W-2");
  const pension = pay.body.indexOf("Pension");
  assert.ok(w2 >= 0 && pension > w2);
  assert.match(pay.body, /Aug 2026/);
  assert.match(pay.body, /Sep 2036/);
  assert.match(pay.body, /Jan 2071 \(Longevity age 95\)/);
  assert.equal(pay.columns?.rows[0]?.window.includes("Longevity age"), false);
  assert.doesNotMatch(pay.body, /open/);
  assert.doesNotMatch(pay.body, /2026-08/);
});

test("analysis sections follow option A, with guaranteed paychecks after paychecks", () => {
  const plan = createDefaultPlan();
  plan.primary.birthDate = "1976-01-01";
  plan.assumptions.retirementGoalDate = "2036-01-01";
  plan.assumptions.nestEggGoal = 1_000_000;
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
  plan.incomes = [
    {
      id: "mil",
      name: "Retired pay",
      kind: "military",
      monthlyAmount: 4_000,
      startDate: "2036-01-01",
      endDate: null,
      colaPct: 2.5,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  const titles = buildPeerBrief(plan, simulate(plan), { expanded: true }).sections.map(
    (s) => s.title,
  );
  const want = [
    "Bottom line",
    "Your Runway - how long your spendable money lasts",
    "Nest egg goal",
    "Retirement landing",
    "Paychecks",
    "Guaranteed paycheck equivalent",
    "Accounts on this run",
    "RMD (Required Minimum Distribution)",
    "Peer rank",
    "Income vs the country",
    "This MACH Run",
    "Compounding",
  ];
  for (const title of want) assert.ok(titles.includes(title), title);
  for (let i = 1; i < want.length; i++) {
    assert.ok(titles.indexOf(want[i - 1]) < titles.indexOf(want[i]), want[i]);
  }
  const guaranteed = titles.indexOf("Guaranteed paycheck equivalent");
  assert.equal(titles[guaranteed - 1], "Paychecks");
  assert.equal(
    buildPeerBrief(plan, simulate(plan), { expanded: true }).sections[guaranteed]?.variant,
    "annuity",
  );
});

