import { monthBefore, todayIso } from "./dates.ts";
import { clonePlan, createDefaultPlan, ensurePlan } from "./defaults.ts";
import { sustainableRetirementIncome, nestEggForMonthlyWithdrawal } from "./sustainable-income.ts";
import { vaSchedularPay } from "./va.ts";
import type { AccountKind, Plan, TaxBucket, TaxTreatment } from "./types.ts";

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const HOLD_KEY = "mach-quiz-hold";
const HOLD_PLAN_KEY = "mach-quiz-plan";
const OPEN_KEY = "mach-quiz-open";

export type QuizKindId = "tsp" | "ira" | "roth_ira" | "401k" | "taxable" | "cash";
export type QuizPayId = "none" | "military" | "va" | "pension";
export type QuizPayKind = Exclude<QuizPayId, "none">;
export type QuizPays = Record<QuizPayKind, number>;

export const QUIZ_KINDS: { id: QuizKindId; label: string; kind: AccountKind; bucket: TaxBucket }[] = [
  { id: "tsp", label: "TSP", kind: "tsp", bucket: "pre_tax" },
  { id: "ira", label: "Traditional IRA", kind: "ira", bucket: "pre_tax" },
  { id: "roth_ira", label: "Roth IRA", kind: "roth_ira", bucket: "roth" },
  { id: "401k", label: "401(k)", kind: "401k", bucket: "pre_tax" },
  { id: "taxable", label: "Taxable", kind: "taxable", bucket: "taxable" },
  { id: "cash", label: "Cash", kind: "cash", bucket: "taxable" },
];

export type QuizAnswers = {
  firstName?: string;
  monthlyNeed: number;
  retireAge: number;
  birthYear: number;
  accountName: string;
  kind: QuizKindId;
  balance: number;
  monthlySave: number;
  pay: QuizPayId;
  payMonthly: number;
  /** Set when more than one paycheck is on. Zero means that one is off. */
  pays?: QuizPays;
  /** "all" is every account in one traditional pile. Missing means one account. */
  scope?: "one" | "all";
  /** VA disability rating, 10–100. The dollar comes from the 2026 table. */
  vaRating?: number;
  /** Children under 18. */
  vaDependents?: number;
  /** Spouse on the VA award. Missing means no. */
  vaSpouse?: boolean;
};

const QUIZ_KIND_IDS = new Set<QuizKindId>(QUIZ_KINDS.map((row) => row.id));
const QUIZ_PAY_IDS = new Set<QuizPayId>(["none", "military", "va", "pension"]);

function quizNum(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Answers saved with a pending quiz signup. Rejects anything that is not that shape. */
export function parseQuizAnswers(raw: unknown): QuizAnswers | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const kind = String(row.kind ?? "");
  const pay = String(row.pay ?? "none");
  const pays = parsePays(row.pays);
  if (!QUIZ_KIND_IDS.has(kind as QuizKindId) || (!pays && !QUIZ_PAY_IDS.has(pay as QuizPayId))) return null;
  const first = String(row.firstName ?? "").trim().split(/\s+/)[0] ?? "";
  return {
    firstName: first.slice(0, 40),
    monthlyNeed: quizNum(row.monthlyNeed, 5000),
    retireAge: quizNum(row.retireAge, 55),
    birthYear: quizNum(row.birthYear, 1994),
    accountName: String(row.accountName ?? "").slice(0, 80),
    kind: kind as QuizKindId,
    balance: quizNum(row.balance, 0),
    monthlySave: quizNum(row.monthlySave, 0),
    pay: QUIZ_PAY_IDS.has(pay as QuizPayId) ? (pay as QuizPayId) : "none",
    payMonthly: quizNum(row.payMonthly, 0),
    pays,
    scope: row.scope === "all" ? "all" : "one",
    vaRating: quizNum(row.vaRating, 0),
    vaDependents: Math.max(0, Math.floor(quizNum(row.vaDependents, 0))),
    vaSpouse: row.vaSpouse === true,
  };
}

function parsePays(raw: unknown): QuizPays | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  return {
    military: Math.max(0, quizNum(row.military, 0)),
    va: Math.max(0, quizNum(row.va, 0)),
    pension: Math.max(0, quizNum(row.pension, 0)),
  };
}

const PAY_LABEL: Record<QuizPayKind, { name: string; tax: TaxTreatment; start: "now" | "retire" }> = {
  military: { name: "Military retirement", tax: "ordinary", start: "retire" },
  va: { name: "VA", tax: "tax_free", start: "now" },
  pension: { name: "Pension", tax: "ordinary", start: "retire" },
};

/** Every paycheck they turned on. Older snapshots had only one. */
export function selectedPays(answers: QuizAnswers): { id: QuizPayKind; monthly: number }[] {
  const fromList = answers.pays
    ? (["military", "va", "pension"] as const)
        .filter((id) => answers.pays![id] > 0)
        .map((id) => ({ id, monthly: answers.pays![id] }))
    : [];
  if (fromList.length > 0) return fromList;
  if (answers.pay !== "none" && answers.payMonthly > 0) {
    return [{ id: answers.pay, monthly: answers.payMonthly }];
  }
  return [];
}

export function emptyPays(): QuizPays {
  return { military: 0, va: 0, pension: 0 };
}

export function holdQuizPlan(plan?: Plan, mode: "replace" | "add" | "income" = "replace") {
  try {
    const flag = mode === "add" ? "add" : mode === "income" ? "income" : "1";
    sessionStorage.setItem(HOLD_KEY, flag);
    if (plan) sessionStorage.setItem(HOLD_PLAN_KEY, JSON.stringify(plan));
  } catch {
    /* private mode */
  }
}

/** A quiz sketch is waiting for this browser tab. */
export function quizPlanHeld(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const flag = sessionStorage.getItem(HOLD_KEY);
    return flag === "1" || flag === "add" || flag === "income";
  } catch {
    return false;
  }
}

export function armQuizOpen(place: "family" | "income" = "family") {
  try {
    sessionStorage.setItem(OPEN_KEY, place === "income" ? "income" : "1");
  } catch {
    /* private mode */
  }
}

export function quizOpenPending(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const flag = sessionStorage.getItem(OPEN_KEY);
    return flag === "1" || flag === "family" || flag === "income";
  } catch {
    return false;
  }
}

/** One shot. Family for the six questions. Income for the military check. */
export function takeQuizOpen(): "family" | "income" | null {
  if (!quizOpenPending()) return null;
  try {
    const flag = sessionStorage.getItem(OPEN_KEY);
    sessionStorage.removeItem(OPEN_KEY);
    if (flag !== "1" && flag !== "family" && flag !== "income") return null;
    return flag === "income" ? "income" : "family";
  } catch {
    return null;
  }
}

/** Read the quiz plan once, on the way into the calculator. Later edits stay. */
export function consumeHeldQuizPlan(): { plan: Plan; add: boolean; income: boolean } | null {
  if (!quizPlanHeld()) return null;
  try {
    const flag = sessionStorage.getItem(HOLD_KEY);
    const raw = sessionStorage.getItem(HOLD_PLAN_KEY);
    sessionStorage.removeItem(HOLD_KEY);
    sessionStorage.removeItem(HOLD_PLAN_KEY);
    if (!raw) return null;
    return { plan: ensurePlan(JSON.parse(raw) as Plan), add: flag === "add", income: flag === "income" };
  } catch {
    return null;
  }
}

/**
 * The quiz account joins the household they already have.
 * People, dates, other accounts, and existing income stay.
 * The monthly deposit comes with the account, because that is how the deposit is funded.
 */
export function appendQuizAccount(existing: Plan, sketch: Plan): Plan {
  const next = clonePlan(existing);
  const account = sketch.portfolios[0];
  if (!account) return next;
  const portfolioId = next.portfolios.some((row) => row.id === account.id) ? newId("port") : account.id;
  next.portfolios = [...next.portfolios, { ...account, id: portfolioId }];
  const added = sketch.contributions.filter((row) => row.portfolioId === account.id);
  if (added.length) {
    next.contributions = [
      ...next.contributions,
      ...added.map((row) => ({ ...row, id: newId("c"), portfolioId })),
    ];
  }
  const funding = sketch.incomes.filter((row) => row.kind === "other" && row.name === "Put in each month");
  if (funding.length) {
    next.incomes = [...next.incomes, ...funding.map((row) => ({ ...row, id: newId("inc") }))];
  }
  return next;
}

/** The military calculator's check, and nothing else. A new visitor opens this plan. */
export function militaryIncomePlan(input: { monthly: number; startDate: string; firstName?: string }): Plan {
  const plan = createDefaultPlan();
  const first = input.firstName?.trim().split(/\s+/)[0] ?? "";
  if (first) plan.primary = { name: first, birthDate: "" };
  plan.assumptions = {
    ...plan.assumptions,
    militaryRetireDate: input.startDate,
    retirementGoalDate: input.startDate,
  };
  plan.incomes = [
    {
      id: newId("inc"),
      name: "Military retirement",
      kind: "military",
      monthlyAmount: Math.max(0, Math.round(input.monthly)),
      startDate: input.startDate,
      endDate: null,
      colaPct: null,
      taxTreatment: "ordinary",
      person: "primary",
    },
  ];
  return plan;
}

/**
 * Adds that one paycheck to a household that already exists.
 * People, accounts, dates, spending, and the incomes already there stay.
 */
export function appendMilitaryIncome(existing: Plan, sketch: Plan): Plan {
  const next = clonePlan(existing);
  const added = sketch.incomes.filter((row) => row.kind === "military" && row.monthlyAmount > 0);
  if (!added.length) return next;
  next.incomes = [...next.incomes, ...added.map((row) => ({ ...row, id: newId("inc") }))];
  return next;
}

export function ageFloor(birthYear: number, today = new Date()): number {
  return Math.max(35, today.getFullYear() - birthYear);
}

export function retireYear(birthYear: number, retireAge: number): number {
  return birthYear + retireAge;
}

export function retireCaption(birthYear: number, retireAge: number, today = new Date()): string {
  const year = retireYear(birthYear, retireAge);
  if (year <= today.getFullYear()) return "That's this year.";
  return `That's ${year}.`;
}

/** January 1 of birth year + age. If that January has passed, the first of this month. */
export function retirementIso(birthYear: number, retireAge: number, today = new Date()): string {
  const year = retireYear(birthYear, retireAge);
  const jan = `${year}-01-01`;
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  return jan < thisMonth ? thisMonth : jan;
}

export function quizPlan(answers: QuizAnswers, today = new Date()): Plan {
  const plan = createDefaultPlan();
  const asOf = todayIso();
  const retire = retirementIso(answers.birthYear, answers.retireAge, today);
  const piled = answers.scope === "all";
  const kind = piled
    ? QUIZ_KINDS.find((row) => row.id === "taxable") ?? QUIZ_KINDS[0]
    : QUIZ_KINDS.find((row) => row.id === answers.kind) ?? QUIZ_KINDS[0];
  const accountId = newId("port");
  const name = piled ? "All accounts" : answers.accountName.trim() || kind.label;
  const first = answers.firstName?.trim().split(/\s+/)[0] ?? "";
  plan.primary = { name: first, birthDate: `${answers.birthYear}-01-01` };
  plan.assumptions = {
    ...plan.assumptions,
    asOfDate: asOf,
    dollars: "real",
    retirementGoalDate: retire,
    careerEndDate: retire,
    militaryRetireDate: selectedPays(answers).some((row) => row.id === "military")
      ? retire
      : plan.assumptions.militaryRetireDate,
  };
  plan.portfolios = [
    {
      id: accountId,
      name,
      kind: kind.kind,
      owner: "primary",
      currentValue: Math.max(0, answers.balance),
      returnPct: null,
      taxBucket: kind.bucket,
      spendable: true,
      includeInNetWorth: true,
      ...(piled ? { quizPile: true } : {}),
    },
  ];
  const saveUntil = monthBefore(retire);
  if (answers.monthlySave > 0 && saveUntil && saveUntil >= asOf) {
    plan.contributions = [
      {
        id: newId("c"),
        label: name,
        portfolioId: accountId,
        monthlyAmount: answers.monthlySave,
        startDate: asOf,
        endDate: saveUntil,
        amountMode: "fixed",
      },
    ];
  }
  plan.spending = [
    {
      id: newId("sp"),
      label: "Retirement",
      monthlyAmount: answers.monthlyNeed,
      startDate: retire,
      endDate: null,
    },
  ];
  const vaRating = answers.vaRating ?? 0;
  const vaKids = Math.max(0, Math.floor(answers.vaDependents ?? 0));
  const vaSpouse = answers.vaSpouse === true;
  for (const row of selectedPays(answers)) {
    const spec = PAY_LABEL[row.id];
    const table = row.id === "va" && vaRating >= 10 ? vaSchedularPay(vaRating, vaSpouse, vaKids) : row.monthly;
    plan.incomes.push({
      id: newId("inc"),
      name: spec.name,
      kind: row.id,
      monthlyAmount: table,
      startDate: spec.start === "now" ? asOf : retire,
      endDate: null,
      colaPct: null,
      taxTreatment: spec.tax,
      person: "primary",
    });
  }
  return plan;
}

/** What the one account can pay each month, in today's dollars. Guaranteed pay is not included. */
export function accountCanPay(plan: Plan): number {
  const room = sustainableRetirementIncome(plan);
  if (!room) return 0;
  return Math.max(0, Math.round(room.withdrawalReal / 12));
}

/** Nest egg, in today's dollars, that can pay the month they asked for. Not their current balance. */
export function nestEggForAskedMonth(answers: QuizAnswers, today = new Date()): number {
  const monthly = answers.monthlyNeed;
  if (!(monthly > 0)) return 0;
  const probe = quizPlan(
    { ...answers, balance: 100_000, monthlySave: 0, pay: "none", payMonthly: 0, pays: emptyPays() },
    today,
  );
  return nestEggForMonthlyWithdrawal(probe, monthly) ?? 0;
}
