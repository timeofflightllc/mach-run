import { addMonths, addYears, format, isBefore } from "date-fns";
import { applyShock } from "./monte-carlo.ts";
import { ensurePlan } from "./defaults.ts";
import { vaPayTodayDollars } from "./va.ts";
import {
  ageYears,
  dateAtAge,
  earlierEnd,
  inRange,
  iso,
  monthStart,
  validIso,
  yearlyRateToMonthly,
  calendarColaYears,
} from "./dates.ts";
import { ssBenefitFromPia, ssBirthFor, ssScheduleDates } from "./social-security.ts";
import {
  ageInCalendarYear,
  monthlyRmd,
  ownerBirth,
  rmdClass,
  rmdDueThisMonth,
  rmdStartAge,
  uniformLifetimeFactor,
} from "./rmd.ts";
import { emptyAudit, type PlanAudit } from "./audit.ts";
import { irsAnnualCap, irsCapPerson, irsLimitClass } from "./irs-limits.ts";
import { isTaxQualified } from "./family-owners.ts";
import { mortgagePaymentDue, portfolioEquity, remainingMortgage } from "./mortgage.ts";
import { liabilityPaymentDue, remainingLiability } from "./liability.ts";
import type {
  FundingGap,
  IncomeStage,
  IncomeStream,
  LedgerLine,
  MonthSnapshot,
  Plan,
  RmdAccountRow,
  SimResult,
  StageMark,
  TaxBucket,
  YearCap,
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

export function spendingWindow(
  plan: Plan,
  phase: Plan["spending"][number],
): { start: string; end: string | null } {
  const stage = findStage(plan, phase.tiedToStageId);
  if (!stage) return { start: phase.startDate, end: phase.endDate };
  return { start: stage.startDate, end: stage.endDate };
}

export function contributionWindow(
  plan: Plan,
  rule: Plan["contributions"][number],
): { start: string; end: string | null } {
  if (rule.amountMode === "percent" && rule.percentOfIncomeId) {
    const stream = plan.incomes.find((s) => s.id === rule.percentOfIncomeId);
    if (stream) {
      const win = streamWindow(plan, stream);
      if (!rule.stopDate || !validIso(rule.stopDate)) return win;
      return { start: win.start, end: earlierEnd(win.end, rule.stopDate) };
    }
  }
  const stage = findStage(plan, rule.endWithStageId);
  if (!stage) return { start: rule.startDate, end: rule.endDate };
  return { start: rule.startDate, end: stage.endDate };
}

function isWorkplaceMatchAccount(kind: string): boolean {
  return kind === "401k" || kind === "401k_roth" || kind === "tsp" || kind === "tsp_roth";
}

export function streamColaAnnual(plan: Plan, stream: IncomeStream, infA: number): number {
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
  const years = calendarColaYears(monthStart(plan.assumptions.asOfDate), cursor);
  return todayAmt * (1 + colaAnnual) ** years;
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
  log?: { id: string; amount: number; taxableGain: number; basisReturn: number }[],
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
          log?.push({ id: p.id, amount: take, taxableGain: take, basisReturn: 0 });
        }
        if (remaining > 0.5 && v > 0) {
          const take = Math.min(v, remaining);
          v -= take;
          b = Math.max(0, b - take);
          withdrawn += take;
          remaining -= take;
          log?.push({ id: p.id, amount: take, taxableGain: 0, basisReturn: take });
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
        log?.push({ id: p.id, amount: take, taxableGain: 0, basisReturn: 0 });
      } else {
        const take = Math.min(v, remaining);
        values.set(p.id, v - take);
        withdrawn += take;
        remaining -= take;
        log?.push({ id: p.id, amount: take, taxableGain: 0, basisReturn: 0 });
      }
    }
  }
  return withdrawn;
}

/** Qualified destinations first. Relative order inside each group stays as listed. */
function fundQualifiedFirst<T extends { portfolioId: string }>(plan: Plan, rows: T[]): T[] {
  const rank = (portfolioId: string) => {
    const dest = plan.portfolios.find((p) => p.id === portfolioId);
    return dest && isTaxQualified(dest.kind) ? 0 : 1;
  };
  return rows
    .map((row, index) => ({ row, index, rank: rank(row.portfolioId) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.row);
}

function savedBreakdown(months: MonthSnapshot[]): LedgerLine[] {
  const map = new Map<string, LedgerLine>();
  const add = (id: string, label: string, amount: number) => {
    if (amount <= 0.005) return;
    const got = map.get(id) ?? { id, label, amount: 0 };
    got.amount += amount;
    got.label = label;
    map.set(id, got);
  };
  for (const month of months) {
    const detail = month.detail;
    if (!detail) continue;
    for (const line of detail.savedLines) add(`save:${line.id}`, line.label, line.amount);
    if (detail.sweep) add(`sweep:${detail.sweep.id}`, detail.sweep.label, detail.sweep.amount);
    for (const line of detail.matchLines) add(line.id, line.label, line.amount);
  }
  return [...map.values()]
    .filter((row) => row.amount > 0.5)
    .sort((a, b) => b.amount - a.amount);
}

/** One row per account. RMD and extra draws from the same account are combined. */
function drawnBreakdown(months: MonthSnapshot[]): LedgerLine[] {
  const map = new Map<string, LedgerLine>();
  for (const month of months) {
    for (const line of month.detail?.drawnLines ?? []) {
      if (line.amount <= 0.005) continue;
      const id = line.id.endsWith(":rmd") ? line.id.slice(0, -4) : line.id;
      const got = map.get(id) ?? { id, label: line.label, amount: 0 };
      got.amount += line.amount;
      if (!line.id.endsWith(":rmd")) got.label = line.label;
      map.set(id, got);
    }
  }
  return [...map.values()]
    .filter((row) => row.amount > 0.5)
    .sort((a, b) => b.amount - a.amount);
}

export type ReturnShocks = {
  stdev: number;
  zForYear: (year: number) => number;
};

export function simulate(raw: Plan, opts?: { audit?: boolean; shocks?: ReturnShocks }): SimResult {
  const plan = ensurePlan(raw);
  const wantAudit = Boolean(opts?.audit);
  const audit: PlanAudit | null = wantAudit ? emptyAudit() : null;
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
  const rmdYearTotals = new Map<string, Map<number, number>>();
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
  const goalKey = (plan.assumptions.retirementGoalDate ?? "").slice(0, 7);
  const asOfKey = iso(asOf).slice(0, 7);
  let atRetirement = new Map<string, number>();
  let atRetirementReal = new Map<string, number>();

  let cursor = asOf;
  let guard = 0;
  const shocks = opts?.shocks;
  let shockYear = Number.NaN;
  let shockZ = 0;
  const irsYtd = new Map<string, number>();
  const linkedLiabilityIds = new Set(
    plan.spending.map((phase) => phase.liabilityId).filter((id): id is string => Boolean(id)),
  );
  while (!isBefore(endDate, cursor) && guard < 1200) {
    guard += 1;
    const monthsFromAsOf = months.length;
    const inflationIndex = (1 + mInf) ** monthsFromAsOf;
    const auditStart = audit ? new Map(values) : null;
    const auditBasisStart = audit ? new Map(basis) : null;
    const auditBasisAdded = audit ? new Map<string, number>() : null;
    const auditAnnuityGain = audit ? new Map<string, number>() : null;
    const auditAnnuityBasisOut = audit ? new Map<string, number>() : null;

    for (const p of plan.portfolios) {
      const stated = (p.returnPct ?? plan.assumptions.defaultReturnPct) / 100;
      let annual = stated;
      if (shocks && p.kind !== "real_estate" && stated > 0) {
        const year = cursor.getFullYear();
        if (year !== shockYear) {
          shockYear = year;
          const z = shocks.zForYear(year);
          shockZ = Number.isFinite(z) ? z : 0;
        }
        annual = applyShock(stated, shockZ, shocks.stdev);
      }
      const mRet = yearlyRateToMonthly(annual);
      values.set(p.id, (values.get(p.id) ?? 0) * (1 + mRet));
    }

    const auditFlow = audit
      ? new Map(
          plan.portfolios.map((p) => {
            const start = auditStart?.get(p.id) ?? 0;
            const now = values.get(p.id) ?? 0;
            return [
              p.id,
              { growth: now - start, contribution: 0, match: 0, withdrawal: 0, sweep: 0 },
            ] as const;
          }),
        )
      : null;

    const incomeByKind: Record<string, number> = {};
    let income = 0;
    let taxableBase = 0;
    let ordinaryTaxable = 0;
    let ssBenefit = 0;
    let ssTaxable = 0;
    let guaranteed = 0;

    for (const stream of plan.incomes) {
      const win = streamWindow(plan, stream);
      if (!inRange(cursor, win.start, win.end)) continue;
      const todayAmt = streamBenefitToday(plan, stream, cursor);
      const colaAnnual = streamColaAnnual(plan, stream, infA);
      const nominal = todayAmt * (1 + colaAnnual) ** calendarColaYears(asOf, cursor);
      income += nominal;
      incomeByKind[stream.kind] = (incomeByKind[stream.kind] ?? 0) + nominal;
      if (stream.taxTreatment === "ordinary") {
        taxableBase += nominal;
        ordinaryTaxable += nominal;
      }
      if (stream.taxTreatment === "ss") {
        const taxed = nominal * ssTaxShare;
        taxableBase += taxed;
        ssBenefit += nominal;
        ssTaxable += taxed;
      }
      if (isGuaranteedKind(stream.kind)) {
        guaranteed += nominal;
      }
    }

    const spendingLines: { id: string; label: string; amount: number }[] = [];
    let spending = 0;
    for (const phase of plan.spending) {
      const win = spendingWindow(plan, phase);
      if (!inRange(cursor, win.start, win.end)) continue;
      const amount = phase.liabilityId
        ? phase.monthlyAmount
        : inflate(phase.monthlyAmount, mInf, monthsFromAsOf);
      spending += amount;
      if (amount > 0.005) {
        spendingLines.push({
          id: phase.id,
          label: phase.label.trim() || "Spending",
          amount,
        });
      }
    }
    for (const p of plan.portfolios) {
      if (p.kind !== "real_estate") continue;
      const duePay = mortgagePaymentDue(p.mortgage, cursor);
      spending += duePay;
      if (duePay > 0.005) {
        spendingLines.push({
          id: `${p.id}:mortgage`,
          label: `${p.name.trim() || "Real estate"} mortgage`,
          amount: duePay,
        });
      }
    }
    for (const l of plan.liabilities ?? []) {
      if (l.id && linkedLiabilityIds.has(l.id)) continue;
      const duePay = liabilityPaymentDue(l, cursor);
      spending += duePay;
      if (duePay > 0.005) {
        spendingLines.push({
          id: l.id,
          label: l.name.trim() || "Liability",
          amount: duePay,
        });
      }
    }

    const due: {
      portfolioId: string;
      amount: number;
      matchPct: number;
      ruleId: string;
      irs: { key: string; limit: number } | null;
    }[] = [];
    const contribDrafts: {
      ruleId: string;
      accountId: string;
      mode: string;
      incomeBase: number | null;
      planned: number;
      irsLimit: number | null;
      catchUp: boolean;
      capped: number;
      matchPct: number;
    }[] = [];
    let planned = 0;
    let irsCut = 0;
    for (const rule of plan.contributions) {
      const amount = contributionDueThisMonth(plan, rule, cursor, monthsFromAsOf, infA);
      if (amount <= 0) continue;
      if (!values.has(rule.portfolioId)) continue;
      const dest = plan.portfolios.find((p) => p.id === rule.portfolioId);
      const cls = dest ? irsLimitClass(dest.kind) : null;
      const person = dest ? irsCapPerson(plan, dest, rule) : null;
      const asked = amount;
      let capUsed: number | null = null;
      let catchUp = false;
      let irs: { key: string; limit: number } | null = null;
      if (rule.capToIrsLimit && dest && cls) {
        if (!person && cls !== "trump") {
          capUsed = 0;
          catchUp = false;
          irs = {
            key: `${cursor.getFullYear()}|unassigned|${rule.portfolioId}|${cls}`,
            limit: 0,
          };
        } else {
          const birth =
            person === "spouse"
              ? plan.spouse.birthDate
              : person === "primary"
                ? plan.primary.birthDate
                : "";
          const age = validIso(birth) ? ageInCalendarYear(birth, cursor.getFullYear()) : 0;
          const cap = irsAnnualCap(dest.kind, age) ?? 0;
          capUsed = cap;
          catchUp = cls !== "trump" && age >= 50;
          const ytdKey =
            cls === "trump"
              ? `${cursor.getFullYear()}|${rule.portfolioId}|trump`
              : `${cursor.getFullYear()}|${person}|${cls}`;
          irs = { key: ytdKey, limit: cap };
        }
      }
      const matchPct =
        rule.employerMatch && dest && isWorkplaceMatchAccount(dest.kind)
          ? Math.max(0, Math.min(100, rule.employerMatchPct ?? 0))
          : 0;
      if (audit) {
        let incomeBase: number | null = null;
        if (rule.amountMode === "percent" && rule.percentOfIncomeId) {
          const stream = plan.incomes.find((s) => s.id === rule.percentOfIncomeId);
          incomeBase = stream
            ? streamNominalAt(plan, stream, cursor, monthsFromAsOf, infA)
            : 0;
        }
        contribDrafts.push({
          ruleId: rule.id,
          accountId: rule.portfolioId,
          mode: rule.amountMode === "percent" ? "percent" : "fixed",
          incomeBase,
          planned: asked,
          irsLimit: capUsed,
          catchUp,
          capped: asked,
          matchPct,
        });
      }
      if (asked <= 0) continue;
      due.push({ portfolioId: rule.portfolioId, amount: asked, matchPct, ruleId: rule.id, irs });
    }
    const fundingDue = fundQualifiedFirst(plan, due);
    const contribIds = new Set(fundingDue.map((d) => d.portfolioId));
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
      if (audit && rmdClass(p) !== "none") {
        const birth = ownerBirth(plan, p);
        const startAge = rmdStartAge(birth);
        const age = ageInCalendarYear(birth, cursor.getFullYear());
        const deferred = rmdClass(p) === "workplace" && salaryOn && contributing;
        if (startAge != null && age >= startAge && (deferred || dueNow)) {
          const monthly = monthlyRmd(priorYearEnd.get(p.id) ?? 0, age);
          if (deferred || monthly > 0.5) {
            audit.rmds.push({
              date: iso(cursor),
              accountId: p.id,
              ownerAge: age,
              startAge,
              factor: uniformLifetimeFactor(age),
              priorYearEnd: priorYearEnd.get(p.id) ?? 0,
              monthlyRmd: monthly,
              status: deferred ? "deferred" : "taken",
            });
          }
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
      const y = cursor.getFullYear();
      let byYear = rmdYearTotals.get(p.id);
      if (!byYear) {
        byYear = new Map();
        rmdYearTotals.set(p.id, byYear);
      }
      byYear.set(y, (byYear.get(y) ?? 0) + take);
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
    let employerMatch = 0;
    const drawnLines: { id: string; label: string; amount: number }[] = [];
    for (const t of rmdTakes) {
      const v = values.get(t.id) ?? 0;
      const take = Math.min(v, t.amount);
      values.set(t.id, v - take);
      withdrawals += take;
      const rmdFlow = auditFlow?.get(t.id);
      if (rmdFlow) rmdFlow.withdrawal += take;
      if (take > 0.005) {
        const dest = plan.portfolios.find((row) => row.id === t.id);
        drawnLines.push({
          id: `${t.id}:rmd`,
          label: `RMD from ${dest?.name.trim() || "account"}`,
          amount: take,
        });
      }
    }

    const fundedAudit: { ruleId: string; amount: number; matchApplied: number }[] = [];
    const eligibleByRule = new Map<string, number>();
    const savedLines: { id: string; label: string; amount: number }[] = [];
    const matchLines: { id: string; label: string; amount: number }[] = [];
    let sweepLine: { id: string; label: string; amount: number } | null = null;
    let unallocatedSpent = 0;
    if (leftover > 0.5) {
      let pool = leftover;
      const funded: {
        portfolioId: string;
        amount: number;
        matchPct: number;
        ruleId: string;
      }[] = [];
      for (const d of fundingDue) {
        let intended = d.amount;
        if (d.irs) {
          const used = irsYtd.get(d.irs.key) ?? 0;
          const room = Math.max(0, d.irs.limit - used);
          const afterCap = Math.min(intended, room);
          if (intended - afterCap > 0.5) irsCut += intended - afterCap;
          intended = afterCap;
        }
        planned += intended;
        eligibleByRule.set(d.ruleId, intended);
        if (intended <= 0 || pool <= 0.5) continue;
        const take = Math.min(intended, pool);
        values.set(d.portfolioId, (values.get(d.portfolioId) ?? 0) + take);
        if (basis.has(d.portfolioId)) {
          basis.set(d.portfolioId, (basis.get(d.portfolioId) ?? 0) + take);
          if (auditBasisAdded) {
            auditBasisAdded.set(
              d.portfolioId,
              (auditBasisAdded.get(d.portfolioId) ?? 0) + take,
            );
          }
        }
        pool -= take;
        appliedContrib += take;
        if (d.irs && take > 0) {
          irsYtd.set(d.irs.key, (irsYtd.get(d.irs.key) ?? 0) + take);
        }
        const contribFlow = auditFlow?.get(d.portfolioId);
        if (contribFlow) contribFlow.contribution += take;
        const rule = plan.contributions.find((row) => row.id === d.ruleId);
        const dest = plan.portfolios.find((row) => row.id === d.portfolioId);
        const ruleName = rule?.label.trim() || "Contribution";
        const account = dest?.name.trim() || "";
        savedLines.push({
          id: d.ruleId,
          label:
            account && account !== ruleName ? `${ruleName} into ${account}` : ruleName || account,
          amount: take,
        });
        funded.push({
          portfolioId: d.portfolioId,
          amount: take,
          matchPct: d.matchPct,
          ruleId: d.ruleId,
        });
        fundedAudit.push({ ruleId: d.ruleId, amount: take, matchApplied: 0 });
      }
      const sweepId = plan.assumptions.sweepPortfolioId;
      if (pool > 0.5 && sweepId && values.has(sweepId)) {
        values.set(sweepId, (values.get(sweepId) ?? 0) + pool);
        if (basis.has(sweepId)) {
          basis.set(sweepId, (basis.get(sweepId) ?? 0) + pool);
          if (auditBasisAdded) {
            auditBasisAdded.set(sweepId, (auditBasisAdded.get(sweepId) ?? 0) + pool);
          }
        }
        appliedContrib += pool;
        const sweepFlow = auditFlow?.get(sweepId);
        if (sweepFlow) sweepFlow.sweep += pool;
        const dest = plan.portfolios.find((row) => row.id === sweepId);
        sweepLine = {
          id: sweepId,
          label: `Sweep into ${dest?.name.trim() || "account"}`,
          amount: pool,
        };
      } else if (pool > 0.5) {
        spending += pool;
        unallocatedSpent = pool;
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
        employerMatch += match;
        const matchFlow = auditFlow?.get(f.portfolioId);
        if (matchFlow) matchFlow.match += match;
        const dest = plan.portfolios.find((row) => row.id === f.portfolioId);
        matchLines.push({
          id: `${f.ruleId}:match`,
          label: `${dest?.name.trim() || "Account"} employer match`,
          amount: match,
        });
        const logged = fundedAudit.find(
          (row) => row.ruleId === f.ruleId && row.matchApplied === 0,
        );
        if (logged) logged.matchApplied = match;
      }
    } else {
      const shadow = new Map(irsYtd);
      for (const d of fundingDue) {
        let intended = d.amount;
        if (d.irs) {
          const used = shadow.get(d.irs.key) ?? 0;
          const room = Math.max(0, d.irs.limit - used);
          const afterCap = Math.min(intended, room);
          if (intended - afterCap > 0.5) irsCut += intended - afterCap;
          intended = afterCap;
          if (intended > 0) shadow.set(d.irs.key, used + intended);
        }
        planned += intended;
        eligibleByRule.set(d.ruleId, intended);
      }
      if (leftover < -0.5) {
      const withdrawLog: { id: string; amount: number; taxableGain: number; basisReturn: number }[] =
        [];
      withdrawals += withdrawNeed(plan, values, basis, -leftover, taxR, withdrawLog);
      let gain = 0;
      for (const w of withdrawLog) {
        const dest = plan.portfolios.find((row) => row.id === w.id);
        const name = dest?.name.trim() || "Account";
        const note =
          dest?.taxBucket === "pre_tax"
            ? " (pre-tax)"
            : dest && isNonQualifiedAnnuity(dest)
              ? " (annuity)"
              : "";
        drawnLines.push({ id: w.id, label: `${name}${note}`, amount: w.amount });
        if (audit) {
          const flowed = auditFlow?.get(w.id);
          if (flowed) flowed.withdrawal += w.amount;
          if (w.taxableGain) {
            auditAnnuityGain?.set(w.id, (auditAnnuityGain.get(w.id) ?? 0) + w.taxableGain);
            gain += w.taxableGain;
          }
          if (w.basisReturn) {
            auditAnnuityBasisOut?.set(
              w.id,
              (auditAnnuityBasisOut.get(w.id) ?? 0) + w.basisReturn,
            );
          }
        }
      }
      if (audit && gain) audit.annuityEarningsByDate[iso(cursor)] = gain;
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
    }

    const byBucket = emptyBuckets();
    let spendableEnd = 0;
    let netWorthEnd = 0;
    let assetsEnd = 0;
    let liabilitiesEnd = 0;
    const spendableLines: { id: string; label: string; amount: number }[] = [];
    for (const p of plan.portfolios) {
      const v = values.get(p.id) ?? 0;
      byBucket[p.taxBucket] += v;
      if (p.includeInNetWorth) {
        const debt = p.kind === "real_estate" ? remainingMortgage(p.mortgage, cursor) : 0;
        assetsEnd += v;
        liabilitiesEnd += debt;
        netWorthEnd += v - debt;
      }
      if (p.spendable) {
        spendableEnd += v;
        spendableLines.push({
          id: p.id,
          label: p.name.trim() || "Account",
          amount: v,
        });
      }
    }
    for (const l of plan.liabilities ?? []) {
      const debt = remainingLiability(l, cursor);
      liabilitiesEnd += debt;
      netWorthEnd -= debt;
    }

    totalContributed += appliedContrib;
    totalWithdrawn += withdrawals;

    if (audit && auditStart && auditFlow) {
      const date = iso(cursor);
      for (const p of plan.portfolios) {
        const start = auditStart.get(p.id) ?? 0;
        const end = values.get(p.id) ?? 0;
        const flow = auditFlow.get(p.id) ?? {
          growth: 0,
          contribution: 0,
          match: 0,
          withdrawal: 0,
          sweep: 0,
        };
        const expected =
          start + flow.growth + flow.contribution + flow.match + flow.sweep - flow.withdrawal;
        audit.accounts.push({
          date,
          accountId: p.id,
          accountName: p.name,
          start,
          annualReturnPct: p.returnPct ?? plan.assumptions.defaultReturnPct,
          growth: flow.growth,
          contribution: flow.contribution,
          match: flow.match,
          withdrawal: flow.withdrawal,
          sweep: flow.sweep,
          end,
          residual: end - expected,
          spendable: p.spendable,
          includeInNetWorth: p.includeInNetWorth,
        });
        if (isNonQualifiedAnnuity(p)) {
          audit.annuities.push({
            date,
            accountId: p.id,
            basisStart: auditBasisStart?.get(p.id) ?? 0,
            basisAdded: auditBasisAdded?.get(p.id) ?? 0,
            taxableEarnings: auditAnnuityGain?.get(p.id) ?? 0,
            basisReturned: auditAnnuityBasisOut?.get(p.id) ?? 0,
            basisEnd: basis.get(p.id) ?? 0,
          });
        }
      }
      const invested = new Map<string, { invested: number; match: number }>();
      for (const row of fundedAudit) {
        const got = invested.get(row.ruleId) ?? { invested: 0, match: 0 };
        got.invested += row.amount;
        got.match += row.matchApplied;
        invested.set(row.ruleId, got);
      }
      for (const draft of contribDrafts) {
        const got = invested.get(draft.ruleId) ?? { invested: 0, match: 0 };
        audit.contributions.push({
          date,
          ruleId: draft.ruleId,
          accountId: draft.accountId,
          mode: draft.mode,
          incomeBase: draft.incomeBase,
          planned: draft.planned,
          eligible: eligibleByRule.get(draft.ruleId) ?? draft.planned,
          irsLimit: draft.irsLimit,
          catchUp: draft.catchUp,
          invested: got.invested,
          match: got.match,
        });
      }
    }

    if (goalKey && goalKey > asOfKey && iso(cursor).slice(0, 7) < goalKey) {
      atRetirement = new Map(values);
      const index = (1 + mInf) ** (monthsFromAsOf + 1);
      atRetirementReal = new Map(
        [...values].map(([id, v]) => [id, v / Math.max(index, 1e-9)]),
      );
    }

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
      irsCut,
      employerMatch,
      withdrawals,
      income,
      incomeTaxable: taxableBase,
      tax,
      spending,
      surplus: leftover,
      guaranteed,
      incomeByKind,
      byBucket,
      detail: {
        ordinaryTaxable,
        ssBenefit,
        ssTaxable,
        rmdTaxable: rmd,
        taxRatePct: plan.assumptions.ordinaryTaxRatePct,
        spendingLines,
        unallocatedSpent,
        savedLines,
        sweep: sweepLine,
        matchLines,
        drawnLines,
        spendableLines,
      },
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
    const goalKey = plan.assumptions.retirementGoalDate?.slice(0, 7) ?? "";
    const airMonths = goalKey
      ? arr.filter((m) => m.date.slice(0, 7) >= goalKey)
      : [];
    const airByKind: Record<string, number> = {};
    let airGuaranteed = 0;
    let airWithdrawals = 0;
    for (const m of airMonths) {
      airGuaranteed += m.guaranteed;
      airWithdrawals += m.withdrawals;
      for (const kind of ["military", "va", "ss", "pension", "other_retirement"]) {
        const v = m.incomeByKind[kind] ?? 0;
        if (v) airByKind[kind] = (airByKind[kind] ?? 0) + v;
      }
    }
    const airPublished = airMonths.length > 0;
    const savedLines = savedBreakdown(arr);
    const spendableBalances = (last.detail?.spendableLines ?? []).map((line) => ({
      id: line.id,
      amount: line.amount,
    }));
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
      irsCut: sum((m) => m.irsCut),
      employerMatch: sum((m) => m.employerMatch),
      withdrawals: sum((m) => m.withdrawals),
      income: sum((m) => m.income),
      tax: sum((m) => m.tax),
      spending: sum((m) => m.spending),
      surplus: sum((m) => m.surplus),
      guaranteed: sum((m) => m.guaranteed),
      air: airPublished ? airGuaranteed + airWithdrawals : null,
      airWithdrawals: airPublished ? airWithdrawals : 0,
      airByKind: airPublished ? airByKind : {},
      incomeByKind,
      savedLines,
      drawnLines: drawnBreakdown(arr),
      spendableBalances,
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

  const yearCaps: YearCap[] = [];
  for (const y of years) {
    const leftover = Math.max(0, y.surplus);
    const funded = Math.min(y.plannedContributions, leftover);
    const base = {
      year: y.year,
      planned: y.plannedContributions,
      leftover,
      funded,
      irsCut: y.irsCut,
      employerMatch: y.employerMatch,
    };
    if (y.plannedContributions > leftover + 1) {
      yearCaps.push({ ...base, kind: "cash" });
    }
    if (y.irsCut > 1) {
      yearCaps.push({ ...base, kind: "irs" });
    }
    if (y.employerMatch > 0.5) {
      yearCaps.push({ ...base, kind: "match" });
    }
  }

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
    const fullAir = years.find((y) => {
      const arr = byYear.get(y.year) ?? [];
      return (
        y.air != null &&
        arr.length === 12 &&
        arr.every((row) => row.date.slice(0, 7) >= goalKey)
      );
    });
    const airYear = fullAir ?? years.find((y) => y.air != null);
    const annualIncome = airYear?.air ?? 0;
    const infl = plan.assumptions.inflationPct / 100;
    const yearsOut = Math.max(0, (airYear?.year ?? asOf.getFullYear()) - asOf.getFullYear());
    const annualIncomeReal = annualIncome / (1 + infl) ** yearsOut;
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
      incomeYear: airYear?.year ?? null,
      monthlySpending: m.spending,
    };
  }

  return {
    months,
    years,
    stageMarks,
    fundingGaps,
    yearCaps,
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
    balancesAtRetirement: plan.portfolios.map((p) => ({
      id: p.id,
      nominal: atRetirement.get(p.id) ?? p.currentValue,
      real: atRetirementReal.get(p.id) ?? p.currentValue,
    })),
    rmd: {
      startAge: rmdStartAge(plan.primary.birthDate),
      lifetimeRothExempt: rmdNote.lifetimeRothExempt,
      stillWorkingDeferred: rmdNote.stillWorkingDeferred,
      forced: rmdNote.forced,
      firstYearAnnual: rmdNote.firstYearAnnual,
      total: rmdNote.total,
      accounts: buildRmdAccountRows(plan, rmdNote, rmdYearTotals),
    },
    ...(audit ? { audit } : {}),
  };
}

function buildRmdAccountRows(
  plan: Plan,
  rmdNote: {
    lifetimeRothExempt: string[];
    stillWorkingDeferred: string[];
    forced: string[];
  },
  rmdYearTotals: Map<string, Map<number, number>>,
): RmdAccountRow[] {
  const you = plan.primary.name.trim() || "You";
  const spouse = plan.spouse.name.trim() || "Spouse";
  const rows: RmdAccountRow[] = [];
  for (const p of plan.portfolios) {
    const klass = rmdClass(p);
    const roth =
      klass === "none" &&
      (p.taxBucket === "roth" || p.kind.includes("roth"));
    if (klass === "none" && !roth) continue;
    const label = p.name.trim() || p.kind;
    const birth = ownerBirth(plan, p);
    const startAge = rmdStartAge(birth);
    const startYear =
      validIso(birth) && startAge != null
        ? Number(birth.slice(0, 4)) + startAge
        : null;
    const years = rmdYearTotals.get(p.id);
    let firstYear: number | null = null;
    let firstYearAnnual = 0;
    if (years && years.size) {
      firstYear = [...years.keys()].sort((a, b) => a - b)[0] ?? null;
      firstYearAnnual = firstYear != null ? (years.get(firstYear) ?? 0) : 0;
    }
    let status: RmdAccountRow["status"];
    if (klass === "none") status = "none";
    else if (firstYearAnnual > 0.5) status = "forced";
    else if (rmdNote.stillWorkingDeferred.includes(label)) status = "deferred";
    else status = "future";
    rows.push({
      name: label,
      owner: /spouse/i.test(p.owner) ? spouse : you,
      status,
      startAge,
      startYear,
      firstYear,
      firstYearAnnual,
      institutionId: p.institutionId ?? null,
      institutionName: p.institutionName ?? "",
    });
  }
  return rows;
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