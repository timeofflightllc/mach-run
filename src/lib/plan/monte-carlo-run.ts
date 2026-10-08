import { addYears } from "date-fns";
import { dateAtAge, monthStart, validIso } from "./dates.ts";
import { simulate, type ReturnShocks } from "./engine.ts";
import {
  DEFAULT_SWING,
  SWING_PRESETS,
  createStandardNormal,
  type SwingName,
} from "./monte-carlo.ts";
import type {
  Assumptions,
  ContributionRule,
  IncomeStream,
  Liability,
  Mortgage,
  Plan,
  Portfolio,
  SpendingPhase,
} from "./types.ts";

/** One thousand paths. The screen still says "of 100." */
const PATHS = 1000;
const YIELD_EVERY = 25;

export type SurvivalScore = {
  score: number;
  survived: number;
  paths: typeof PATHS;
  swing: SwingName;
  hash: string;
  /** Middle age among futures that run out. Null when every future still has money. */
  runOutAge: number | null;
};

type PathResult = { depletedAge: number | null };

export type SurvivalOptions = {
  signal?: AbortSignal;
  onProgress?: (done: number, paths: number) => void;
  /** Test seam. Production callers omit this and the engine runs the path. */
  runOne?: (plan: Plan, shocks: ReturnShocks) => PathResult;
};

export function survivalPercent(survived: number, paths: number): number {
  if (!(paths > 0)) return 0;
  return Math.round((survived / paths) * 100);
}

export function survivalSentence(score: number, longevityAge: number): string {
  return `In ${score} of 100 futures like this one, your money lasts through your longevity age (${longevityAge}).`;
}

/** Count of paths that ran out, and the middle age of that group. Not the mean. */
export function runOutSentence(
  score: Pick<SurvivalScore, "survived" | "paths" | "runOutAge">,
  longevityAge: number,
): string | null {
  if (score.runOutAge == null) return null;
  const failed = score.paths - score.survived;
  if (failed <= 0) return null;
  const total = score.paths.toLocaleString("en-US");
  if (failed === 1) {
    return `In the 1 of ${total} random futures that did run out of money prior to longevity age, it runs out at age ${score.runOutAge}.`;
  }
  const n = failed.toLocaleString("en-US");
  return `In the ${n} of ${total} random futures that did run out of money prior to longevity age, the middle one runs out at age ${score.runOutAge}.`;
}

/** Earlier of the two middle ages when the count is even. Whole years only. */
export function middleRunOutAge(ages: number[]): number | null {
  const usable = ages.filter((age) => Number.isFinite(age));
  if (usable.length === 0) return null;
  const sorted = usable.slice().sort((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) / 2);
  return Math.round(sorted[index]);
}

export function economicHash(plan: Plan, swing: string): string {
  return fnv1a(JSON.stringify(canonical({ ...economicSnapshot(plan), swing })));
}

export function runSurvival(
  plan: Plan,
  swing: string = DEFAULT_SWING,
  opts?: SurvivalOptions,
): Promise<SurvivalScore | null> {
  const picked = resolveSwing(swing);
  if (!picked) return Promise.resolve(null);
  let copy: Plan;
  try {
    copy = structuredClone(plan);
  } catch {
    return Promise.resolve(null);
  }
  const hash = economicHash(copy, picked);
  return execute(copy, picked, hash, opts).catch(() => null);
}

function resolveSwing(swing: string): SwingName | null {
  if (swing === "calm" || swing === "typical" || swing === "rough") return swing;
  return null;
}

async function execute(
  plan: Plan,
  swing: SwingName,
  hash: string,
  opts: SurvivalOptions | undefined,
): Promise<SurvivalScore | null> {
  if (opts?.signal?.aborted) return null;
  const runOne = opts?.runOne ?? defaultRun;
  const years = calendarYears(plan);
  const stdev = SWING_PRESETS[swing];
  let survived = 0;
  const runOutAges: number[] = [];
  for (let path = 0; path < PATHS; path++) {
    if (opts?.signal?.aborted) return null;
    const draw = createStandardNormal(mixSeed(hash, path));
    const zByYear = new Map<number, number>();
    for (const year of years) zByYear.set(year, draw());
    const shocks: ReturnShocks = {
      stdev,
      zForYear: (year) => zByYear.get(year) ?? 0,
    };
    let depleted: number | null;
    try {
      depleted = runOne(plan, shocks).depletedAge;
    } catch {
      return null;
    }
    if (depleted == null) survived += 1;
    else runOutAges.push(depleted);
    const done = path + 1;
    if (done % YIELD_EVERY === 0) {
      opts?.onProgress?.(done, PATHS);
      await paint();
      if (opts?.signal?.aborted) return null;
    }
  }
  return {
    score: survivalPercent(survived, PATHS),
    survived,
    paths: PATHS,
    swing,
    hash,
    runOutAge: middleRunOutAge(runOutAges),
  };
}

function defaultRun(plan: Plan, shocks: ReturnShocks): PathResult {
  return simulate(plan, { shocks });
}

function calendarYears(plan: Plan): number[] {
  const asOf = monthStart(plan.assumptions.asOfDate);
  const end = validIso(plan.primary.birthDate)
    ? dateAtAge(plan.primary.birthDate, plan.assumptions.projectionEndAge)
    : addYears(asOf, 40);
  const startYear = asOf.getFullYear();
  const endYear = end.getFullYear();
  const years: number[] = [];
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return years;
  for (let year = startYear; year <= endYear; year++) years.push(year);
  return years;
}

function mixSeed(hash: string, pathIndex: number): number {
  let h = Number.parseInt(hash, 16) >>> 0;
  h = Math.imul(h ^ (pathIndex + 0x9e3779b9), 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

function paint(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function economicSnapshot(plan: Plan) {
  const assumptions = plan.assumptions;
  return {
    spouseNamePresent: Boolean(plan.spouse?.name?.trim()),
    primaryBirthDate: plan.primary?.birthDate ?? "",
    spouseBirthDate: plan.spouse?.birthDate ?? "",
    children: (plan.children ?? []).map((child) => ({
      id: child.id,
      birthDate: child.birthDate,
    })),
    assumptions: assumptionFields(assumptions),
    stages: (plan.stages ?? []).map((stage) => ({
      id: stage.id,
      startDate: stage.startDate,
      endDate: stage.endDate,
    })),
    portfolios: (plan.portfolios ?? []).map(portfolioFields),
    liabilities: (plan.liabilities ?? []).map(liabilityFields),
    contributions: (plan.contributions ?? []).map(contributionFields),
    incomes: (plan.incomes ?? []).map(incomeFields),
    spending: (plan.spending ?? []).map(spendingFields),
  };
}

function assumptionFields(assumptions: Assumptions) {
  return {
    asOfDate: assumptions.asOfDate,
    inflationPct: assumptions.inflationPct,
    defaultColaPct: assumptions.defaultColaPct,
    defaultReturnPct: assumptions.defaultReturnPct,
    ordinaryTaxRatePct: assumptions.ordinaryTaxRatePct,
    ssTaxablePct: assumptions.ssTaxablePct,
    projectionEndAge: assumptions.projectionEndAge,
    careerEndDate: assumptions.careerEndDate,
    sweepPortfolioId: assumptions.sweepPortfolioId,
    retirementGoalDate: assumptions.retirementGoalDate,
    nestEggGoal: assumptions.nestEggGoal,
  };
}

function portfolioFields(portfolio: Portfolio) {
  return {
    id: portfolio.id,
    kind: portfolio.kind,
    owner: portfolio.owner,
    currentValue: portfolio.currentValue,
    returnPct: portfolio.returnPct,
    taxBucket: portfolio.taxBucket,
    spendable: portfolio.spendable,
    includeInNetWorth: portfolio.includeInNetWorth,
    costBasis: portfolio.costBasis ?? null,
    mortgage: portfolio.mortgage ? mortgageFields(portfolio.mortgage) : null,
  };
}

function mortgageFields(mortgage: Mortgage) {
  return {
    originationDate: mortgage.originationDate,
    aprPct: mortgage.aprPct,
    monthlyPi: mortgage.monthlyPi,
    termYears: mortgage.termYears,
    includeInSpending: mortgage.includeInSpending,
    associated: mortgage.associated ?? false,
  };
}

function liabilityFields(liability: Liability) {
  return {
    id: liability.id,
    kind: liability.kind,
    balance: liability.balance,
    aprPct: liability.aprPct,
    monthlyPi: liability.monthlyPi,
    originationDate: liability.originationDate,
    termYears: liability.termYears,
    includeInSpending: liability.includeInSpending,
    owner: liability.owner,
  };
}

function contributionFields(rule: ContributionRule) {
  return {
    id: rule.id,
    portfolioId: rule.portfolioId,
    monthlyAmount: rule.monthlyAmount,
    startDate: rule.startDate,
    endDate: rule.endDate,
    endWithStageId: rule.endWithStageId ?? null,
    amountMode: rule.amountMode ?? "fixed",
    percentOfIncome: rule.percentOfIncome ?? null,
    percentOfIncomeId: rule.percentOfIncomeId ?? null,
    employerMatch: Boolean(rule.employerMatch),
    employerMatchPct: rule.employerMatchPct ?? null,
    capToIrsLimit: Boolean(rule.capToIrsLimit),
    capPerson: rule.capPerson ?? null,
    endAtRetirement: Boolean(rule.endAtRetirement),
    stopDate: rule.stopDate ?? null,
  };
}

function incomeFields(stream: IncomeStream) {
  return {
    id: stream.id,
    kind: stream.kind,
    monthlyAmount: stream.monthlyAmount,
    payCadence: stream.payCadence ?? null,
    payAmount: stream.payAmount ?? null,
    startDate: stream.startDate,
    endDate: stream.endDate,
    colaPct: stream.colaPct,
    taxTreatment: stream.taxTreatment,
    person: stream.person,
    tiedToStageId: stream.tiedToStageId ?? null,
    tiedToCareer: Boolean(stream.tiedToCareer),
    endMonthsBeforeStage: stream.endMonthsBeforeStage ?? null,
    endMonthsBeforeCareer: stream.endMonthsBeforeCareer ?? null,
    ssPia: stream.ssPia ?? null,
    ssClaimAge: stream.ssClaimAge ?? null,
    ssFra: stream.ssFra ?? null,
    ssBirthDate: stream.ssBirthDate ?? null,
    vaChildAware: Boolean(stream.vaChildAware),
    vaRatingPct: stream.vaRatingPct ?? null,
    vaSpouseDependent: stream.vaSpouseDependent ?? null,
    startDayAfterPrevious: Boolean(stream.startDayAfterPrevious),
  };
}

function spendingFields(phase: SpendingPhase) {
  return {
    id: phase.id,
    monthlyAmount: phase.monthlyAmount,
    startDate: phase.startDate,
    endDate: phase.endDate,
    tiedToStageId: phase.tiedToStageId ?? null,
    startDayAfterPrevious: Boolean(phase.startDayAfterPrevious),
    liabilityId: phase.liabilityId ?? null,
  };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
