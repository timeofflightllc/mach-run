export type AccountKind =
  | "401k"
  | "401k_roth"
  | "ira"
  | "roth_ira"
  | "roth"
  | "traditional"
  | "taxable"
  | "tsp"
  | "cash"
  | "529"
  | "ugma"
  | "education"
  | "real_estate"
  | "other";

export type TaxBucket = "roth" | "pre_tax" | "taxable" | "none";

export type IncomeKind =
  | "salary"
  | "bonus"
  | "allowance"
  | "military"
  | "va"
  | "ss"
  | "other";

export type TaxTreatment = "ordinary" | "tax_free" | "ss";

export interface Person {
  name: string;
  birthDate: string;
}

export interface Child extends Person {
  id: string;
}

export interface IncomeStage {
  id: string;
  label: string;
  startDate: string;
  endDate: string | null;
}

export interface Portfolio {
  id: string;
  name: string;
  kind: AccountKind;
  owner: string;
  currentValue: number;
  /** Annual nominal return override. null = global default. */
  returnPct: number | null;
  taxBucket: TaxBucket;
  /** Eligible for retirement withdrawals. */
  spendable: boolean;
  includeInNetWorth: boolean;
}

export interface ContributionRule {
  id: string;
  label: string;
  portfolioId: string;
  monthlyAmount: number;
  startDate: string;
  endDate: string | null;
  /** If set, end date tracks this stage. */
  endWithStageId?: string;
}

export interface IncomeStream {
  id: string;
  name: string;
  kind: IncomeKind;
  /** Monthly amount in as-of (today) dollars. */
  monthlyAmount: number;
  startDate: string;
  endDate: string | null;
  /** Annual COLA. null = use inflation assumption. */
  colaPct: number | null;
  taxTreatment: TaxTreatment;
  person: "primary" | "spouse" | "household";
  /** Window tracks this income stage. */
  tiedToStageId?: string;
  /** Legacy: treat as tied to stage 1. */
  tiedToCareer?: boolean;
  /** End this many months before the tied stage ends (e.g. bonus). */
  endMonthsBeforeStage?: number;
  endMonthsBeforeCareer?: number;
  ssPia?: number;
  ssClaimAge?: number;
  ssFra?: number;
  vaChildAware?: boolean;
  /** Combined disability rating, 10–100. Schedular table only — no SMC. */
  vaRatingPct?: number;
  /** Spouse is a dependent on the VA award. */
  vaSpouseDependent?: boolean;
}

export interface SpendingPhase {
  id: string;
  label: string;
  monthlyAmount: number;
  startDate: string;
  endDate: string | null;
  tiedToStageId?: string;
}

export interface Assumptions {
  asOfDate: string;
  inflationPct: number;
  defaultReturnPct: number;
  ordinaryTaxRatePct: number;
  ssTaxablePct: number;
  projectionEndAge: number;
  /** Synced from Income Stage 1 end when present. */
  careerEndDate: string;
  militaryRetireDate: string;
  sweepPortfolioId: string | null;
  dollars: "nominal" | "real";
  /** Household retirement target. Spendable strip keys off this date. */
  retirementGoalDate: string | null;
}

export interface Plan {
  primary: Person;
  spouse: Person;
  children: Child[];
  stages: IncomeStage[];
  assumptions: Assumptions;
  portfolios: Portfolio[];
  contributions: ContributionRule[];
  incomes: IncomeStream[];
  spending: SpendingPhase[];
}

export interface MonthSnapshot {
  date: string;
  year: number;
  month: number;
  primaryAge: number;
  spouseAge: number;
  portfolioEnd: number;
  portfolioEndReal: number;
  spendableEnd: number;
  spendableEndReal: number;
  netWorthEnd: number;
  netWorthEndReal: number;
  contributions: number;
  plannedContributions: number;
  withdrawals: number;
  income: number;
  incomeTaxable: number;
  tax: number;
  spending: number;
  surplus: number;
  guaranteed: number;
  incomeByKind: Record<string, number>;
  byBucket: Record<TaxBucket, number>;
}

export interface YearSnapshot {
  year: number;
  primaryAge: number;
  spouseAge: number;
  endPortfolio: number;
  endPortfolioReal: number;
  endSpendable: number;
  endSpendableReal: number;
  endNetWorth: number;
  endNetWorthReal: number;
  contributions: number;
  plannedContributions: number;
  withdrawals: number;
  income: number;
  tax: number;
  spending: number;
  surplus: number;
  guaranteed: number;
  incomeByKind: Record<string, number>;
}

export interface FundingGap {
  year: number;
  planned: number;
  leftover: number;
  funded: number;
}

export interface StageMark {
  id: string;
  label: string;
  date: string;
  spendable: number;
  spendableReal: number;
  guaranteed: number;
  spending: number;
}

export interface RetirementMark {
  date: string;
  now: boolean;
  spendable: number;
  spendableReal: number;
  monthlyIncome: number;
  annualIncome: number;
  monthlyIncomeReal: number;
  annualIncomeReal: number;
  monthlySpending: number;
}

export interface SimResult {
  months: MonthSnapshot[];
  years: YearSnapshot[];
  stageMarks: StageMark[];
  fundingGaps: FundingGap[];
  depletedAge: number | null;
  depletedYear: number | null;
  retirement: RetirementMark | null;
  spendableAtCareerEnd: number;
  spendableAtCareerEndReal: number;
  guaranteedAtCareerEnd: number;
  spendingAtCareerEnd: number;
  coverageAtCareerEnd: number;
  spendableAtEnd: number;
  spendableAtEndReal: number;
  totalContributed: number;
  totalWithdrawn: number;
  rmd: RmdReport;
}

export interface RmdReport {
  startAge: number | null;
  lifetimeRothExempt: string[];
  stillWorkingDeferred: string[];
  forced: string[];
  firstYearAnnual: number;
  total: number;
}
