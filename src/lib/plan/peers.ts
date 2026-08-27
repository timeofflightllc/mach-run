import { ageYears, monthStart, validIso } from "./dates.ts";
import {
  monthlyIncomeAt,
  representativeAnnualIncome,
  representativeSaveRate,
  startingNetWorth,
  startingSpendable,
  streamBenefitToday,
  streamWindow,
} from "./engine.ts";
import { usd, usdCompact } from "./format.ts";
import { rmdStartAge } from "./rmd.ts";
import type { Plan, SimResult } from "./types.ts";

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
  paragraphs: string[];
  expanded: boolean;
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

function rankPhrase(p: number): string {
  if (p < 20) return `in ${standing(p)} — and not the fun side`;
  if (p < 40) return `in ${standing(p)} of households your age`;
  if (p < 50) return `just under the middle, ${standing(p)}`;
  if (p < 60) return `dead-center typical, ${standing(p)}`;
  if (p < 75) return `comfortably in ${standing(p)}`;
  if (p < 90) return `in ${standing(p)} and it shows`;
  if (p < 97) return `in ${standing(p)}. Unfair, frankly`;
  return `in ${standing(p)}. The compounding gods have favorites`;
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
  const paragraphs: string[] = [];
  const runAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const thisRun = `This run (${runAt}): spendable ${usd(spendable)}, net worth ${usd(netWorth)}, income ${usd(incomeNow > 1 ? incomeNow : annualIncome / 12, true)}/mo, spending ${usd(spendingNow, true)}/mo, first-year saved ${usd(year0?.contributions ?? 0)}.`;
  let headline = "Hit Calculate after you put numbers in Observe.";

  if (plan.portfolios.length === 0 && namedIncomes.length === 0) {
    headline = "There's nothing to rank yet. MACH doesn't do imaginary wealth.";
    paragraphs.push(
      thisRun,
      "Add accounts in Observe and a paycheck in Orient, then Calculate. We will not invent a net worth so you can feel tall.",
    );
    return {
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
      paragraphs,
      expanded,
    };
  }

  paragraphs.unshift(thisRun);

  if (age == null) {
    headline = "You've got a pile. MACH has no age. That's a vibe, not a plan.";
    paragraphs.push(
      `Observed net worth is ${usd(netWorth)}. Peer rank needs a birth date in Family. Put one in, Calculate again, and we'll tell you if this is impressive or just a nice round number.`,
    );
  } else if (nwPercentile != null && band) {
    headline = `${who} at ${age} is ${rankPhrase(nwPercentile)} on net worth.`;
    paragraphs.push(
      `Household net worth of ${usd(netWorth)} lands in ${standing(nwPercentile)} of U.S. families in the ${band.label} band. Median in that band is about ${usdCompact(band.p50)}; the door to ${standing(90)} is about ${usdCompact(band.p90)}. Fed SCF numbers, stepped into 2026 dollars — not your squadron, not a trophy.`,
    );
  }

  if (namedIncomes.length) {
    const listed = namedIncomes
      .map((s) => {
        const win = streamWindow(plan, s);
        const amt = streamBenefitToday(plan, s, asOf);
        const end = win.end ? win.end.slice(0, 7) : "ongoing";
        return `${s.name.trim() || s.kind} ${usd(amt, true)}/mo (${win.start.slice(0, 7)} → ${end})`;
      })
      .join("; ");
    paragraphs.push(`Income stages on this run: ${listed}.`);
  }

  if (incomePercentile != null) {
    const gap =
      nwPercentile != null && incomePercentile - nwPercentile >= 20
        ? "Paycheck is in a nicer zip code than the pile. That's a late start, a fat lifestyle, or both. The clock is the constraint, not the salary. Save like you mean it."
        : nwPercentile != null && nwPercentile - incomePercentile >= 20
          ? "The pile outruns the paycheck. Compounding already did the heroic part. Don't undo it with a spending glow-up you haven't modeled."
          : "Income and net worth are in the same neighborhood. Consistent. Not a standing ovation. Not an insult.";
    paragraphs.push(
      `Gross income on this run is about ${usd(annualIncome)} a year — ${standing(incomePercentile)} of U.S. households. ${gap}`,
    );
  } else {
    paragraphs.push(
      "No income on the run, so there's no peer income comparison. Orient a paycheck if one exists, unless the plan is 'live on vibes.'",
    );
  }

  if (savingsRatePct != null) {
    const sr = savingsRatePct;
    let saveLine: string;
    if (sr < 5) {
      saveLine = `This run saves ${sr.toFixed(0)}% of gross. That's not a savings rate. That's a rounding error with a 401(k) login. The average U.S. household is also in this ditch. You do not want to be average at this.`;
    } else if (sr < 15) {
      saveLine = `This run saves ${sr.toFixed(0)}% of gross. Respectable vs the country. Short of the 15% rule of thumb. Fine if the pile is already large. Thin if it isn't. Pick one and act like it.`;
    } else if (sr < 25) {
      saveLine = `This run saves ${sr.toFixed(0)}% of gross. Serious-person zone. Keep it until the chart says you can stop, then keep it one more year out of spite.`;
    } else {
      saveLine = `This run saves ${sr.toFixed(0)}% of gross. That's FI-pace. That's 'the market is my personality now.' Crushing it — so long as spending in Decide is the real household and not a brochure.`;
    }
    paragraphs.push(saveLine);
  }

  if (netWorth > 0 && spendable / netWorth < 0.35) {
    paragraphs.push(
      `Spendable accounts are ${usd(spendable)} of ${usd(netWorth)} net worth. The rest is illiquid — house, vehicles, kids' accounts. Peers with a paid-off house look rich on paper and still can't fund a year of groceries from the drywall. Don't confuse the two.`,
    );
  }

  paragraphs.push(
    `Household spending starts at ${usd(spendingNow, true)}/mo and inflates at ${plan.assumptions.inflationPct}% a year. Accounts compound at ${plan.assumptions.defaultReturnPct}% nominal unless an account has its own rate. Spendable goes from ${usd(spendable)} now to ${usd(horizon)} at age ${plan.assumptions.projectionEndAge} in today's dollars.`,
  );

  paragraphs.push(rmdAdvice(plan, sim));

  const ret = sim.retirement;
  if (ret) {
    if (ret.now) {
      paragraphs.push(
        `Retirement goal date is this month, so “at retirement” is just today: spendable ${usd(ret.spendableReal)} in today's dollars. Modeled income in the next twelve months is ${usd(ret.annualIncomeReal)} a year (${usd(ret.monthlyIncomeReal, true)}/mo). Set a future date in Family if you meant a later runway.`,
      );
    } else {
      const retAge =
        age != null && validIso(ret.date)
          ? ageYears(plan.primary.birthDate, monthStart(ret.date))
          : null;
      paragraphs.push(
        `Retirement goal is ${ret.date.slice(0, 7)}${retAge != null ? ` (age ${retAge})` : ""}. MACH has spendable of ${usd(ret.spendableReal)} there in today's dollars, with modeled retirement income ${usd(ret.annualIncomeReal)} a year (${usd(ret.monthlyIncomeReal, true)}/mo) from the stages you actually entered — not a 4% rule dressed up as a pension.`,
      );
    }
  } else {
    paragraphs.push(
      "No retirement goal date in Family, so MACH cannot score the landing. Put one in, Calculate again, and the OODA will talk spendable-at-retirement instead of hand-waving.",
    );
  }

  if (plan.portfolios.length) {
    const listed = plan.portfolios
      .map((p) => `${p.name.trim() || p.kind} ${usd(p.currentValue)}`)
      .join("; ");
    paragraphs.push(
      `Accounts on this run: ${listed}. ${plan.portfolios.length === 1 ? "One account is a start. It is not a plan." : "That mix is the machine. Returns do the quiet work if you leave them alone."}`,
    );
  }

  if (sim.depletedAge != null) {
    paragraphs.push(
      `The MACH Run itself goes broke at age ${sim.depletedAge} (${sim.depletedYear}). Peer rank today does not save a plan that dies on a Tuesday. Cut spending, raise the save, or extend income. This is the mean part.`,
    );
  } else if (annualIncome > 0 || netWorth > 0) {
    paragraphs.push(
      `On the numbers you typed, spendable lasts through age ${plan.assumptions.projectionEndAge}. That is the MACH engine, not the Fed, not a promise, not a high-five that survives a 40% drawdown.`,
    );
  }

  return {
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
    paragraphs,
    expanded,
  };
}

function rmdAdvice(plan: Plan, sim: SimResult): string {
  const start = sim.rmd?.startAge ?? rmdStartAge(plan.primary.birthDate);
  const bits: string[] = [];
  bits.push(
    `RMD engine is running in the background (you don't set this). SECURE 2.0: required minimum distributions start at age ${start ?? 75} on pre-tax accounts. IRS Uniform Lifetime Table. Forced withdrawals are booked as ordinary income.`,
  );
  const roth = sim.rmd?.lifetimeRothExempt ?? [];
  if (roth.length) {
    bits.push(
      `No lifetime RMD on Roth IRA / Roth 401(k): ${roth.join(", ")}. Congress actually did something useful in 2024.`,
    );
  } else {
    bits.push(
      "Roth IRA and Roth 401(k) have no lifetime RMD. Traditional IRA does, whether you're working or not.",
    );
  }
  const deferred = sim.rmd?.stillWorkingDeferred ?? [];
  if (deferred.length) {
    bits.push(
      `Still-working exception is ON for ${deferred.join(", ")} — salary/wages is flowing and you're still contributing, so MACH is not forcing 401(k)/TSP RMDs from those accounts. Traditional IRA does not get that courtesy.`,
    );
  } else {
    bits.push(
      "Still-working exception (401(k)/TSP only): if a W-2 is on AND you're depositing into that workplace account, MACH skips the RMD there. Stop depositing or stop the salary, and the IRS tap turns on.",
    );
  }
  const forced = sim.rmd?.forced ?? [];
  if (forced.length && (sim.rmd?.firstYearAnnual ?? 0) > 0) {
    bits.push(
      `Forced RMDs on this run: ${forced.join(", ")}. First-year annual haul about ${usd(sim.rmd.firstYearAnnual)} — that's income now, whether you wanted it or not.`,
    );
  }
  return bits.join(" ");
}
