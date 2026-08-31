import { addMonths, addYears, format, isBefore } from "date-fns";
import { ensurePlan } from "./defaults.ts";
import { vaPayTodayDollars } from "./va.ts";
import {
  ageYears,
  dateAtAge,
  inRange,
  iso,
  monthStart,
  validIso,
  yearlyRateToMonthly,
} from "./dates.ts";
import { ssBenefitFromPia, ssBirthFor, ssScheduleDates } from "./social-security.ts";
import {
  ageInCalendarYear,
  monthlyRmd,
  ownerBirth,
  rmdClass,
  rmdDueThisMonth,
  rmdStartAge,
} from "./rmd.ts";
import { normalizeOwner } from "./family-owners.ts";
import { irsAnnualCap, irsLimitClass } from "./irs-limits.ts";
import { mortgagePaymentDue, portfolioEquity, remainingMortgage } from "./mortgage.ts";
import { liabilityPaymentDue, remainingLiability } from "./liability.ts";
import type {
  FundingGap,
  IncomeStage,
  IncomeStream,
  MonthSnapshot,
  Plan,
  SimResult,
  StageMark,
  TaxBucket,
  YearSnapshot,
} from "./types";

const WITHDRAW_ORDER: TaxBucket[] = ["taxable", "pre_tax", "roth"];

function isGuaranteedKind(kind: string): boolean {
  return (
    kind === "military" ||
    kind === "va" ||
    kind === "ss" ||
    kind === "pension" ||
    kind === "other_retirement"
  );
}

function isNonQualifiedAnnuity(p: { kind: string; taxBucket: TaxBucket }): boolean {
  return p.kind === "annuity" && p.taxBucket !== "pre_tax" && p.taxBucket !== "roth";
}

function emptyBuckets(): Record<TaxBucket, number> {
  return { roth: 0, pre_tax: 0, taxable: 0, none: 0 };
}

function vaMonthlyToday(plan: Plan, at: Date, stream: IncomeStream): number {
  if (stream.kind !== "va") return stream.monthlyAmount || 0;
  return vaPayTodayDollars(plan, stream, at);
}

function findStage(plan: Plan, id: string | undefined): IncomeStage | undefined {
  if (!id) return undefined;
  return (plan.stages ?? []).find((s) => s.id === id);
}

function firstIncomeEnd(plan: Plan): Date {
  const ended = plan.incomes.find((s) => s.endDate);
  if (ended?.endDate) return monthStart(ended.endDate);
  return monthStart(plan.assumptions.careerEndDate);
}

export function streamWindow(
  plan: Plan,
  stream: IncomeStream,
): { start: string; end: string | null } {
  let start = stream.startDate || plan.assumptions.asOfDate;
  let end = stream.endDate;
  if (stream.kind === "ss" && stream.ssClaimAge != null) {
    const window = ssScheduleDates(
      ssBirthFor(plan, stream),
      stream.ssClaimAge,
      plan.assumptions.projectionEndAge,
    );
    if (window) return { start: window.startDate, end: window.endDate };
  }
  const stageId =
    stream.tiedToStageId ?? (stream.tiedToCareer ? plan.stages?.[0]?.id : undefined);
  const stage = findStage(plan, stageId);
  if (stage) {
    start =
      stream.startDate > stage.startDate ? stream.startDate : stage.startDate;
    end = stage.endDate;
    const monthsBefore =
      stream.endMonthsBeforeStage ?? stream.endMonthsBeforeCareer;
    if (monthsBefore != null && stage.endDate) {
      end = iso(addMonths(monthStart(stage.endDate), -monthsBefore));
    }
  }
  return { start, end };
}

function spendingWindow(
  plan: Plan,
  phase: Plan["spending"][number],
): { start: string; end: string | null } {
  const stage = findStage(plan, phase.tiedToStageId);
  if (!stage) return { start: phase.startDate, end: phase.endDate };
  return { start: stage.startDate, end: stage.endDate };
}

function contributionWindow(
  plan: Plan,
  rule: Plan["contributions"][number],
): { start: string; end: string | null } {
  if (rule.amountMode === "percent" && rule.percentOfIncomeId) {
    const stream = plan.incomes.find((s) => s.id === rule.percentOfIncomeId);
    if (stream) return streamWindow(plan, stream);
  }
  const stage = findStage(plan, rule.endWithStageId);
  if (!stage) return { start: rule.startDate, end: rule.endDate };
  return { start: rule.startDate, end: stage.endDate };
}

function isWorkplaceMatchAccount(kind: string): boolean {
  return kind === "401k" || kind === "401k_roth" || kind === "tsp";
}

function streamColaAnnual(plan: Plan, stream: IncomeStream, infA: number): number {
  if (stream.colaPct != null) return stream.colaPct / 100;
  const d = plan.assumptions.defaultColaPct;
  if (d != null && Number.isFinite(d)) return d / 100;
  return infA;
}

function streamNominalAt(
  plan: Plan,
  stream: IncomeStream,
  cursor: Date,
  monthsFromAsOf: number,
  infA: number,
): number {
  const win = streamWindow(plan, stream);
  if (!inRange(cursor, win.start, win.end)) return 0;
  const todayAmt = streamBenefitToday(plan, stream, cursor);
  const colaAnnual = streamColaAnnual(plan, stream, infA);
  const mCola = yearlyRateToMonthly(colaAnnual);
  return todayAmt * (1 + mCola) ** monthsFromAsOf;
}

function contributionDueThisMonth(
  plan: Plan,
  rule: Plan["contributions"][number],
  cursor: Date,
  monthsFromAsOf: number,
  infA: number,
): number {
  const win = contributionWindow(plan, rule);
  if (!inRange(cursor, win.start, win.end)) return 0;
  if (rule.amountMode === "percent") {
    const stream = plan.incomes.find((s) => s.id === rule.percentOfIncomeId);
    if (!stream) return 0;
    const pct = rule.percentOfIncome ?? 0;
    if (pct <= 0) return 0;
    return streamNominalAt(plan, stream, cursor, monthsFromAsOf, infA) * (pct / 100);
  }
  return rule.monthlyAmount > 0 ? rule.monthlyAmount : 0;
}

export function streamBenefitToday(
  plan: Plan,
  stream: IncomeStream,
  at: Date,
): number {
  if (stream.kind === "ss" && stream.ssPia != null && stream.ssClaimAge != null) {
    return ssBenefitFromPia(stream.ssPia, stream.ssClaimAge, stream.ssFra ?? 67);
  }
  if (stream.kind === "va") return vaMonthlyToday(plan, at, stream);
  return stream.monthlyAmount || 0;
}

/** Monthly pay in today's dollars that is on at `at`. */
export function monthlyIncomeAt(plan: Plan, at: Date): number {
  let n = 0;
  for (const stream of plan.incomes) {
    const win = streamWindow(plan, stream);
    if (!inRange(at, win.start, win.end)) continue;
    n += streamBenefitToday(plan, stream, at);
  }
  return n;
}

/**
 * Household earning power for peer ranking: active pay at as-of,
 * else the first simulated year that actually has a paycheck.
 */
export function representativeAnnualIncome(plan: Plan, sim: SimResult): number {
  const asOf = monthStart(plan.assumptions.asOfDate);
  const now = monthlyIncomeAt(plan, asOf);
  if (now > 1) return now * 12;
  const year = sim.years.find((y) => y.income > 1);
  return year?.income ?? 0;
}

export function representativeSaveRate(sim: SimResult): number | null {
  const year = sim.years.find((y) => y.income > 50) ?? sim.years[0];
  if (!year || year.income < 50) return null;
  return (year.contributions / year.income) * 100;
}

function inflate(
  amountToday: number,
  monthlyInflation: number,
  monthsFromAsOf: number,
) {
  return amountToday * (1 + monthlyInflation) ** Math.max(0, monthsFromAsOf);
}

function withdrawNeed(
  plan: Plan,
  values: Map<string, number>,
  basis: Map<string, number>,
  need: number,
  taxR: number,
): number {
  let remaining = need;
  let withdrawn = 0;
  for (const bucket of WITHDRAW_ORDER) {
    if (remaining <= 0.5) break;
    for (const p of plan.portfolios) {
      if (!p.spendable || p.taxBucket !== bucket) continue;
      if (remaining <= 0.5) break;
      let v = values.get(p.id) ?? 0;
      if (v <= 0) continue;

      if (isNonQualifiedAnnuity(p)) {
        let b = Math.min(Math.max(0, basis.get(p.id) ?? 0), v);
        let gain = Math.max(0, v - b);
        if (gain > 0.5 && remaining > 0.5) {
          const take =
            taxR < 0.99 ? Math.min(gain, remaining / (1 - taxR)) : Math.min(gain, remaining);
          v -= take;
          gain -= take;
          withdrawn += take;
          remaining -= taxR < 0.99 ? take * (1 - taxR) : take;
        }
        if (remaining > 0.5 && v > 0) {
          const take = Math.min(v, remaining);
          v -= take;
          b = Math.max(0, b - take);
          withdrawn += take;
          remaining -= take;
        }
        values.set(p.id, v);
        basis.set(p.id, Math.min(b, v));
        continue;
      }

      if (bucket === "pre_tax" && taxR < 0.99) {
        const take = Math.min(v, remaining / (1 - taxR));
        values.set(p.id, v - take);
        withdrawn += take;
        remaining -= take * (1 - taxR);
      } else {
        const take = Math.min(v, remaining);
        values.set(p.id, v - take);
        withdrawn += take;
        remaining -= take;
      }
    }
  }
  return withdrawn;
}

export function simulate(raw: Plan): SimResult {
  const plan = ensurePlan(raw);
  const asOf = monthStart(plan.assumptions.asOfDate);
  const endDate = validIso(plan.primary.birthDate)
    ? dateAtAge(plan.primary.birthDate, plan.assumptions.projectionEndAge)
    : addYears(asOf, 40);
  const infA = plan.assumptions.inflationPct / 100;
  const taxR = plan.assumptions.ordinaryTaxRatePct / 100;
  const ssTaxShare = plan.assumptions.ssTaxablePct / 100;
  const mInf = yearlyRateToMonthly(infA);
  const stage1End = firstIncomeEnd(plan);

  const values = new Map<string, number>();
  const basis = new Map<string, number>();
  for (const p of plan.portfolios) {
    values.set(p.id, p.currentValue);
    if (isNonQualifiedAnnuity(p)) {
      basis.set(p.id, Math.max(0, Math.min(p.costBasis ?? 0, p.currentValue)));
    }
  }
  const priorYearEnd = new Map<string, number>(values);
  const rmdNote = {
    lifetimeRothExempt: [] as string[],
    stillWorkingDeferred: [] as string[],
    forced: [] as string[],
    firstYearAnnual: 0,
    total: 0,
  };
  for (const p of plan.portfolios) {
    const klass = rmdClass(p);
    const label = p.name.trim() || p.kind;
    if (klass === "none" && (p.taxBucket === "roth" || p.kind.includes("roth"))) {
      rmdNote.lifetimeRothExempt.push(label);
    }
  }

  const months: MonthSnapshot[] = [];
  let depletedAge: number | null = null;
  let depletedYear: number | null = null;
  let markedDepleted = false;
  let totalContributed = 0;
  let totalWithdrawn = 0;

  let cursor = asOf;
  let guard = 0;
  const irsYtd = new Map<string, number>();
  while (!isBefore(endDate, cursor) && guard < 1200) {
    guard += 1;
    const monthsFromAsOf = months.length;
    const inflationIndex = (1 + mInf) ** monthsFromAsOf;

    for (const p of plan.portfolios) {
      const annual = (p.returnPct ?? plan.assumptions.defaultReturnPct) / 100;
      const mRet = yearlyRateToMonthly(annual);
      values.set(p.id, (values.get(p.id) ?? 0) * (1 + mRet));
    }

    const incomeByKind: Record<string, number> = {};
    let income = 0;
    let taxableBase = 0;
    let guaranteed = 0;

    for (const stream of plan.incomes) {
      const win = streamWindow(plan, stream);
      if (!inRange(cursor, win.start, win.end)) continue;
      const todayAmt = streamBenefitToday(plan, stream, cursor);
      const colaAnnual = streamColaAnnual(plan, stream, infA);
      const mCola = yearlyRateToMonthly(colaAnnual);
      const nominal = todayAmt * (1 + mCola) ** monthsFromAsOf;
      income += nominal;
      incomeByKind[stream.kind] = (incomeByKind[stream.kind] ?? 0) + nominal;
      if (stream.taxTreatment === "ordinary") taxableBase += nominal;
      if (stream.taxTreatment === "ss") taxableBase += nominal * ssTaxShare;
      if (isGuaranteedKind(stream.kind)) {
        guaranteed += nominal;
      }
    }

    let spending = 0;
    for (const phase of plan.spending) {
      const win = spendingWindow(plan, phase);
      if (!inRange(cursor, win.start, win.end)) continue;
      spending += inflate(phase.monthlyAmount, mInf, monthsFromAsOf);
    }
    for (const p of plan.portfolios) {
      if (p.kind !== "real_estate") continue;
      spending += mortgagePaymentDue(p.mortgage, cursor);
    }
    for (const l of plan.liabilities ?? []) {
      spending += liabilityPaymentDue(l, cursor);
    }

    const due: { portfolioId: string; amount: number; matchPct: number }[] = [];
    let planned = 0;
    for (const rule of plan.contributions) {
      let amount = contributionDueThisMonth(plan, rule, cursor, monthsFromAsOf, infA);
      if (amount <= 0) continue;
      if (!values.has(rule.portfolioId)) continue;
      const dest = plan.portfolios.find((p) => p.id === rule.portfolioId);
      const cls = dest ? irsLimitClass(dest.kind) : null;
      const person =
        dest && normalizeOwner(dest.owner) === "spouse" ? "spouse" : "primary";
      const ytdKey = cls ? `${cursor.getFullYear()}|${person}|${cls}` : null;
      if (rule.capToIrsLimit && dest && cls && ytdKey) {
        const birth =
          person === "spouse" ? plan.spouse.birthDate : plan.primary.birthDate;
        const age = ageInCalendarYear(birth, cursor.getFullYear());
        const cap = irsAnnualCap(dest.kind, age) ?? 0;
        const used = irsYtd.get(ytdKey) ?? 0;
        amount = Math.min(amount, Math.max(0, cap - used));
      }
      if (amount <= 0) continue;
      if (ytdKey) irsYtd.set(ytdKey, (irsYtd.get(ytdKey) ?? 0) + amount);
      const matchPct =
        rule.employerMatch && dest && isWorkplaceMatchAccount(dest.kind)
          ? Math.max(0, Math.min(100, rule.employerMatchPct ?? 0))
          : 0;
      due.push({ portfolioId: rule.portfolioId, amount, matchPct });
      planned += amount;
    }
    const contribIds = new Set(due.map((d) => d.portfolioId));
    const salaryOn = plan.incomes.some((stream) => {
      if (stream.kind !== "salary") return false;
      const win = streamWindow(plan, stream);
      if (!inRange(cursor, win.start, win.end)) return false;
      return streamBenefitToday(plan, stream, cursor) > 0;
    });

    let rmd = 0;
    const rmdTakes: { id: string; amount: number }[] = [];
    for (const p of plan.portfolios) {
      const contributing = contribIds.has(p.id);
      const dueNow = rmdDueThisMonth(plan, p, cursor, salaryOn, contributing);
      const label = p.name.trim() || p.kind;
      if (rmdClass(p) === "workplace" && salaryOn && contributing) {
        if (!rmdNote.stillWorkingDeferred.includes(label)) {
          rmdNote.stillWorkingDeferred.push(label);
        }
      }
      if (!dueNow) continue;
      const birth = ownerBirth(plan, p);
      const age = ageInCalendarYear(birth, cursor.getFullYear());
      const take = monthlyRmd(priorYearEnd.get(p.id) ?? 0, age);
      if (take <= 0.5) continue;
      rmd += take;
      rmdTakes.push({ id: p.id, amount: take });
      if (!rmdNote.forced.includes(label)) rmdNote.forced.push(label);
    }
    if (rmd > 0.5) {
      income += rmd;
      taxableBase += rmd;
      incomeByKind.rmd = (incomeByKind.rmd ?? 0) + rmd;
      if (rmdNote.firstYearAnnual === 0) rmdNote.firstYearAnnual = rmd * 12;
      rmdNote.total += rmd;
    }

    const tax = taxableBase * taxR;
    const leftover = income - tax - spending;

    let appliedContrib = 0;
    let withdrawals = 0;
    for (const t of rmdTakes) {
      const v = values.get(t.id) ?? 0;
      const take = Math.min(v, t.amount);
      values.set(t.id, v - take);
      withdrawals += take;
    }

    if (leftover > 0.5) {
      let pool = leftover;
      const funded: { portfolioId: string; amount: number; matchPct: number }[] = [];
      for (const d of due) {
        if (pool <= 0.5) break;
        const take = Math.min(d.amount, pool);
        values.set(d.portfolioId, (values.get(d.portfolioId) ?? 0) + take);
        if (basis.has(d.portfolioId)) {
          basis.set(d.portfolioId, (basis.get(d.portfolioId) ?? 0) + take);
        }
        pool -= take;
        appliedContrib += take;
        funded.push({ portfolioId: d.portfolioId, amount: take, matchPct: d.matchPct });
      }
      const sweepId = plan.assumptions.sweepPortfolioId;
      if (pool > 0.5 && sweepId && values.has(sweepId)) {
        values.set(sweepId, (values.get(sweepId) ?? 0) + pool);
        if (basis.has(sweepId)) {
          basis.set(sweepId, (basis.get(sweepId) ?? 0) + pool);
        }
        appliedContrib += pool;
      }
      for (const f of funded) {
        if (f.matchPct <= 0) continue;
        const match = f.amount * (f.matchPct / 100);
        if (match <= 0.5) continue;
        values.set(f.portfolioId, (values.get(f.portfolioId) ?? 0) + match);
        income += match;
        incomeByKind.employer_match = (incomeByKind.employer_match ?? 0) + match;
        appliedContrib += match;
        planned += match;
      }
    } else if (leftover < -0.5) {
      withdrawals += withdrawNeed(plan, values, basis, -leftover, taxR);
      if (!markedDepleted) {
        const left = plan.portfolios
          .filter((p) => p.spendable)
          .reduce((s, p) => s + Math.max(0, values.get(p.id) ?? 0), 0);
        if (left < 1) {
          markedDepleted = true;
          depletedAge = ageYears(plan.primary.birthDate, cursor);
          depletedYear = cursor.getFullYear();
        }
      }
    }

    const byBucket = emptyBuckets();
    let spendableEnd = 0;
    let netWorthEnd = 0;
    let assetsEnd = 0;
    let liabilitiesEnd = 0;
    for (const p of plan.portfolios) {
      const v = values.get(p.id) ?? 0;
      byBucket[p.taxBucket] += v;
      if (p.includeInNetWorth) {
        const debt = p.kind === "real_estate" ? remainingMortgage(p.mortgage, cursor) : 0;
        assetsEnd += v;
        liabilitiesEnd += debt;
        netWorthEnd += v - debt;
      }
      if (p.spendable) spendableEnd += v;
    }
    for (const l of plan.liabilities ?? []) {
      const debt = remainingLiability(l, cursor);
      liabilitiesEnd += debt;
      netWorthEnd -= debt;
    }

    totalContributed += appliedContrib;
    totalWithdrawn += withdrawals;

    months.push({
      date: iso(cursor),
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      primaryAge: ageYears(plan.primary.birthDate, cursor),
      spouseAge: ageYears(plan.spouse.birthDate, cursor),
      portfolioEnd: spendableEnd,
      portfolioEndReal: spendableEnd / inflationIndex,
      spendableEnd,
      spendableEndReal: spendableEnd / inflationIndex,
      netWorthEnd,
      netWorthEndReal: netWorthEnd / inflationIndex,
      assetsEnd,
      assetsEndReal: assetsEnd / inflationIndex,
      liabilitiesEnd,
      liabilitiesEndReal: liabilitiesEnd / inflationIndex,
      contributions: appliedContrib,
      plannedContributions: planned,
      withdrawals,
      income,
      incomeTaxable: taxableBase,
      tax,
      spending,
      surplus: leftover,
      guaranteed,
      incomeByKind,
      byBucket,
    });

    if (cursor.getMonth() === 11) {
      for (const p of plan.portfolios) {
        priorYearEnd.set(p.id, values.get(p.id) ?? 0);
      }
    }

    cursor = addMonths(cursor, 1);
  }

  const years: YearSnapshot[] = [];
  const byYear = new Map<number, MonthSnapshot[]>();
  for (const m of months) {
    const arr = byYear.get(m.year) ?? [];
    arr.push(m);
    byYear.set(m.year, arr);
  }
  for (const [year, arr] of byYear) {
    const last = arr[arr.length - 1];
    const sum = (fn: (m: MonthSnapshot) => number) =>
      arr.reduce((s, m) => s + fn(m), 0);
    const incomeByKind: Record<string, number> = {};
    for (const m of arr) {
      for (const [k, v] of Object.entries(m.incomeByKind)) {
        incomeByKind[k] = (incomeByKind[k] ?? 0) + v;
      }
    }
    years.push({
      year,
      primaryAge: last.primaryAge,
      spouseAge: last.spouseAge,
      endPortfolio: last.portfolioEnd,
      endPortfolioReal: last.portfolioEndReal,
      endSpendable: last.spendableEnd,
      endSpendableReal: last.spendableEndReal,
      endNetWorth: last.netWorthEnd,
      endNetWorthReal: last.netWorthEndReal,
      endAssets: last.assetsEnd,
      endAssetsReal: last.assetsEndReal,
      endLiabilities: last.liabilitiesEnd,
      endLiabilitiesReal: last.liabilitiesEndReal,
      contributions: sum((m) => m.contributions),
      plannedContributions: sum((m) => m.plannedContributions),
      withdrawals: sum((m) => m.withdrawals),
      income: sum((m) => m.income),
      tax: sum((m) => m.tax),
      spending: sum((m) => m.spending),
      surplus: sum((m) => m.surplus),
      guaranteed: sum((m) => m.guaranteed),
      incomeByKind,
    });
  }

  function markAt(dateIso: string): MonthSnapshot | undefined {
    const key = dateIso.slice(0, 7);
    return (
      months.find((m) => m.date.startsWith(key)) ??
      months.find((m) => m.date >= dateIso)
    );
  }

  const stageMarks: StageMark[] = plan.incomes
    .filter((s) => s.endDate)
    .map((s) => {
      const m = markAt(s.endDate as string);
      return {
        id: s.id,
        label: s.name.trim() || "Income",
        date: s.endDate as string,
        spendable: m?.spendableEnd ?? 0,
        spendableReal: m?.spendableEndReal ?? 0,
        guaranteed: m?.guaranteed ?? 0,
        spending: m?.spending ?? 0,
      };
    });

  const fundingGaps: FundingGap[] = years
    .filter((y) => y.plannedContributions > Math.max(0, y.surplus) + 1)
    .map((y) => ({
      year: y.year,
      planned: y.plannedContributions,
      leftover: Math.max(0, y.surplus),
      funded: Math.min(y.plannedContributions, Math.max(0, y.surplus)),
    }));

  const careerIso = format(stage1End, "yyyy-MM");
  const careerMonth =
    months.find((m) => m.date.startsWith(careerIso)) ??
    months.find((m) => m.date >= iso(stage1End)) ??
    months[0];
  const last = months[months.length - 1];

  let retirement: SimResult["retirement"] = null;
  const goal = plan.assumptions.retirementGoalDate;
  if (goal && months.length) {
    const asOfKey = iso(asOf).slice(0, 7);
    const goalKey = goal.slice(0, 7);
    const m =
      months.find((row) => row.date.startsWith(goalKey)) ??
      months.find((row) => row.date >= goal) ??
      last;
    const startIdx = Math.max(0, months.indexOf(m));
    const window = months.slice(startIdx, startIdx + 12);
    const annualIncome = window.reduce((s, row) => s + row.income, 0);
    const annualIncomeReal = window.reduce((s, row, i) => {
      const idx = startIdx + i;
      const factor = (1 + mInf) ** idx;
      return s + row.income / Math.max(factor, 1e-9);
    }, 0);
    const atStart = startIdx <= 0;
    const prev = startIdx > 0 ? months[startIdx - 1] : null;
    const pile = atStart ? startingSpendable(plan) : (prev?.spendableEnd ?? 0);
    const pileReal = atStart
      ? startingSpendable(plan)
      : (prev?.spendableEndReal ?? 0);
    retirement = {
      date: m.date,
      now: m.date.startsWith(asOfKey) || goalKey <= asOfKey,
      spendable: pile,
      spendableReal: pileReal,
      annualIncome,
      monthlyIncome: annualIncome / 12,
      annualIncomeReal,
      monthlyIncomeReal: annualIncomeReal / 12,
      monthlySpending: m.spending,
    };
  }

  return {
    months,
    years,
    stageMarks,
    fundingGaps,
    depletedAge,
    depletedYear,
    retirement,
    spendableAtCareerEnd: careerMonth?.spendableEnd ?? 0,
    spendableAtCareerEndReal: careerMonth?.spendableEndReal ?? 0,
    guaranteedAtCareerEnd: careerMonth?.guaranteed ?? 0,
    spendingAtCareerEnd: careerMonth?.spending ?? 0,
    coverageAtCareerEnd:
      careerMonth && careerMonth.spending > 0
        ? careerMonth.guaranteed / careerMonth.spending
        : 0,
    spendableAtEnd: last?.spendableEnd ?? 0,
    spendableAtEndReal: last?.spendableEndReal ?? 0,
    totalContributed,
    totalWithdrawn,
    rmd: {
      startAge: rmdStartAge(plan.primary.birthDate),
      lifetimeRothExempt: rmdNote.lifetimeRothExempt,
      stillWorkingDeferred: rmdNote.stillWorkingDeferred,
      forced: rmdNote.forced,
      firstYearAnnual: rmdNote.firstYearAnnual,
      total: rmdNote.total,
    },
  };
}

export function startingSpendable(plan: Plan): number {
  return plan.portfolios
    .filter((p) => p.spendable)
    .reduce((s, p) => s + p.currentValue, 0);
}

export function startingNetWorth(plan: Plan): number {
  const asOf = plan.assumptions.asOfDate;
  const equity = plan.portfolios
    .filter((p) => p.includeInNetWorth)
    .reduce((s, p) => s + portfolioEquity(p, asOf), 0);
  const extra = (plan.liabilities ?? []).reduce(
    (s, l) => s + remainingLiability(l, asOf),
    0,
  );
  return equity - extra;
}