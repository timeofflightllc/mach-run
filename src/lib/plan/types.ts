export type AccountKind =
  | "401k"
  | "401k_roth"
  | "ira"
  | "roth_ira"
  | "roth"
  | "traditional"
  | "taxable"
  | "tsp"
  | "tsp_roth"
  | "cash"
  | "529"
  | "ugma"
  | "trump"
  | "education"
  | "real_estate"
  | "annuity"
  | "other";

export type TaxBucket = "roth" | "pre_tax" | "taxable" | "none";

export type IncomeKind =
  | "salary"
  | "bonus"
  | "allowance"
  | "pension"
  | "military"
  | "va"
  | "ss"
  | "other"
  | "other_retirement";

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

export interface Mortgage {
  originationDate: string;
  aprPct: number;
  /** Principal and interest only. */
  monthlyPi: number;
  termYears: number;
  /** If true, P&I is added to monthly spending until the loan is paid off. */
  includeInSpending: boolean;
  /** User opted in to model a loan on this property. */
  associated?: boolean;
  /** Catalog id. Null when the lender was typed and is not on the list. */
  institutionId?: string | null;
  /** Mortgage company. Not used in any calculation. */
  institutionName?: string;
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
  /**
   * Investment in the contract (premiums paid). Annuities only.
   * Withdrawals: earnings first are ordinary income; then tax-free return of basis.
   */
  costBasis?: number | null;
  /** Real estate only. Remaining principal is subtracted from net worth. */
  mortgage?: Mortgage | null;
  /** Catalog id. Null when the name was typed and is not on the list. */
  institutionId?: string | null;
  /** Custodian or lender. Not used in any calculation. */
  institutionName?: string;
}

export type LiabilityKind =
  | "car"
  | "student"
  | "heloc"
  | "personal"
  | "credit_card"
  | "other";

export interface Liability {
  id: string;
  name: string;
  kind: LiabilityKind;
  balance: number;
  aprPct: number;
  monthlyPi: number;
  originationDate: string;
  termYears: number;
  includeInSpending: boolean;
  owner: string;
  /** Catalog id. Null when the name was typed and is not on the list. */
  institutionId?: string | null;
  /** Lender. Not used in any calculation. */
  institutionName?: string;
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
  /** fixed dollars, or a percent of a named income stream. */
  amountMode?: "fixed" | "percent";
  percentOfIncome?: number | null;
  percentOfIncomeId?: string | null;
  employerMatch?: boolean;
  /** 0–100. Applied to the employee dollars that actually get invested. */
  employerMatchPct?: number | null;
  /** Stop employee dollars when YTD hits the IRS annual max for this person. */
  capToIrsLimit?: boolean;
  /**
   * Person the IRS employee cap uses. Joint is not a person.
   * When omitted, the engine infers primary vs spouse from the account.
   */
  capPerson?: "primary" | "spouse";
  /** End date tracks Family retirement goal date. */
  endAtRetirement?: boolean;
  /**
   * Percent of an income only. Stops this contribution before that paycheck ends.
   * Blank follows the income. Does not change the income.
   */
  stopDate?: string | null;
}

export interface IncomeStream {
  id: string;
  name: string;
  kind: IncomeKind;
  /** Monthly amount in as-of (today) dollars. The engine reads this. */
  monthlyAmount: number;
  /** How the paycheck was typed. Missing means monthly. Salary, bonus, and allowance only. */
  payCadence?: "week" | "biweek" | "month" | "year";
  /** The amount they typed, in payCadence. Monthly equivalent is monthlyAmount. */
  payAmount?: number;
  startDate: string;
  endDate: string | null;
  /** Annual COLA. null = use inflation assumption. */
  colaPct: number | null;
  taxTreatment: TaxTreatment;
  person: "primary" | "spouse" | "household" | "other";
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
  /**
   * True while MACH RUN owns this Social Security estimate.
   * A typed PIA or an edited start/end sets it false and stops the refresh.
   */
  ssEstimated?: boolean;
  /** Birthday when person is "other" (not listed in Family). */
  ssBirthDate?: string | null;
  vaChildAware?: boolean;
  /** Combined disability rating, 10–100. Schedular table only — no SMC. */
  vaRatingPct?: number;
  /** Spouse is a dependent on the VA award. */
  vaSpouseDependent?: boolean;
  /** Start date tracks the day after the previous income ends. */
  startDayAfterPrevious?: boolean;
}

export interface SpendingPhase {
  id: string;
  label: string;
  monthlyAmount: number;
  startDate: string;
  endDate: string | null;
  tiedToStageId?: string;
  /** Start date tracks the day after the previous spending phase ends. */
  startDayAfterPrevious?: boolean;
  /** Set when this line was created from a liability. The payment does not inflate. */
  liabilityId?: string;
}

export interface Assumptions {
  asOfDate: string;
  /** True after the user sets As-of by hand. Later edits leave that date alone. */
  asOfPinned?: boolean;
  inflationPct: number;
  /** Default COLA on incomes unless a stream sets its own colaPct. */
  defaultColaPct: number;
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
  /** Spendable nest egg target in today's dollars at the retirement date. */
  nestEggGoal: number | null;
}

/** A kept answer on an overlap or a contribution the month cannot fund. */
export interface PlanConfirmation {
  id: string;
  fingerprint: string;
}

export interface Plan {
  primary: Person;
  spouse: Person;
  children: Child[];
  stages: IncomeStage[];
  assumptions: Assumptions;
  portfolios: Portfolio[];
  liabilities: Liability[];
  /**
   * User said this household has no loans. Cleared when a liability is added
   * or the last one is removed. Absent means they have not answered.
   */
  noLiabilities?: boolean;
  contributions: ContributionRule[];
  incomes: IncomeStream[];
  spending: SpendingPhase[];
  /** Kept answers. A changed amount or date asks again. */
  confirmations?: PlanConfirmation[];
}

export interface LedgerLine {
  id: string;
  label: string;
  amount: number;
}

/** Where a month's ledger numbers came from. Optional so chart samples can omit it. */
export interface MonthLedgerDetail {
  ordinaryTaxable: number;
  ssBenefit: number;
  ssTaxable: number;
  rmdTaxable: number;
  taxRatePct: number;
  spendingLines: LedgerLine[];
  unallocatedSpent: number;
  savedLines: LedgerLine[];
  sweep: LedgerLine | null;
  matchLines: LedgerLine[];
  drawnLines: LedgerLine[];
  spendableLines: LedgerLine[];
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
  assetsEnd: number;
  assetsEndReal: number;
  liabilitiesEnd: number;
  liabilitiesEndReal: number;
  contributions: number;
  plannedContributions: number;
  irsCut: number;
  employerMatch: number;
  withdrawals: number;
  income: number;
  incomeTaxable: number;
  tax: number;
  spending: number;
  surplus: number;
  guaranteed: number;
  incomeByKind: Record<string, number>;
  byBucket: Record<TaxBucket, number>;
  detail?: MonthLedgerDetail;
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
  endAssets: number;
  endAssetsReal: number;
  endLiabilities: number;
  endLiabilitiesReal: number;
  contributions: number;
  plannedContributions: number;
  irsCut: number;
  employerMatch: number;
  withdrawals: number;
  income: number;
  tax: number;
  spending: number;
  surplus: number;
  guaranteed: number;
  /** Actual Income Retired from the Family retirement month forward. Null before that date, or if no date is set. */
  air: number | null;
  airWithdrawals: number;
  airByKind: Record<string, number>;
  incomeByKind: Record<string, number>;
  /** Paycheck deposits, employer match, and sweep. Adds up to contributions. */
  savedLines?: LedgerLine[];
  /** Withdrawals by account for the year, nominal dollars. Id is the account id. */
  drawnLines?: LedgerLine[];
  /** Spendable account balances at the end of the year, in Accounts order. Nominal dollars. */
  spendableBalances?: { id: string; amount: number }[];
}

export interface FundingGap {
  year: number;
  planned: number;
  leftover: number;
  funded: number;
}

export type YearCapKind = "cash" | "irs" | "match";

export interface YearCap {
  year: number;
  kind: YearCapKind;
  planned: number;
  leftover: number;
  funded: number;
  irsCut: number;
  employerMatch: number;
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
  /** Calendar year of annualIncome. The first full year of A.I.R. */
  incomeYear: number | null;
  monthlySpending: number;
}

export interface AccountRetirementBalance {
  id: string;
  nominal: number;
  real: number;
}

export interface SimResult {
  months: MonthSnapshot[];
  years: YearSnapshot[];
  stageMarks: StageMark[];
  fundingGaps: FundingGap[];
  yearCaps: YearCap[];
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
  /** Account value entering the retirement month. Real is today's dollars. Empty-goal rows fall back to current value. */
  balancesAtRetirement: AccountRetirementBalance[];
  rmd: RmdReport;
  /** Present only when simulate() is asked for the admin audit. */
  audit?: import("./audit.ts").PlanAudit;
}

export interface RmdAccountRow {
  name: string;
  owner: string;
  status: "none" | "deferred" | "forced" | "future";
  startAge: number | null;
  startYear: number | null;
  firstYear: number | null;
  firstYearAnnual: number;
  institutionId?: string | null;
  institutionName?: string;
}

export interface RmdReport {
  startAge: number | null;
  lifetimeRothExempt: string[];
  stillWorkingDeferred: string[];
  forced: string[];
  firstYearAnnual: number;
  total: number;
  accounts: RmdAccountRow[];
}
