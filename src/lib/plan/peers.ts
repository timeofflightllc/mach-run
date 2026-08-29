import { ageYears, dateAtAge, monthStart, validIso, yearlyRateToMonthly } from "./dates.ts";
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

export interface BriefSection {
  title: string;
  body: string;
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
    return {
      headline: `You are not on track for ${usd(egg.goal)} by ${egg.targetYear}${byAge}.`,
      body: `Projected spendable there is ${usd(egg.projected)} — short ${usd(Math.max(0, egg.goal - egg.projected))}. Invest about ${usd(egg.extraMonthly, true)} more per month (on top of what you already entered), compounding at your assumed real return, to close the gap by that date.`,
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
  const sections: BriefSection[] = [];
  const add = (title: string, body: string) => sections.push({ title, body });
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
  add("This MACH Run", snapshot);
  const egg = nestEggTrack(plan, sim);
  if (egg) {
    add(
      "Nest egg goal",
      egg.onTrack
        ? `Goal ${usd(egg.goal)} by ${egg.targetYear}${egg.targetAge != null ? ` (age ${egg.targetAge})` : ""}. Projected ${usd(egg.projected)} in today's dollars — on track.`
        : `Goal ${usd(egg.goal)} by ${egg.targetYear}${egg.targetAge != null ? ` (age ${egg.targetAge})` : ""}. Projected ${usd(egg.projected)}. Gap ${usd(Math.max(0, egg.goal - egg.projected))}. About ${usd(egg.extraMonthly, true)}/mo more invested closes it at your assumed return.`,
    );
  }

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

  if (namedIncomes.length) {
    const listed = namedIncomes
      .map((s) => {
        const win = streamWindow(plan, s);
        const amt = streamBenefitToday(plan, s, asOf);
        const end = win.end ? win.end.slice(0, 7) : "open";
        return `${s.name.trim() || s.kind}  ${usd(amt, true)}/mo  (${win.start.slice(0, 7)} → ${end})`;
      })
      .join("\n");
    add(
      "Paychecks",
      `Income stages on this run:\n${listed}\nMACH RUN only scores what you typed, so every pension and side check you add makes this picture truer.`,
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

  if (netWorth > 0 && spendable / netWorth < 0.35) {
    add(
      "Spendable vs paper rich",
      `Spendable accounts are ${usd(spendable)} of ${usd(netWorth)} net worth. The rest is illiquid — house, cars, kids' accounts. That's still wealth; it just isn't grocery money. Knowing the split is a strength.`,
    );
  }

  add(
    "Compounding",
    `Spending starts at ${usd(spendingNow, true)}/mo and inflates at ${plan.assumptions.inflationPct}% a year. Accounts compound at ${plan.assumptions.defaultReturnPct}% nominal unless an account has its own rate. Spendable goes from ${usd(spendable)} now to ${usd(horizon)} at age ${plan.assumptions.projectionEndAge} in today's dollars. Time is on your side if you leave the machine running.`,
  );

  add("RMDs", rmdAdvice(plan, sim));

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
        `Retirement goal is ${ret.date.slice(0, 7)}${retAge != null ? ` (age ${retAge})` : ""}. Spendable there: ${usd(ret.spendableReal)} in today's dollars. Modeled retirement income ${usd(ret.annualIncomeReal)} a year (${usd(ret.monthlyIncomeReal, true)}/mo) from the stages you entered.`,
      );
    }
  } else {
    add(
      "Retirement landing",
      "No retirement goal date in Family yet, so MACH RUN cannot score the landing. Put a goal date in — or check Already retired — then Calculate again.",
    );
  }

  if (plan.portfolios.length) {
    const listed = plan.portfolios
      .map((p) => {
        const base =
          p.kind === "annuity" && (p.costBasis ?? 0) > 0
            ? `${p.name.trim() || p.kind} ${usd(p.currentValue)} (invested ${usd(p.costBasis ?? 0)})`
            : `${p.name.trim() || p.kind} ${usd(p.currentValue)}`;
        return base;
      })
      .join("; ");
    add(
      "Accounts on this run",
      `${listed}. ${plan.portfolios.length === 1 ? "One account is a clean start. Add the rest of the hangar when you're ready." : "That mix is the machine. Returns do the quiet work if you leave them invested."}`,
    );
  }

  if (sim.depletedAge != null) {
    add(
      "Runway",
      `The MACH Run runs out of spendable at age ${sim.depletedAge} (${sim.depletedYear}). That's useful information, not a verdict. A little more saving, a little less spending, or a longer paycheck can move that date. You've got levers.`,
    );
  } else if (annualIncome > 0 || netWorth > 0) {
    add(
      "Runway",
      `On the numbers you typed, spendable lasts through age ${plan.assumptions.projectionEndAge}. That's the MACH RUN engine talking, not a guarantee — and it's a strong place to be. Markets can still wobble; the plan you built is the buffer.`,
    );
  }

  return pack();
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
      `Still-working exception is ON for ${deferred.join(", ")} — salary/wages is flowing and you're still contributing, so MACH RUN is not forcing 401(k)/TSP RMDs from those accounts. Traditional IRA does not get that courtesy.`,
    );
  } else {
    bits.push(
      "Still-working exception (401(k)/TSP only): if a W-2 is on AND you're depositing into that workplace account, MACH RUN skips the RMD there. Stop depositing or stop the salary, and the IRS tap turns on.",
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
