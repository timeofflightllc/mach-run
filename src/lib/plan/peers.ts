import { format } from "date-fns";
import { ageYears, dateAtAge, formatMonthYear, monthStart, projectionEndMonth, validIso, yearlyRateToMonthly } from "./dates.ts";
import {
  monthlyIncomeAt,
  representativeAnnualIncome,
  representativeSaveRate,
  startingNetWorth,
  startingSpendable,
  streamBenefitToday,
  streamWindow,
} from "./engine.ts";
import { guaranteedAnnuityEquivalent, type AnnuityEquivalent } from "./annuity-equivalent.ts";
import { cashShortYears } from "./cash-short.ts";
import { usd, usdCompact } from "./format.ts";
import { remainingLiability, liabilityPayoffDate } from "./liability.ts";
import { monthsBetweenMonths, mortgageAssociated, mortgagePayoffDate, remainingMortgage } from "./mortgage.ts";
import type { Liability, LiabilityKind, Plan, SimResult } from "./types.ts";

/** SCF 2022 net worth knots, inflated ~12% into 2026 dollars. Approximate. */
const NW_BANDS: {
  min: number;
  max: number;
  label: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}[] = [
  { min: 0, max: 34, label: "under 35", p10: 0, p25: 12_000, p50: 44_000, p75: 141_000, p90: 409_000 },
  { min: 35, max: 44, label: "35–44", p10: 9_000, p25: 40_000, p50: 151_000, p75: 431_000, p90: 1_100_000 },
  { min: 45, max: 54, label: "45–54", p10: 17_000, p25: 75_000, p50: 276_000, p75: 762_000, p90: 2_000_000 },
  { min: 55, max: 64, label: "55–64", p10: 20_000, p25: 99_000, p50: 409_000, p75: 1_110_000, p90: 2_970_000 },
  { min: 65, max: 74, label: "65–74", p10: 25_000, p25: 106_000, p50: 459_000, p75: 1_180_000, p90: 3_250_000 },
  { min: 75, max: 120, label: "75+", p10: 22_000, p25: 90_000, p50: 376_000, p75: 1_100_000, p90: 2_800_000 },
];

/** Census household money income, loosely stepped to 2026 dollars. */
const INCOME_KNOTS = [
  { p: 10, v: 18_000 },
  { p: 25, v: 43_000 },
  { p: 50, v: 87_000 },
  { p: 75, v: 165_000 },
  { p: 90, v: 270_000 },
  { p: 95, v: 380_000 },
];

export interface BriefColumnRow {
  name: string;
  amount: string;
  window: string;
}

export interface BriefTableSpec {
  intro: string;
  note?: string;
  headers: { label: string; align?: "left" | "right"; nowrap?: boolean }[];
  rows: string[][];
  /** Institution mark to the right of the first cell. Same order as rows. */
  logos?: { institutionId: string | null; institutionName: string }[];
  footer?: string[];
}

export interface BriefSection {
  title: string;
  body: string;
  /** Collapsed guaranteed-paycheck block. Screen and PDF follow section order. */
  variant?: "annuity";
  columns?: {
    intro: string;
    note: string;
    rows: BriefColumnRow[];
  };
  table?: BriefTableSpec;
}

export interface PeerBrief {
  runAt: string;
  age: number | null;
  netWorth: number;
  spendable: number;
  annualIncome: number;
  savingsRatePct: number | null;
  nwPercentile: number | null;
  incomePercentile: number | null;
  bandLabel: string | null;
  headline: string;
  sections: BriefSection[];
  /** title + body, for tests and PDF fallback */
  paragraphs: string[];
  expanded: boolean;
  annuityEquivalent?: AnnuityEquivalent | null;
}

export function percentileFromKnots(
  value: number,
  knots: { p: number; v: number }[],
): number {
  const sorted = [...knots].sort((a, b) => a.v - b.v);
  if (value <= sorted[0].v) {
    if (sorted[0].v <= 0) return value <= 0 ? 5 : sorted[0].p;
    return Math.max(3, Math.round((value / sorted[0].v) * sorted[0].p));
  }
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (value <= b.v) {
      const t = (value - a.v) / Math.max(1, b.v - a.v);
      return Math.round(a.p + t * (b.p - a.p));
    }
  }
  const last = sorted[sorted.length - 1];
  if (value >= last.v * 3) return 99;
  return Math.min(99, last.p + 4);
}

function bandForAge(age: number) {
  return NW_BANDS.find((b) => age >= b.min && age <= b.max) ?? NW_BANDS[NW_BANDS.length - 1];
}

function nwKnots(band: (typeof NW_BANDS)[number]) {
  return [
    { p: 10, v: band.p10 },
    { p: 25, v: band.p25 },
    { p: 50, v: band.p50 },
    { p: 75, v: band.p75 },
    { p: 90, v: band.p90 },
  ];
}

function standing(p: number): string {
  if (p >= 99) return "the top 1%";
  if (p >= 50) return `the top ${Math.max(1, 100 - p)}%`;
  if (p <= 5) return "the bottom 5%";
  return `the bottom ${p}%`;
}

export function peerRankLine(brief: {
  age: number | null;
  nwPercentile: number | null;
  incomePercentile: number | null;
  bandLabel: string | null;
}): string | null {
  const parts: string[] = [];
  if (brief.nwPercentile != null && brief.bandLabel) {
    parts.push(
      `net worth in ${standing(brief.nwPercentile)} of U.S. families age ${brief.bandLabel}`,
    );
  }
  if (brief.incomePercentile != null) {
    parts.push(
      `income in ${standing(brief.incomePercentile)} of U.S. households`,
    );
  }
  if (!parts.length) return null;
  const ageBit = brief.age != null ? ` at ${brief.age}` : "";
  return `Peer rank${ageBit}: ${parts.join("; ")}.`;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function extraMonthlyForGap(shortfall: number, months: number, annualReal: number): number {
  if (shortfall <= 0) return 0;
  if (months <= 0) return shortfall;
  const r = yearlyRateToMonthly(annualReal);
  if (Math.abs(r) < 1e-8) return shortfall / months;
  const growth = (1 + r) ** months - 1;
  if (growth <= 0) return shortfall / months;
  return shortfall * r / growth;
}

export function nestEggTrack(plan: Plan, sim: SimResult) {
  const goal = plan.assumptions.nestEggGoal;
  if (goal == null || goal <= 0) return null;
  const asOf = monthStart(plan.assumptions.asOfDate);
  const goalDate = plan.assumptions.retirementGoalDate;
  let targetDate: Date | null = null;
  if (goalDate && validIso(goalDate)) targetDate = monthStart(goalDate);
  else if (validIso(plan.primary.birthDate)) targetDate = dateAtAge(plan.primary.birthDate, 65);
  if (!targetDate) return null;
  const targetKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
  const monthAtTarget = sim.months.find((m) => m.date.startsWith(targetKey));
  const projected =
    monthAtTarget?.spendableEndReal ??
    sim.retirement?.spendableReal ??
    startingSpendable(plan);
  const hit = sim.months.find((m) => m.spendableEndReal >= goal - 1);
  const nom = plan.assumptions.defaultReturnPct / 100;
  const inf = plan.assumptions.inflationPct / 100;
  const real = (1 + nom) / (1 + inf) - 1;
  const n = Math.max(0, monthsBetween(asOf, targetDate));
  const extra = extraMonthlyForGap(Math.max(0, goal - projected), n, real);
  const targetAge = validIso(plan.primary.birthDate)
    ? ageYears(plan.primary.birthDate, targetDate)
    : null;
  return {
    goal,
    projected,
    targetYear: targetDate.getFullYear(),
    targetAge,
    hitYear: hit ? hit.year : null,
    hitAge: hit ? hit.primaryAge : null,
    extraMonthly: extra,
    onTrack: projected + 1 >= goal,
    monthsOut: n,
  };
}

function rankPhrase(p: number): string {
  if (p < 20) return `building from ${standing(p)} of households your age — every dollar you add now moves the needle`;
  if (p < 40) return `in ${standing(p)} of households your age, with real room to climb`;
  if (p < 50) return `just under the middle, ${standing(p)} — close enough to pass with a few good years`;
  if (p < 60) return `right around typical, ${standing(p)} — solid, and the next rung is in reach`;
  if (p < 75) return `comfortably in ${standing(p)}. That's a household that's been doing the work`;
  if (p < 90) return `in ${standing(p)}. That's a strong showing for this age band`;
  if (p < 97) return `in ${standing(p)}. Truly well positioned`;
  return `in ${standing(p)}. That's elite company — well done`;
}

function bottomLine(opts: {
  who: string;
  age: number | null;
  plan: Plan;
  sim: SimResult;
  savingsRatePct: number | null;
  nwPercentile: number | null;
}): { headline: string; body: string } {
  const { who, age, plan, sim, savingsRatePct, nwPercentile } = opts;
  const endAge = plan.assumptions.projectionEndAge;
  const sr = savingsRatePct;
  const levers: string[] = [];
  if (sr != null && sr < 15) levers.push("raising the save rate");
  levers.push("trimming spending a little");
  levers.push("extending a paycheck");
  const leverText = levers.slice(0, 3).join(", ");
  const egg = nestEggTrack(plan, sim);

  if (egg) {
    const byAge = egg.targetAge != null ? ` (age ${egg.targetAge})` : "";
    if (egg.onTrack) {
      const early =
        egg.hitYear != null && egg.hitYear < egg.targetYear
          ? ` MACH RUN first reaches it around ${egg.hitYear}${egg.hitAge != null ? ` (age ${egg.hitAge})` : ""}, ahead of your date.`
          : "";
      return {
        headline: `You are on track for ${usd(egg.goal)} by ${egg.targetYear}${byAge}.`,
        body: `Projected spendable at that date is ${usd(egg.projected)} in today's dollars.${early} Stay with the plan — this is the number you asked MACH RUN to hit.`,
      };
    }
    const cashShort = cashShortYears(sim).length > 0;
    return {
      headline: `You are not on track for ${usd(egg.goal)} by ${egg.targetYear}${byAge}.`,
      body: cashShort
        ? `Projected spendable there is ${usd(egg.projected)} — short ${usd(Math.max(0, egg.goal - egg.projected))}. If the paycheck had the room, about ${usd(egg.extraMonthly, true)} more per month, compounding at your assumed real return, would close the gap by that date. It does not have that room. The contributions already entered are larger than income minus tax minus spending, so MACH RUN did not invest them. The notice above lists each year.`
        : `Projected spendable there is ${usd(egg.projected)} — short ${usd(Math.max(0, egg.goal - egg.projected))}. Invest about ${usd(egg.extraMonthly, true)} more per month (on top of what you already entered), compounding at your assumed real return, to close the gap by that date.`,
    };
  }

  if (sim.depletedAge != null) {
    const early = age != null && age < 45;
    return {
      headline: early
        ? `${who} is underway — this MACH Run still runs out at age ${sim.depletedAge}.`
        : `${who} is partway there. On these numbers, spendable runs out at age ${sim.depletedAge}.`,
      body: `That's a map, not a verdict. Highest-leverage improvements: ${leverText}. Change one, hit Calculate, and watch the runway move.`,
    };
  }

  if (sim.retirement?.now) {
    return {
      headline: `Well done. On these numbers, ${who} has achieved financial independence.`,
      body: `Spendable lasts through age ${endAge}. Protect it: keep spending honest, leave the accounts invested, and enjoy the fruit of the labor.`,
    };
  }

  if (sim.retirement && !sim.retirement.now) {
    return {
      headline: `${who} is on track for the retirement date you set.`,
      body: `The engine funds spending through age ${endAge}. Stay with the contributions. For more margin, nudge the save rate or don't let spending creep.`,
    };
  }

  if (age != null && age < 40 && (nwPercentile == null || nwPercentile < 50)) {
    return {
      headline: `${who} is early — and that's an advantage.`,
      body: `Time will do more work than a heroic save rate later. Automate contributions now and let compounding compound. Set a retirement goal date in Family so MACH RUN can score the landing.`,
    };
  }

  return {
    headline: `${who} is in good shape on the numbers you typed.`,
    body: `Spendable lasts through age ${endAge}. Set a retirement goal date in Family (or check Already retired) if you want the landing scored.`,
  };
}

/** Blank income end = the month the primary reaches Project through primary age. */
function horizonMonth(plan: Plan): string {
  return projectionEndMonth(plan.primary.birthDate, plan.assumptions.projectionEndAge);
}

function throughPrimaryAge(plan: Plan, endIso: string | null): string {
  const horizon = horizonMonth(plan);
  const end = endIso ? formatMonthYear(endIso) : horizon;
  if (end !== horizon) return end;
  return `${end} (Primary Age ${plan.assumptions.projectionEndAge})`;
}

export function buildPeerBrief(
  plan: Plan,
  sim: SimResult,
  opts?: { expanded?: boolean },
): PeerBrief {
  const expanded = Boolean(opts?.expanded);
  const asOf = monthStart(plan.assumptions.asOfDate);
  const age = validIso(plan.primary.birthDate)
    ? ageYears(plan.primary.birthDate, asOf)
    : null;
  const netWorth = startingNetWorth(plan);
  const spendable = startingSpendable(plan);
  const month0 = sim.months[0];
  const annualIncome = representativeAnnualIncome(plan, sim);
  const incomeNow = monthlyIncomeAt(plan, asOf);
  const savingsRatePct = representativeSaveRate(sim);
  const year0 = sim.years.find((y) => y.income > 1) ?? sim.years[0];
  const spendingNow = month0?.spending ?? 0;
  const horizon = sim.spendableAtEndReal;
  const namedIncomes = plan.incomes.filter(
    (s) => (s.monthlyAmount ?? 0) > 0 || (s.ssPia ?? 0) > 0,
  );

  const band = age != null ? bandForAge(age) : null;
  const nwPercentile =
    age != null && netWorth > 0 && band
      ? percentileFromKnots(netWorth, nwKnots(band))
      : netWorth <= 0 && age != null
        ? 8
        : null;
  const incomePercentile =
    annualIncome > 0 ? percentileFromKnots(annualIncome, INCOME_KNOTS) : null;

  const who = plan.primary.name.trim() || "This household";
  const annuityEquivalent = guaranteedAnnuityEquivalent(plan);
  const sections: BriefSection[] = [];
  const add = (
    title: string,
    body: string,
    extra?: Pick<BriefSection, "columns" | "table" | "variant">,
  ) => sections.push({ title, body, ...extra });
  const runAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const snapshot = `${runAt}. Spendable ${usd(spendable)}. Net worth ${usd(netWorth)}. Income ${usd(incomeNow > 1 ? incomeNow : annualIncome / 12, true)}/mo. Spending ${usd(spendingNow, true)}/mo. First-year saved ${usd(year0?.contributions ?? 0)}. This is the household as you entered it.`;
  let headline = "Hit Calculate after you put numbers in Observe.";

  const pack = (): PeerBrief => ({
    runAt,
    age,
    netWorth,
    spendable,
    annualIncome,
    savingsRatePct,
    nwPercentile,
    incomePercentile,
    bandLabel: band?.label ?? null,
    headline,
    sections,
    paragraphs: sections.map((s) => `${s.title}: ${s.body}`),
    expanded,
    annuityEquivalent,
  });

  if (plan.portfolios.length === 0 && namedIncomes.length === 0) {
    headline = "There's nothing to rank yet — add accounts and a paycheck, then Calculate.";
    add(
      "Empty hangar",
      "Add accounts in Observe and a paycheck in Orient, then hit Calculate. MACH RUN will rank this household as soon as there is something to measure.",
    );
    return pack();
  }

  const line = bottomLine({ who, age, plan, sim, savingsRatePct, nwPercentile });
  headline = line.headline;
  add("Bottom line", line.body);

  if (sim.depletedAge != null) {
    add(
      "Your Runway - how long your spendable money lasts",
      `The MACH Run runs out of spendable at age ${sim.depletedAge} (${sim.depletedYear}). That's useful information, not a verdict. A little more saving, a little less spending, or a longer paycheck can move that date. You've got levers.`,
    );
  } else if (annualIncome > 0 || netWorth > 0) {
    add(
      "Your Runway - how long your spendable money lasts",
      `On the numbers you typed, spendable lasts through age ${plan.assumptions.projectionEndAge}. That's the MACH RUN engine talking, not a guarantee — and it's a strong place to be. Markets can still wobble; the plan you built is the buffer.`,
    );
  }

  const egg = nestEggTrack(plan, sim);
  if (egg) {
    add(
      "Nest egg goal",
      egg.onTrack
        ? `Goal ${usd(egg.goal)} by ${egg.targetYear}${egg.targetAge != null ? ` (age ${egg.targetAge})` : ""}. Projected ${usd(egg.projected)} in today's dollars — on track.`
        : `Goal ${usd(egg.goal)} by ${egg.targetYear}${egg.targetAge != null ? ` (age ${egg.targetAge})` : ""}. Projected ${usd(egg.projected)}. Gap ${usd(Math.max(0, egg.goal - egg.projected))}. About ${usd(egg.extraMonthly, true)}/mo more invested closes it at your assumed return.`,
    );
  }

  const ret = sim.retirement;
  if (ret) {
    if (ret.now) {
      add(
        "Retirement landing",
        `Retirement goal date is this month (or you're already retired), so “at retirement” is today: spendable ${usd(ret.spendableReal)} in today's dollars. Modeled income in the next twelve months is ${usd(ret.annualIncomeReal)} a year (${usd(ret.monthlyIncomeReal, true)}/mo).`,
      );
    } else {
      const retAge =
        age != null && validIso(ret.date)
          ? ageYears(plan.primary.birthDate, monthStart(ret.date))
          : null;
      add(
        "Retirement landing",
        `Retirement goal is ${formatMonthYear(ret.date)}${retAge != null ? ` (age ${retAge})` : ""}. Spendable there: ${usd(ret.spendableReal)} in today's dollars. Modeled retirement income ${usd(ret.annualIncomeReal)} a year (${usd(ret.monthlyIncomeReal, true)}/mo) from the stages you entered.`,
      );
    }
  } else {
    add(
      "Retirement landing",
      "No retirement goal date in Family yet, so MACH RUN cannot score the landing. Put a goal date in — or check Already retired — then Calculate again.",
    );
  }

  if (namedIncomes.length) {
    const ordered = [...namedIncomes].sort((a, b) => {
      const as = streamWindow(plan, a).start;
      const bs = streamWindow(plan, b).start;
      if (as !== bs) return as < bs ? -1 : 1;
      return (a.name || a.kind).localeCompare(b.name || b.kind);
    });
    const rows: BriefColumnRow[] = ordered.map((s) => {
      const win = streamWindow(plan, s);
      const amt = streamBenefitToday(plan, s, asOf);
      const end = throughPrimaryAge(plan, win.end);
      return {
        name: s.name.trim() || s.kind,
        amount: `${usd(amt, true)}/mo`,
        window: `${formatMonthYear(win.start)} → ${end}`,
      };
    });
    const listed = rows
      .map((r) => `${r.name}  ${r.amount}  (${r.window})`)
      .join("\n");
    const intro = "Income stages on this run:";
    const note =
      "MACH RUN only scores what you typed, so every pension and side check you add makes this picture truer.";
    add("Paychecks", `${intro}\n${listed}\n${note}`, {
      columns: { intro, note, rows },
    });
  }

  if (annuityEquivalent) {
    add(
      "Guaranteed paycheck equivalent",
      "If you have a U.S. government retirement paycheck, such as military retired pay, VA compensation, Social Security, or a federal civilian pension, it can be useful to see the estimated annuity value of that near-zero-risk income. This is for informational and educational purposes only.",
      { variant: "annuity" },
    );
  }

  if (savingsRatePct != null) {
    const sr = savingsRatePct;
    let saveLine: string;
    if (sr < 5) {
      saveLine = `This run saves ${sr.toFixed(0)}% of gross. Plenty of households sit here. Nudging that rate up even a few points is one of the highest-leverage moves you can make.`;
    } else if (sr < 15) {
      saveLine = `This run saves ${sr.toFixed(0)}% of gross — better than a lot of the country. The common 15% rule of thumb is still a useful next step if the nest egg isn't already doing the heavy lifting.`;
    } else if (sr < 25) {
      saveLine = `This run saves ${sr.toFixed(0)}% of gross. That's serious, healthy saving. Keep it as long as the chart still needs it — you're doing this right.`;
    } else {
      saveLine = `This run saves ${sr.toFixed(0)}% of gross. That's FI-pace. Outstanding discipline. Just make sure the spending figure is the real household so the victory lap is earned.`;
    }
    add("Save rate", saveLine);
  }

  if (plan.portfolios.length) {
    const closer =
      plan.portfolios.length === 1
        ? "One account is a clean start. Add the rest of the hangar when you're ready."
        : "That mix is the machine. Returns do the quiet work if you leave them invested.";
    const listed = plan.portfolios
      .map((p) => {
        const name = p.name.trim() || p.kind;
        const invested =
          p.kind === "annuity" && (p.costBasis ?? 0) > 0
            ? ` (invested ${usd(p.costBasis ?? 0)})`
            : "";
        return `${name} ${usd(p.currentValue)}${invested}`;
      })
      .join("; ");
    add("Accounts on this run", `${listed}. ${closer}`, {
      table: accountTable(plan, sim, closer),
    });
  }

  const debt = debtSentence(plan, sim);
  if (debt) add("Debt", debt);

  if (netWorth > 0 && spendable / netWorth < 0.35) {
    add(
      "Spendable vs paper rich",
      `Spendable accounts are ${usd(spendable)} of ${usd(netWorth)} net worth. The rest is illiquid — house, cars, kids' accounts. That's still wealth; it just isn't grocery money. Knowing the split is a strength.`,
    );
  }

  add("RMD (Required Minimum Distribution)", rmdIntro(plan, sim), { table: rmdTable(sim) });

  if (age == null) {
    add(
      "Peer rank",
      `Observed net worth is ${usd(netWorth)}. Peer rank needs a birthday in Family. Put one in, Calculate again, and we'll place this household against U.S. families in the same age band.`,
    );
  } else if (nwPercentile != null && band) {
    add(
      "Peer rank",
      `Peer rank: ${who} at ${age} is ${rankPhrase(nwPercentile)} on net worth. Household net worth of ${usd(netWorth)} lands in ${standing(nwPercentile)} of U.S. families age ${band.label}. Median in that band is about ${usdCompact(band.p50)}. The ${standing(90)} door is about ${usdCompact(band.p90)}.`,
    );
  }

  if (incomePercentile != null) {
    const gap =
      nwPercentile != null && incomePercentile - nwPercentile >= 20
        ? "Income is running ahead of the nest egg. That's common in high-earning years. The nice news: you have the cash flow to close the gap if you keep funding the accounts."
        : nwPercentile != null && nwPercentile - incomePercentile >= 20
          ? "The nest egg is already outrunning the paycheck. Compounding has been doing real work. Protect that lead."
          : "Income and net worth are in the same neighborhood. That's a balanced household — keep feeding it.";
    add(
      "Income vs the country",
      `Gross income on this run is about ${usd(annualIncome)} a year — ${standing(incomePercentile)} of U.S. households. ${gap}`,
    );
  } else {
    add(
      "Income vs the country",
      "No income on the run yet, so there's no peer income comparison. Add a paycheck in Orient if one exists and Calculate again.",
    );
  }

  add("This MACH Run", snapshot);
  add(
    "Compounding",
    `Spending starts at ${usd(spendingNow, true)}/mo and inflates at ${plan.assumptions.inflationPct}% a year. Accounts compound at ${plan.assumptions.defaultReturnPct}% nominal unless an account has its own rate. Spendable goes from ${usd(spendable)} now to ${usd(horizon)} at age ${plan.assumptions.projectionEndAge} in today's dollars. Time is on your side if you leave the machine running.`,
  );

  return pack();
}

const LIABILITY_KIND: Record<LiabilityKind, string> = {
  car: "car loan",
  student: "student loan",
  heloc: "HELOC",
  personal: "personal loan",
  credit_card: "credit card",
  other: "loan",
};

function payoffMonthYear(isoDate: string | null): string {
  if (!isoDate || !validIso(isoDate)) return "the end of the term you entered";
  return format(monthStart(isoDate), "MMMM yyyy");
}

function balanceSheetNow(plan: Plan): { assets: number; debt: number } {
  const asOf = plan.assumptions.asOfDate;
  let assets = 0;
  let debt = 0;
  for (const p of plan.portfolios) {
    if (!p.includeInNetWorth) continue;
    assets += Math.max(0, p.currentValue);
    if (p.kind === "real_estate") debt += remainingMortgage(p.mortgage, asOf);
  }
  for (const l of plan.liabilities ?? []) debt += remainingLiability(l, asOf);
  return { assets, debt };
}

/** SCF 2022: median leverage ratio among families that have debt. */
const TYPICAL_DEBTOR_RATIO = 29;

function ratioShown(pct: number): string {
  return pct >= 10
    ? String(Math.round(pct))
    : String(Math.max(0.1, Math.round(pct * 10) / 10));
}

function debtRatioLine(plan: Plan, open: number): string {
  const { assets, debt } = balanceSheetNow(plan);
  const bench = `A typical U.S. household that carries debt owes about ${TYPICAL_DEBTOR_RATIO}% of what it owns.`;
  const many = open > 1;
  if (debt < 1 && assets > 1) {
    return `Your total debt against ${usd(assets)} of assets is effectively zero. ${bench} You are not in that group.`;
  }
  if (assets < 1) {
    const sum = many
      ? `If we combine all loans, they add up to ${usd(debt)}`
      : `Your total debt is ${usd(debt)}`;
    return `${sum}, and no assets are included in net worth yet, so there is no debt-to-asset ratio to compare.`;
  }
  const pct = (debt / assets) * 100;
  const shown = ratioShown(pct);
  const lead = many
    ? `If we combine all loans, your total debt is ${usd(debt)} against ${usd(assets)} of assets, about ${shown}%.`
    : `Your total debt is ${usd(debt)} against ${usd(assets)} of assets, about ${shown}%.`;
  const focus = dominantDebt(plan);
  if (pct < 10) {
    return `${lead} ${bench} Yours is a light load.${focus} That cushion is worth keeping.`;
  }
  if (pct < 20) {
    return `${lead} ${bench} You are carrying less than that.${focus} The assets are doing the heavy work.`;
  }
  if (pct < 40) {
    return `${lead} ${bench} You are in that neighborhood.${focus} A house loan usually explains a number like this.`;
  }
  if (pct < 60) {
    return `${lead} ${bench} Yours is higher, which a mortgage can do while you still have equity.${focus} The loans that are not the house are the ones to watch.`;
  }
  if (pct < 100) {
    return `${lead} ${bench} This is a large share of what you own.${focus} There is still equity, but the margin is thinner than most.`;
  }
  const over = many
    ? `If we combine all loans, your total debt is ${usd(debt)} and your assets are ${usd(assets)}.`
    : `Your total debt is ${usd(debt)} and your assets are ${usd(assets)}.`;
  return `${over} The loans are larger than what you own. ${bench}${focus} This is a tight spot, not a verdict.`;
}

function retirementLanding(pct: number): string {
  if (pct < 10) return "That is a light load, and a strong place to land.";
  if (pct < 20) return "The assets are still doing the heavy work.";
  if (pct < 40) return "Fine if a house loan is most of it.";
  if (pct < 60) return "Equity is still there, but the loans that are not the house are the ones to watch.";
  if (pct < 100) return "A large share of what you own is still pledged. There is equity, and less margin than most.";
  return "The loans are still larger than the assets. That is a tight landing, not a verdict.";
}

/** Debt-to-asset on the retirement month, in today's dollars, plus how it compares with today. */
function retirementDebtLine(plan: Plan, sim: SimResult): string {
  const goal = plan.assumptions.retirementGoalDate;
  if (!goal || !validIso(goal)) {
    return "Set a retirement goal date in Family to see the debt-to-asset ratio at retirement.";
  }
  const asOf = plan.assumptions.asOfDate;
  const already =
    validIso(asOf) && monthsBetweenMonths(monthStart(goal), monthStart(asOf)) >= 0;
  if (already) {
    return "That retirement date is already here, so the ratio above is the one you retire with.";
  }
  const key = goal.slice(0, 7);
  const month = sim.months.find((m) => m.date.slice(0, 7) === key);
  const when = payoffMonthYear(goal);
  if (!month) {
    const last = sim.months[sim.months.length - 1];
    if (!last || last.date.slice(0, 7) < key) {
      return `The run ends before ${when}, so MACH RUN cannot score the debt-to-asset ratio on that date. Extend the projection age in Family.`;
    }
    return "Calculate again to score the debt-to-asset ratio at retirement.";
  }
  const assets = month.assetsEndReal;
  const debt = month.liabilitiesEndReal;
  const nominal = month.liabilitiesEnd;
  const now = balanceSheetNow(plan);
  const nowPct = now.assets > 1 ? (now.debt / now.assets) * 100 : null;
  if (debt < 1 && assets > 1) {
    const lighter =
      nowPct != null && nowPct >= 1
        ? ` That is lighter than the ${ratioShown(nowPct)}% you carry now.`
        : "";
    return `At retirement in ${when}, these loans are paid off. Against ${usd(assets)} of assets in today's dollars, the debt-to-asset ratio there is zero.${lighter} You walk in clear.`;
  }
  if (assets < 1) {
    return `At retirement in ${when}, what is still owed is ${usd(debt)} in today's dollars, and no assets are in net worth. There is still no ratio to stand on.`;
  }
  const pct = (debt / assets) * 100;
  const compared =
    nowPct == null
      ? ""
      : Math.abs(pct - nowPct) < 1
        ? ` That is about the same as the ${ratioShown(nowPct)}% you carry now.`
        : pct < nowPct
          ? ` That is lighter than the ${ratioShown(nowPct)}% you carry now.`
          : ` That is heavier than the ${ratioShown(nowPct)}% you carry now.`;
  const still = openLoansAt(plan, goal);
  const nowOpen = openLoansAt(plan, asOf);
  const owed =
    still <= 1
      ? `what is still owed is about ${ratioShown(pct)}% of your assets in today's dollars (${usd(assets)})`
      : Math.abs(nominal - debt) < 1
        ? `what is still owed adds up to ${usd(debt)} in today's dollars, about ${ratioShown(pct)}% of your assets (${usd(assets)})`
        : `what is still owed adds up to ${usd(nominal)} in future dollars (${usd(debt)} in today's dollars), about ${ratioShown(pct)}% of your assets in today's dollars (${usd(assets)})`;
  const after = still < nowOpen ? "once the earlier loans are paid off, " : "";
  return `At retirement in ${when}, ${after}${owed}.${compared} ${retirementLanding(pct)}`;
}

function openLoansAt(plan: Plan, date: string): number {
  let n = 0;
  for (const p of plan.portfolios) {
    if (p.kind === "real_estate" && remainingMortgage(p.mortgage, date) >= 1) n += 1;
  }
  for (const l of plan.liabilities ?? []) {
    if (!(l.monthlyPi > 0) || !(l.termYears > 0)) continue;
    if (remainingLiability(l, date) >= 1) n += 1;
  }
  return n;
}

function dominantDebt(plan: Plan): string {
  const asOf = plan.assumptions.asOfDate;
  const pieces: { label: string; amount: number; mortgage: boolean }[] = [];
  for (const p of plan.portfolios) {
    if (p.kind !== "real_estate" || !p.includeInNetWorth) continue;
    const amount = remainingMortgage(p.mortgage, asOf);
    if (amount >= 1) pieces.push({ label: p.name.trim() || "the house", amount, mortgage: true });
  }
  for (const l of plan.liabilities ?? []) {
    const amount = remainingLiability(l, asOf);
    if (amount >= 1) {
      pieces.push({
        label: l.name.trim() || LIABILITY_KIND[l.kind] || "a loan",
        amount,
        mortgage: false,
      });
    }
  }
  if (pieces.length < 2) return "";
  const total = pieces.reduce((sum, piece) => sum + piece.amount, 0);
  pieces.sort((a, b) => b.amount - a.amount);
  const top = pieces[0];
  if (!top || top.amount / total < 0.6) return "";
  return top.mortgage
    ? ` Most of that sits on ${yourThing(top.label)}.`
    : ` Most of that is ${yourThing(top.label)}.`;
}

function yourThing(label: string): string {
  const trimmed = label.trim();
  if (/^(the|your)\b/i.test(trimmed)) return trimmed;
  return `your ${trimmed}`;
}

function liabilitySubject(l: Liability): string {
  const name = l.name.trim();
  const lender = (l.institutionName ?? "").trim();
  const kind = LIABILITY_KIND[l.kind] ?? "loan";
  const bare = kind.split(" ")[0].toLowerCase();
  const nameIsKind =
    !name || name.toLowerCase() === kind || name.toLowerCase() === bare;
  if (lender && !nameIsKind) return `Your ${name} ${kind} at ${lender}`;
  if (lender) return `Your ${lender} ${kind}`;
  if (!nameIsKind) return `Your ${name} ${kind}`;
  return `Your ${kind}`;
}

function beforeSpan(months: number): string {
  if (months <= 1) return "a month";
  if (months < 12) return `${months} months`;
  const years = Math.round(months / 12);
  if (months % 12 === 0) return years === 1 ? "1 year" : `${years} years`;
  return years === 1 ? "about a year" : `about ${years} years`;
}

/** Same deflator the engine uses on that month, so a loan balance and the ratio share one "today's dollars." */
function inflationIndexAt(sim: SimResult | undefined, date: string | null): number {
  if (!sim || !date || !validIso(date)) return 1;
  const key = date.slice(0, 7);
  const month = sim.months.find((m) => m.date.slice(0, 7) === key);
  if (!month) return 1;
  if (month.liabilitiesEnd > 1 && month.liabilitiesEndReal > 0) {
    return month.liabilitiesEnd / month.liabilitiesEndReal;
  }
  if (month.assetsEnd > 1 && month.assetsEndReal > 0) {
    return month.assetsEnd / month.assetsEndReal;
  }
  return 1;
}

/** Payoff, then how that date sits against the Family retirement goal. */
function loanTail(
  payoff: string | null,
  balanceAtRetirement: number,
  balanceToday: number,
  retirement: string | null,
  asOf: string,
): string {
  const when = payoffMonthYear(payoff);
  const paid = when.startsWith("the ") ? `You pay it off at ${when}` : `You pay it off in ${when}`;
  if (!retirement || !validIso(retirement)) return ` ${paid}.`;
  const retLabel = payoffMonthYear(retirement);
  const already =
    validIso(asOf) && monthsBetweenMonths(monthStart(retirement), monthStart(asOf)) >= 0;
  if (payoff && validIso(payoff)) {
    const monthsBefore = monthsBetweenMonths(monthStart(payoff), monthStart(retirement));
    if (monthsBefore > 0) {
      return ` ${paid}, ${beforeSpan(monthsBefore)} before your planned retirement in ${retLabel}.`;
    }
    if (monthsBefore === 0) {
      return ` ${paid}, the same month you plan to retire.`;
    }
  }
  const left = usd(balanceAtRetirement);
  const same = Math.abs(balanceAtRetirement - balanceToday) < 1;
  const pair = same
    ? `about ${left}`
    : `about ${left} in future dollars (${usd(balanceToday)} in today's dollars)`;
  if (already) {
    return ` ${paid}. You are past your planned retirement in ${retLabel}, and ${pair} is still owed.`;
  }
  return ` ${paid}. At your planned retirement in ${retLabel}, ${pair} is still owed.`;
}

/** One line per loan: who it is, what it sits on, balance now, full payoff month. */
export function debtSentence(plan: Plan, sim?: SimResult): string | null {
  const asOf = plan.assumptions.asOfDate;
  const retirement = plan.assumptions.retirementGoalDate;
  const hasRetirement = Boolean(retirement && validIso(retirement));
  const retirementIndex = inflationIndexAt(sim, hasRetirement ? (retirement as string) : null);
  const lines: string[] = [];
  let open = 0;
  let clearByRetirement = 0;

  const noteLoan = (payoff: string | null, balanceAtRetirement: number) => {
    open += 1;
    if (hasRetirement && balanceAtRetirement < 1) clearByRetirement += 1;
    const today =
      retirementIndex > 0 ? balanceAtRetirement / retirementIndex : balanceAtRetirement;
    return loanTail(
      payoff,
      balanceAtRetirement,
      today,
      hasRetirement ? retirement : null,
      asOf,
    );
  };

  for (const p of plan.portfolios) {
    if (p.kind !== "real_estate" || !mortgageAssociated(p.mortgage)) continue;
    const balance = remainingMortgage(p.mortgage, asOf);
    if (balance < 1) continue;
    const property = p.name.trim() || "property";
    const lender = (p.mortgage?.institutionName ?? "").trim();
    const subject = lender
      ? `The ${lender} loan on your ${property}`
      : `The loan on your ${property}`;
    const atRetirement = hasRetirement ? remainingMortgage(p.mortgage, retirement as string) : balance;
    lines.push(
      `${subject} is ${usd(balance)}.${noteLoan(mortgagePayoffDate(p.mortgage), atRetirement)}`,
    );
  }

  for (const l of plan.liabilities ?? []) {
    if (!(l.monthlyPi > 0) || !(l.termYears > 0)) continue;
    const balance = remainingLiability(l, asOf);
    if (balance < 1) continue;
    const atRetirement = hasRetirement ? remainingLiability(l, retirement as string) : balance;
    lines.push(`${liabilitySubject(l)} is ${usd(balance)}.${noteLoan(liabilityPayoffDate(l), atRetirement)}`);
  }

  if (!lines.length) {
    const had =
      plan.portfolios.some((p) => p.kind === "real_estate" && mortgageAssociated(p.mortgage)) ||
      (plan.liabilities ?? []).some((l) => l.monthlyPi > 0 && l.termYears > 0);
    if (!had) return null;
    const later = sim ? retirementDebtLine(plan, sim) : "";
    if (hasRetirement && monthsBetweenMonths(monthStart(asOf), monthStart(retirement as string)) > 0) {
      return [
        `These loans are already paid off. You reach that retirement date debt free. Well done.`,
        debtRatioLine(plan, 0),
        later,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    return [`These loans are paid off as of this MACH Run.`, debtRatioLine(plan, 0), later]
      .filter(Boolean)
      .join("\n\n");
  }

  if (hasRetirement && open > 0 && clearByRetirement === open) {
    const already =
      validIso(asOf) &&
      monthsBetweenMonths(monthStart(retirement as string), monthStart(asOf)) >= 0;
    const noun = open === 1 ? "this loan" : "these loans";
    lines.push(
      already
        ? `You reached that retirement date with ${noun} paid off. Well done.`
        : `You reach that retirement date with ${noun} paid off. Well done.`,
    );
  }
  lines.push(debtRatioLine(plan, open));
  if (sim) lines.push(retirementDebtLine(plan, sim));
  return lines.join("\n\n");
}

function accountTable(plan: Plan, sim: SimResult, note: string): BriefTableSpec {
  const at = new Map((sim.balancesAtRetirement ?? []).map((b) => [b.id, b]));
  const hasGoal = Boolean(plan.assumptions.retirementGoalDate);
  const when = hasGoal
    ? "Position at retirement is the balance entering that month. The first figure is future dollars — your return, compounded. In parentheses is today's dollars, after inflation. A return equal to inflation holds its buying power."
    : "Set a retirement goal date in Family to see the balance there.";
  return {
    intro: "",
    note: `${note} ${when}`,
    headers: [
      { label: "Account" },
      { label: "Starting position", align: "right", nowrap: true },
      { label: "Position at retirement", align: "right", nowrap: true },
    ],
    rows: plan.portfolios.map((p) => {
      const invested =
        p.kind === "annuity" && (p.costBasis ?? 0) > 0
          ? ` (invested ${usd(p.costBasis ?? 0)})`
          : "";
      const bal = at.get(p.id);
      const nominal = bal?.nominal ?? p.currentValue;
      const real = bal?.real ?? p.currentValue;
      const later = hasGoal ? `${usd(nominal)} (${usd(real)} today)` : "—";
      return [`${p.name.trim() || p.kind}`, `${usd(p.currentValue)}${invested}`, later];
    }),
    logos: plan.portfolios.map((p) => ({
      institutionId: p.institutionId ?? null,
      institutionName: p.institutionName ?? "",
    })),
  };
}

function rmdIntro(plan: Plan, sim: SimResult): string {
  const rows = sim.rmd?.accounts ?? [];
  if (!rows.length) {
    return "No retirement accounts on this run that the IRS would force a required minimum distribution from.";
  }
  const forced = rows.filter((r) => r.status === "forced");
  const future = rows.filter((r) => r.status === "future");
  const deferred = rows.filter((r) => r.status === "deferred");
  if (forced.length) {
    const first = forced.reduce(
      (m, r) =>
        r.firstYear != null && (m == null || r.firstYear < m) ? r.firstYear : m,
      null as number | null,
    );
    const haul = forced.reduce((s, r) => s + r.firstYearAnnual, 0);
    return `Required minimum distributions are on this MACH Run. First forced year is ${first ?? "this horizon"}. First-year haul across those accounts is about ${usd(haul)} — booked as ordinary income.`;
  }
  if (deferred.length && !future.length) {
    return "Workplace RMDs are skipped on this run while W-2 pay is on and you are still contributing to those accounts. Traditional IRAs do not get that exception.";
  }
  const next = rows
    .filter((r) => r.status !== "none" && r.startAge != null)
    .sort((a, b) => (a.startYear ?? 9999) - (b.startYear ?? 9999))[0];
  if (next?.startAge != null) {
    const who = next.owner;
    return `No RMDs yet. First one on this plan is ${who}'s ${next.name} at age ${next.startAge}${next.startYear != null ? ` (${next.startYear})` : ""}.`;
  }
  return "Roth accounts on this run have no lifetime RMD. Nothing else here is pre-tax.";
}

function rmdTable(sim: SimResult): BriefTableSpec {
  const rows = sim.rmd?.accounts ?? [];
  const tableRows = rows.map((r) => {
    const status =
      r.status === "none"
        ? "No lifetime RMD"
        : r.status === "deferred"
          ? "Still working — skipped"
          : r.status === "forced"
            ? "Required on this run"
            : r.startAge != null
              ? `Waiting until age ${r.startAge}`
              : "Waiting";
    const starts =
      r.status === "none"
        ? "—"
        : r.startAge != null
          ? `Age ${r.startAge}${r.startYear != null ? ` · ${r.startYear}` : ""}`
          : "—";
    const first =
      r.firstYearAnnual > 0.5
        ? `${usd(r.firstYearAnnual)}${r.firstYear != null ? ` (${r.firstYear})` : ""}`
        : "—";
    return [r.name, r.owner, status, starts, first];
  });
  const forcedSum = rows
    .filter((r) => r.firstYearAnnual > 0.5)
    .reduce((s, r) => s + r.firstYearAnnual, 0);
  const footer =
    forcedSum > 0.5
      ? ["First-year total", "", "", "", usd(forcedSum)]
      : undefined;
  return {
    intro: rows.length
      ? "The minimum the IRS makes you withdraw from a pre-tax retirement account at a set age. MACH RUN figures it from the prior year-end balance and counts it as ordinary income. Roth IRA and Roth 401(k) have none. A traditional IRA starts at 73 or 75, depending on birth year. A 401(k) or TSP uses those same ages, but is skipped while you are still earning salary and still contributing to that account. If one is due, MACH RUN already withdraws it and shows it as income in the table below."
      : "Add a pre-tax IRA, 401(k), or TSP in Observe to see RMDs here.",
    headers: [
      { label: "Account" },
      { label: "Owner" },
      { label: "Status" },
      { label: "Starts", nowrap: true },
      { label: "First-year RMD", align: "right", nowrap: true },
    ],
    rows: tableRows,
    logos: rows.map((r) => ({
      institutionId: r.institutionId ?? null,
      institutionName: r.institutionName ?? "",
    })),
    footer,
  };
}
