import type { Plan } from "./types.ts";

/** Month-by-month trail for the admin audit file. Not used by the ledger. */
export interface AuditAccountMonth {
  date: string;
  accountId: string;
  accountName: string;
  start: number;
  annualReturnPct: number;
  growth: number;
  contribution: number;
  match: number;
  withdrawal: number;
  sweep: number;
  end: number;
  residual: number;
  spendable: boolean;
  includeInNetWorth: boolean;
}

export interface AuditContribMonth {
  date: string;
  ruleId: string;
  accountId: string;
  mode: string;
  incomeBase: number | null;
  planned: number;
  irsLimit: number | null;
  catchUp: boolean;
  invested: number;
  match: number;
}

export interface AuditRmdMonth {
  date: string;
  accountId: string;
  ownerAge: number;
  startAge: number;
  factor: number;
  priorYearEnd: number;
  monthlyRmd: number;
  status: "taken" | "deferred";
}

export interface AuditAnnuityMonth {
  date: string;
  accountId: string;
  basisStart: number;
  basisAdded: number;
  taxableEarnings: number;
  basisReturned: number;
  basisEnd: number;
}

export interface PlanAudit {
  accounts: AuditAccountMonth[];
  contributions: AuditContribMonth[];
  rmds: AuditRmdMonth[];
  annuities: AuditAnnuityMonth[];
  /** Taxable annuity earnings withdrawn that month. Not inside the tax column. */
  annuityEarningsByDate: Record<string, number>;
}

export function emptyAudit(): PlanAudit {
  return {
    accounts: [],
    contributions: [],
    rmds: [],
    annuities: [],
    annuityEarningsByDate: {},
  };
}

export function windowWhy(input: {
  dayAfterPrevious?: boolean;
  retirement?: boolean;
  tiedToStage?: boolean;
  socialSecurity?: boolean;
}): string {
  const parts: string[] = [];
  if (input.dayAfterPrevious) parts.push("day after previous");
  if (input.retirement) parts.push("retirement");
  if (input.tiedToStage) parts.push("tied to a stage");
  if (input.socialSecurity) parts.push("social security schedule");
  return parts.length ? parts.join("; ") : "none";
}

export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function csvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

/** Assumptions as field/value rows. Skips nothing the plan actually stores. */
export function assumptionRows(plan: Plan): [string, string | number | null][] {
  const a = plan.assumptions;
  return [
    ["asOfDate", a.asOfDate],
    ["asOfPinned", a.asOfPinned ? "yes" : "no"],
    ["inflationPct", a.inflationPct],
    ["defaultColaPct", a.defaultColaPct],
    ["defaultReturnPct", a.defaultReturnPct],
    ["ordinaryTaxRatePct", a.ordinaryTaxRatePct],
    ["ssTaxablePct", a.ssTaxablePct],
    ["projectionEndAge", a.projectionEndAge],
    ["careerEndDate", a.careerEndDate],
    ["militaryRetireDate", a.militaryRetireDate],
    ["sweepPortfolioId", a.sweepPortfolioId],
    ["dollars", a.dollars],
    ["retirementGoalDate", a.retirementGoalDate],
    ["nestEggGoal", a.nestEggGoal],
  ];
}
