import { ageYears, inRange, monthStart, yearlyRateToMonthly } from "./dates.ts";
import {
  assumptionRows,
  csvRow,
  windowWhy,
  type PlanAudit,
} from "./audit.ts";
import {
  contributionWindow,
  spendingWindow,
  streamBenefitToday,
  streamColaAnnual,
  streamNominalAt,
  streamWindow,
} from "./engine.ts";
import { childIdFromOwner } from "./family-owners.ts";
import { liabilityPaymentDue, remainingLiability } from "./liability.ts";
import { mortgagePaymentDue, remainingMortgage } from "./mortgage.ts";
import { ssBenefitFromPia } from "./social-security.ts";
import type { MonthSnapshot, Plan, SimResult } from "./types.ts";
import { childrenUnder18, vaHasSpouse, vaPayTodayDollars, vaRatingOf } from "./va.ts";

function section(
  name: string,
  header: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string[] {
  return [
    csvRow(["section", ...header]),
    ...rows.map((row) => csvRow([name, ...row])),
  ];
}

function nextMonthIso(date: string): string {
  const [y, m] = date.slice(0, 7).split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

function loanParts(
  monthlyPi: number,
  aprPct: number,
  termYears: number,
  originationDate: string,
  at: string,
  includeInSpending: boolean,
  associated: boolean,
): { start: number; interest: number; principalPaid: number; end: number; inSpending: boolean } | null {
  if (!associated) return null;
  const stub = {
    originationDate,
    aprPct,
    monthlyPi,
    termYears,
    includeInSpending,
    associated: true as const,
  };
  const start = remainingMortgage(stub, at);
  if (start <= 0.5) return null;
  const r = (aprPct || 0) / 100 / 12;
  const interest = r > 0 ? start * r : 0;
  const contractual = Math.min(monthlyPi || 0, start + interest);
  const principalPaid = Math.max(0, contractual - interest);
  const end = remainingMortgage(stub, nextMonthIso(at));
  const counted = includeInSpending && mortgagePaymentDue(stub, at) > 0;
  return { start, interest, principalPaid, end, inSpending: counted };
}

const DICTIONARY: [string, string][] = [
  ["month_order", "Each month the engine grows balances, then adds income, then spending, then withdrawals, then employee contributions, then sweep, then employer match."],
  ["identity", "residual uses left = income + withdrawals and right = tax + spending + employee contributions. Employer match is inside income and is not on the right, so a match month is off by about the match."],
  ["residual_engine", "income + withdrawals + cash_drawn − tax − spending − contributions − cash_parked. Contributions here include employee dollars, sweep, and match. Match is on both sides, so it cancels. Cash parked is leftover held when Sweep surplus into is blank. Cash drawn is that pile used on a short month, before any account. This should be near zero except for a withdrawal-tax gross-up."],
  ["cents", "The engine does not round until this file. Amounts are shown to two decimals. A residual under half a cent is the display, not a broken month."],
  ["return", "Growth is nominal monthly compound from the annual return. A blank account return uses the default return."],
  ["income_nominal", "Income amounts are nominal dollars that month, after COLA from the as-of date."],
  ["today_dollars", "Today's dollars are nominal divided by the inflation index on that month."],
  ["air", "Actual Income Retired. Blank before the Family retirement month. After that, guaranteed income plus withdrawals. It is not the job, and it is not the Spendable balance."],
  ["match", "Employer match is calculated on dollars actually invested, after the IRS cap and after the paycheck has the cash. It is not part of income + drawn = tax + spend + saved."],
  ["annuity_tax", "Annuity taxable earnings are listed on their own. They are not inside the tax column. The withdrawal is grossed up for tax instead."],
  ["rmd", "Roth accounts are omitted. A workplace account is deferred only while salary is on and that account is still receiving contributions. monthly_rmd = prior December 31 balance / Uniform Lifetime factor / 12."],
  ["loan_principal", "Net worth uses principal at the start of the month, before that month's payment. principal_end is the next month's starting principal."],
  ["irs", "irs_limit is the employee cap used that year, including catch-up when catch_up is yes. Blank when the rule is not capped."],
  ["sweep_blank", "When Sweep surplus into is blank, cash left after tax, typed spending, and contributions is held as cash on hand. It earns nothing. It is part of spendable and net worth. It is not spending and it is not deposited in an account. A later short month spends that cash before withdrawing from an account."],
  ["codes", "A1 is an account, I1 an income, S1 spending, C1 a contribution, L1 a liability, child_1 a child. primary and spouse stay those words. The same household id is the same code everywhere in this file. Names, birth dates, notes, and the household's own ids are not in this file."],
  ["checks", "difference is the residual already on the trace. tolerance is 0.05, or 0.05 percent of the larger of left and right when that amount is above 1,000. pass is yes when the absolute difference is under tolerance. This table is the only verdict."],
];

/**
 * Pasted with the CSV into any model. The model recomputes the trace.
 * It does not give financial advice and it does not trust the residual columns.
 */
const REVIEW_ORDER: string[] = [
  "You are an independent reviewer of a household cash-flow calculator. You did not write this file. Do not assume the software is correct. Do not give financial advice, do not rewrite the household, and do not praise the plan. The reader will change the TypeScript backend from your bug table.",
  "This file is one MACH RUN. MACH RUN projects one household from asOfDate through the month the primary person reaches projectionEndAge. Each month it grows balances, counts income, spends, taxes at one flat rate, saves only leftover cash, withdraws from spendable accounts when the month is short, and reports spendable wealth and net worth. The rows under this prompt are the engine's own trace of the saved inputs. Recompute from the inputs and the rules below. A residual column is a claim, not proof. Assumption fields use the names in the assumptions section. Month columns use the header row of that section.",
  "The first column of every row is the section name. Sections follow in this order: review_order (these instructions), dictionary, assumptions, people, accounts, liabilities, incomes, spending, contributions, windows, then month_account, month_income, month_spending, month_contribution, month_rmd, month_annuity, month_loan, month_household, and checks. Amounts are rounded to two decimals. A gap under $0.05, or under 0.05 percent of a balance above $1,000, is rounding, not a bug. Rows use codes, not names. Accounts are A1, A2 in stored order. Incomes are I1, I2. Spending is S1, S2. Contributions are C1, C2. Liabilities are L1, L2. A child is child_1, child_2. Primary and spouse stay those words.",
  "Month order. 1. Grow every account first. Monthly rate = (1 + annual rate) ^ (1/12) - 1. Annual rate is the percent divided by 100. A blank account return uses defaultReturnPct. 2. Add income inside its resolved window. Nominal = today's dollars times (1 + annual COLA) ^ calendar years since the as-of year. The as-of year does not step. Each later January steps once, then the paycheck stays the same through December. COLA is that income's cola_pct, else defaultColaPct, else inflationPct. A salary, bonus, or allowance with cadence year deposits pay_amount (or monthly times 12 when pay_amount is blank) in the anniversary month only, then COLA. Other incomes stay monthly. 3. Add typed spending inside its window, inflated monthly from the inflation assumption. Add a mortgage or liability payment only when counted_in_spending is yes and principal remains. 4. Plan contributions inside their resolved windows. A percent rule is that percent of the named income's nominal that month. 5. Apply required minimum distributions. 6. Compute tax. 7. Split leftover cash. 8. Then add employer match.",
  "Tax is flat. Ordinary income and taken RMDs are taxed at ordinaryTaxRatePct. Social Security is taxed only on ssTaxablePct of the benefit, then at that same rate. There are no brackets and no standard deduction. Do not flag the missing brackets. Employer match is added to income after tax, so match is not taxed that month. Annuity taxable earnings are listed on month_annuity and are not inside the tax column. The withdrawal is grossed up instead.",
  "Leftover = income after RMDs and before match, minus tax, minus spending. If leftover is more than $0.50, fund employee contributions tax-qualified first, then taxable, until the cash runs out. Inside each of those groups, pay rules in the order they are listed. One rule may be paid in part. Once leftover is down to $0.50 or less, every later rule that month is $0. Do not withdraw from other accounts to fill a contribution, and do not use cash on hand to fill one. If a sweep account is set, deposit the rest there. If sweep is blank, add the rest to cash on hand. Cash on hand earns nothing. Then match = dollars actually invested on that rule times match_pct, and only when employer_match is yes and the destination is a 401(k), Roth 401(k), TSP, or Roth TSP. Match is added to that account and to income. If leftover is under -$0.50, spend cash on hand first, then withdraw from spendable accounts to cover what is still short, and fund no contributions that month.",
  "Withdrawals come only from spendable accounts, in order: taxable, then pre-tax, then Roth. Pre-tax dollars and non-qualified annuity gains are grossed up by 1 / (1 - tax rate) so the cash after that tax covers the hole. Annuity basis comes out tax-free after the gains. The extra withdrawn to pay tax on the withdrawal is not added to the tax column. That gross-up is allowed to show up in residual_engine. Roth withdrawals are not grossed up.",
  "Account identity: end = start + growth + contribution + match + sweep - withdrawal. Spendable end = sum of end balances with spendable yes. Net worth = include-in-net-worth end balances, minus that property's mortgage principal at the start of the month, minus standalone liability principal at the start of the month. A real-estate account left out of net worth does not subtract its mortgage either. Principal is the balance before that month's payment. principal_end is the next month's starting principal. Interest = principal_start times APR/12. Principal paid = payment minus interest, and not more than the remaining balance.",
  "Cash identity on month_household. Left = income + withdrawals. Right = tax + spending + employee_contributions. employee_contributions means household deposits that month, including sweep and excluding match. A month with a match is high on the left by about the match. residual_engine adds cash_drawn to the left and cash_parked to the right, puts the match on both sides, and should be near zero except for a withdrawal tax gross-up. Cash on hand is inside spendable_end and net_worth_end. Today's dollars = nominal divided by inflation_index. The index is 1 on the as-of month and compounds monthly.",
  "A.I.R. is blank before the retirement goal month in Goals. From that month on, A.I.R. = guaranteed income plus withdrawals. Guaranteed kinds are military, VA, Social Security, pension, and other retirement. A.I.R. is not the job, not the spendable balance, and not part of the cash identity.",
  "IRS employee caps are the 2026 figures, not indexed. Flag a wrong cap. Do not flag that later years use the same dollar cap. Per person, per calendar year, age at December 31: IRA and Roth IRA $7,500, plus $1,100 at age 50. Workplace 401(k), Roth 401(k), TSP, and Roth TSP $24,500, plus $8,000 at age 50, or plus $11,250 instead at ages 60 through 63. Trump account $5,000 with no catch-up, and its cap is per account. The cap applies only when irs_cap is yes. Match is outside the employee cap. The cap stops employee dollars for the rest of that year. It does not reject the typed amount.",
  "RMD. Roth accounts and a Roth tax bucket have none. A pre-tax IRA-style account starts the year the owner reaches 72 if born 1950 or earlier, 73 if born 1951 through 1959, and 75 if born 1960 or later. Age is the age at December 31 of that year. monthly_rmd = prior December 31 balance / Uniform Lifetime factor / 12. A workplace 401(k) or TSP uses the same rule unless a salary income is on that month AND that same account receives a contribution that month. Bonus and other pay do not defer the RMD. A taken RMD is added to income and to ordinary taxable income, and it is withdrawn from the account. If the balance is short, only the balance comes out. Status deferred means the still-working exception held.",
  "Social Security today's dollars = PIA times the claiming factor. Full retirement age is 67 unless the row says otherwise. Early: the first 36 months reduce by 5/9 of 1 percent each, then 5/12 of 1 percent each. Delayed: 2/3 of 1 percent each month, for at most 36 months. Claiming age is clamped from 62 to 70. The resolved start is that person's birthday plus the claiming age. The resolved end is the birthday plus projectionEndAge. Person spouse uses the spouse birthday. Person other uses the birth date stored on that income. A Social Security row ignores the typed start and end.",
  "VA today's dollars come from the 2026 schedular table for the rating, whether a spouse is counted, and how many listed children are under 18 that month. It steps down in the month a child turns 18, until only the veteran and spouse remain. COLA then inflates it like any other income. A VA row with no rating uses the typed monthly amount. Check the step-down dates. You do not have the table in this file, so do not invent a dollar rate. Flag a va_table_amount that fails to change when the child count changes, or that changes in the wrong month.",
  "Loans. Original principal is implied by the payment, the APR, and the term. Remaining principal uses standard amortization and is measured at the start of the month. A zero APR is straight line. A mortgage payment is counted in spending only when include_in_spending is yes. The same rule applies to a standalone liability.",
  "Windows. resolved_start and resolved_end are what the engine used. A percent-of-income contribution uses that income's window, which can replace the typed dates. end_at_retirement yes means the form stored the Family retirement date as the end. The engine follows the resolved end, not the checkbox. A stage tie replaces the window with the stage. Trust the resolved dates over the typed dates, then check that the resolved dates follow these rules.",
  "Do not flag these. They are the spec. Flat tax. Unindexed 2026 IRS caps. COLA and inflation measured from the as-of month. Institution names, which are labels and are not in the math. Match outside the simple cash identity. Withdrawal tax gross-up inside residual_engine. Rounding under the tolerance above.",
  "Checks. Read the checks section. Do not compute a second residual. difference is the residual already on that row. tolerance is 0.05, or 0.05 percent of the larger of left and right when that amount is above 1,000. pass is yes when the absolute difference is under tolerance. The checks table is the only verdict.",
  "Reply. Write nothing before the verdict. VERDICT is PASS if every pass is yes. Otherwise VERDICT is FAIL and the count of no rows. Do not mark a yes row as a bug. Do not add a bug the table does not list. Recompute a no row from the spec before you confirm it. Confirmed means your arithmetic disagrees with the file by more than the tolerance. A no row your arithmetic agrees with is a display of that tolerance miss, still listed, not a new theory. Do not give financial advice. Do not discuss the household. If there is no confirmed bug, write BUGS: none under the verdict. If there is a confirmed bug, write one block per bug: BUG 1, then section, month, code, check, file, spec, diff, and look. look is the file to open, src/lib/plan/engine.ts, not a patch. End there.",
];

interface CodeBook {
  account: Map<string, string>;
  income: Map<string, string>;
  spending: Map<string, string>;
  contribution: Map<string, string>;
  liability: Map<string, string>;
  child: Map<string, string>;
}

function codeBook(plan: Plan): CodeBook {
  const account = new Map<string, string>();
  plan.portfolios.forEach((row, index) => account.set(row.id, `A${index + 1}`));
  const income = new Map<string, string>();
  plan.incomes.forEach((row, index) => income.set(row.id, `I${index + 1}`));
  const spending = new Map<string, string>();
  plan.spending.forEach((row, index) => spending.set(row.id, `S${index + 1}`));
  const contribution = new Map<string, string>();
  plan.contributions.forEach((row, index) => contribution.set(row.id, `C${index + 1}`));
  const liability = new Map<string, string>();
  (plan.liabilities ?? []).forEach((row, index) => liability.set(row.id, `L${index + 1}`));
  const child = new Map<string, string>();
  (plan.children ?? []).forEach((row, index) => child.set(row.id, `child_${index + 1}`));
  return { account, income, spending, contribution, liability, child };
}

function codeOf(map: Map<string, string>, id: string | null | undefined): string {
  if (!id) return "";
  return map.get(id) ?? "";
}

function personCode(person: string | null | undefined): string {
  const value = (person ?? "").trim();
  if (value === "primary" || value === "spouse" || value === "other") return value;
  return value ? "other" : "";
}

function ownerCode(owner: string | null | undefined, children: Map<string, string>): string {
  const childId = childIdFromOwner(owner);
  if (childId) return children.get(childId) ?? "";
  const value = (owner ?? "").trim();
  if (/^spouse$/i.test(value)) return "spouse";
  if (/^joint$/i.test(value)) return "joint";
  if (/^(primary|you)$/i.test(value)) return "primary";
  return "";
}

function checkTolerance(left: number, right: number): number {
  const balance = Math.max(Math.abs(left), Math.abs(right));
  if (balance > 1000) return Math.max(0.05, balance * 0.0005);
  return 0.05;
}

function checkRow(
  month: string,
  code: string,
  check: string,
  left: number,
  right: number,
  difference: number,
): (string | number | boolean)[] {
  const tolerance = checkTolerance(left, right);
  return [month, code, check, left, right, difference, tolerance, Math.abs(difference) < tolerance];
}

export function buildInvestmentAuditCsv(plan: Plan, sim: SimResult): string {
  const audit: PlanAudit = sim.audit ?? {
    accounts: [],
    contributions: [],
    rmds: [],
    annuities: [],
    annuityEarningsByDate: {},
  };
  const book = codeBook(plan);
  const lines: string[] = [];
  lines.push(
    ...section(
      "review_order",
      ["step", "instruction"],
      REVIEW_ORDER.map((instruction, index) => [String(index + 1), instruction]),
    ),
  );
  lines.push(...section("dictionary", ["column", "meaning"], DICTIONARY));

  lines.push(
    ...section(
      "assumptions",
      ["field", "value"],
      assumptionRows(plan).map(([field, value]) => [
        field === "sweepPortfolioId" ? "sweep_account" : field,
        field === "sweepPortfolioId" ? codeOf(book.account, typeof value === "string" ? value : null) : value,
      ]),
    ),
  );

  const asOf = monthStart(plan.assumptions.asOfDate);
  const people: (string | number | null)[][] = [
    ["primary", ageYears(plan.primary.birthDate, asOf)],
    ["spouse", plan.spouse.birthDate ? ageYears(plan.spouse.birthDate, asOf) : ""],
    ...(plan.children ?? []).map((child, index) => [
      `child_${index + 1}`,
      ageYears(child.birthDate, asOf),
    ]),
  ];
  lines.push(...section("people", ["role", "age_at_as_of"], people));

  lines.push(
    ...section(
      "accounts",
      ["code", "kind", "owner", "tax_bucket", "current_value", "cost_basis", "return_override_pct", "spendable", "include_in_net_worth", "mortgage_origination", "mortgage_apr_pct", "mortgage_pi", "mortgage_term_years", "mortgage_in_spending"],
      plan.portfolios.map((p) => [
        codeOf(book.account, p.id),
        p.kind,
        ownerCode(p.owner, book.child),
        p.taxBucket,
        p.currentValue,
        p.costBasis ?? null,
        p.returnPct,
        p.spendable,
        p.includeInNetWorth,
        p.mortgage?.originationDate ?? null,
        p.mortgage && p.kind === "real_estate" ? p.mortgage.aprPct : null,
        p.mortgage && p.kind === "real_estate" ? p.mortgage.monthlyPi : null,
        p.mortgage && p.kind === "real_estate" ? p.mortgage.termYears : null,
        p.mortgage && p.kind === "real_estate" ? Boolean(p.mortgage.includeInSpending) : null,
      ]),
    ),
  );

  lines.push(
    ...section(
      "liabilities",
      ["code", "kind", "owner", "balance", "apr_pct", "monthly_pi", "origination", "term_years", "include_in_spending"],
      (plan.liabilities ?? []).map((l) => [
        codeOf(book.liability, l.id),
        l.kind,
        ownerCode(l.owner, book.child),
        l.balance,
        l.aprPct,
        l.monthlyPi,
        l.originationDate,
        l.termYears,
        l.includeInSpending,
      ]),
    ),
  );

  lines.push(
    ...section(
      "incomes",
      ["code", "kind", "person", "monthly_today", "pay_cadence", "pay_amount", "start", "end", "cola_pct", "tax_treatment", "ss_claim_age", "ss_pia", "va_rating"],
      plan.incomes.map((s) => [
        codeOf(book.income, s.id),
        s.kind,
        personCode(s.person),
        s.monthlyAmount,
        s.payCadence ?? null,
        s.payAmount ?? null,
        s.startDate,
        s.endDate,
        s.colaPct,
        s.taxTreatment,
        s.ssClaimAge ?? null,
        s.ssPia ?? null,
        s.vaRatingPct ?? null,
      ]),
    ),
  );

  lines.push(
    ...section(
      "spending",
      ["code", "monthly_today", "start", "end"],
      plan.spending.map((s) => [codeOf(book.spending, s.id), s.monthlyAmount, s.startDate, s.endDate]),
    ),
  );

  lines.push(
    ...section(
      "contributions",
      ["code", "account", "mode", "monthly_amount", "pay_cadence", "pay_amount", "percent", "percent_of_income", "start", "end", "stop_date", "employer_match", "match_pct", "irs_cap", "end_at_retirement"],
      plan.contributions.map((c) => {
        return [
          codeOf(book.contribution, c.id),
          codeOf(book.account, c.portfolioId),
          c.amountMode === "percent" ? "percent" : "fixed",
          c.amountMode === "percent" ? null : c.monthlyAmount,
          c.amountMode === "percent" ? null : c.payCadence ?? null,
          c.amountMode === "percent" ? null : c.payAmount ?? null,
          c.amountMode === "percent" ? c.percentOfIncome ?? null : null,
          codeOf(book.income, c.percentOfIncomeId),
          c.startDate,
          c.endDate,
          c.stopDate ?? null,
          Boolean(c.employerMatch),
          c.employerMatchPct ?? null,
          Boolean(c.capToIrsLimit),
          Boolean(c.endAtRetirement),
        ];
      }),
    ),
  );

  const windows: (string | number | null)[][] = [];
  for (const stream of plan.incomes) {
    const resolved = streamWindow(plan, stream);
    windows.push([
      "income",
      codeOf(book.income, stream.id),
      stream.startDate,
      stream.endDate,
      resolved.start,
      resolved.end,
      windowWhy({
        dayAfterPrevious: Boolean(stream.startDayAfterPrevious),
        tiedToStage: Boolean(stream.tiedToStageId || stream.tiedToCareer),
        socialSecurity: stream.kind === "ss" && stream.ssClaimAge != null,
      }),
    ]);
  }
  for (const phase of plan.spending) {
    const resolved = spendingWindow(plan, phase);
    windows.push([
      "spending",
      codeOf(book.spending, phase.id),
      phase.startDate,
      phase.endDate,
      resolved.start,
      resolved.end,
      windowWhy({
        dayAfterPrevious: Boolean(phase.startDayAfterPrevious),
        tiedToStage: Boolean(phase.tiedToStageId),
      }),
    ]);
  }
  for (const rule of plan.contributions) {
    const resolved = contributionWindow(plan, rule);
    windows.push([
      "contribution",
      codeOf(book.contribution, rule.id),
      rule.startDate,
      rule.endDate,
      resolved.start,
      resolved.end,
      windowWhy({
        retirement: Boolean(rule.endAtRetirement),
        tiedToStage: Boolean(rule.endWithStageId),
      }),
    ]);
  }
  lines.push(
    ...section(
      "windows",
      ["kind", "code", "typed_start", "typed_end", "resolved_start", "resolved_end", "why"],
      windows,
    ),
  );

  const infA = plan.assumptions.inflationPct / 100;
  const mInf = yearlyRateToMonthly(infA);
  const ssShare = plan.assumptions.ssTaxablePct / 100;
  const goalKey = plan.assumptions.retirementGoalDate?.slice(0, 7) ?? "";
  const incomeRows: (string | number | boolean | null)[][] = [];
  const spendRows: (string | number | null)[][] = [];
  const loanRows: (string | number | boolean | null)[][] = [];
  const homeRows: (string | number | null)[][] = [];
  const checkRows: (string | number | boolean)[][] = [];

  sim.months.forEach((month, index) => {
    const date = month.date;
    const inflationIndex = (1 + mInf) ** index;
    const at = monthStart(date);
    for (const stream of plan.incomes) {
      const nominal = streamNominalAt(plan, stream, at, index, infA);
      if (Math.abs(nominal) < 0.005) continue;
      const today = streamBenefitToday(plan, stream, at);
      const cola = streamColaAnnual(plan, stream, infA);
      const ss = stream.kind === "ss" && stream.ssPia != null && stream.ssClaimAge != null;
      const rating = vaRatingOf(stream);
      const va = stream.kind === "va" && rating != null;
      const pia = stream.ssPia ?? null;
      const factor = ss && pia ? ssBenefitFromPia(pia, stream.ssClaimAge ?? 67, stream.ssFra ?? 67) / pia : null;
      incomeRows.push([
        date,
        codeOf(book.income, stream.id),
        stream.kind,
        today,
        ss ? "social_security" : va ? "va_table" : "typed",
        cola * 100,
        nominal,
        ss ? pia : null,
        ss ? stream.ssClaimAge ?? null : null,
        ss ? stream.ssFra ?? 67 : null,
        factor,
        va ? rating : null,
        va ? vaHasSpouse(plan, stream) : null,
        va ? childrenUnder18(plan.children ?? [], at).length : null,
        va ? vaPayTodayDollars(plan, stream, at) : null,
      ]);
    }
    for (const phase of plan.spending) {
      const win = spendingWindow(plan, phase);
      if (!inRange(at, win.start, win.end)) continue;
      const amount = phase.monthlyAmount * inflationIndex;
      if (amount <= 0.005) continue;
      spendRows.push([date, codeOf(book.spending, phase.id), amount]);
    }
    for (const p of plan.portfolios) {
      if (p.kind !== "real_estate" || !p.mortgage) continue;
      const parts = loanParts(
        p.mortgage.monthlyPi,
        p.mortgage.aprPct,
        p.mortgage.termYears,
        p.mortgage.originationDate,
        date,
        p.mortgage.includeInSpending,
        p.mortgage.associated !== false && (p.mortgage.associated === true || p.mortgage.monthlyPi > 0),
      );
      if (!parts) continue;
      const due = mortgagePaymentDue(p.mortgage, date);
      if (due > 0) spendRows.push([date, codeOf(book.account, p.id), due]);
      loanRows.push([date, codeOf(book.account, p.id), "mortgage", parts.start, parts.interest, parts.principalPaid, parts.end, parts.inSpending]);
    }
    for (const l of plan.liabilities ?? []) {
      const parts = loanParts(l.monthlyPi, l.aprPct, l.termYears, l.originationDate, date, l.includeInSpending, true);
      if (!parts) continue;
      const due = liabilityPaymentDue(l, date);
      if (due > 0) spendRows.push([date, codeOf(book.liability, l.id), due]);
      loanRows.push([date, codeOf(book.liability, l.id), "liability", parts.start, parts.interest, parts.principalPaid, parts.end, parts.inSpending]);
    }
    const listedSpend = spendRows
      .filter((row) => row[0] === date)
      .reduce((sum, row) => sum + Number(row[2] ?? 0), 0);
    const unallocated = month.spending - listedSpend;
    if (unallocated > 0.5) {
      spendRows.push([date, "unallocated", unallocated]);
    }
    const home = householdRow(plan, month, inflationIndex, ssShare, goalKey, audit, date);
    homeRows.push(home.cells);
    for (const row of audit.accounts) {
      if (row.date !== date) continue;
      const expected =
        row.start + row.growth + row.contribution + row.match + row.sweep - row.withdrawal;
      checkRows.push(
        checkRow(date, codeOf(book.account, row.accountId), "account_residual", row.end, expected, row.residual),
      );
    }
    for (const item of home.checks) {
      checkRows.push(checkRow(date, "", item.check, item.left, item.right, item.difference));
    }
  });

  lines.push(
    ...section(
      "month_account",
      ["date", "code", "start_balance", "annual_return_pct", "growth", "contribution", "match", "withdrawal", "sweep", "end_balance", "residual", "spendable", "in_net_worth"],
      audit.accounts.map((row) => [
        row.date,
        codeOf(book.account, row.accountId),
        row.start,
        row.annualReturnPct,
        row.growth,
        row.contribution,
        row.match,
        row.withdrawal,
        row.sweep,
        row.end,
        row.residual,
        row.spendable,
        row.includeInNetWorth,
      ]),
    ),
  );
  lines.push(
    ...section(
      "month_income",
      ["date", "code", "kind", "today_dollars", "source", "cola_pct_used", "nominal", "pia", "claim_age", "fra", "ss_factor", "va_rating", "va_spouse", "va_children_under_18", "va_table_amount"],
      incomeRows,
    ),
  );
  lines.push(...section("month_spending", ["date", "code", "amount"], spendRows));
  lines.push(
    ...section(
      "month_contribution",
      ["date", "code", "account", "mode", "income_dollars", "planned", "after_irs_cap", "irs_limit", "catch_up", "invested", "match"],
      audit.contributions.map((row) => [
        row.date,
        codeOf(book.contribution, row.ruleId),
        codeOf(book.account, row.accountId),
        row.mode,
        row.incomeBase,
        row.planned,
        row.eligible,
        row.irsLimit,
        row.catchUp,
        row.invested,
        row.match,
      ]),
    ),
  );
  lines.push(
    ...section(
      "month_rmd",
      ["date", "code", "owner_age", "rmd_start_age", "uniform_lifetime_factor", "prior_dec_31_balance", "monthly_rmd", "status"],
      audit.rmds.map((row) => [
        row.date,
        codeOf(book.account, row.accountId),
        row.ownerAge,
        row.startAge,
        row.factor,
        row.priorYearEnd,
        row.monthlyRmd,
        row.status,
      ]),
    ),
  );
  lines.push(
    ...section(
      "month_annuity",
      ["date", "code", "basis_start", "basis_added", "taxable_earnings_withdrawn", "tax_free_basis_returned", "basis_end"],
      audit.annuities.map((row) => [
        row.date,
        codeOf(book.account, row.accountId),
        row.basisStart,
        row.basisAdded,
        row.taxableEarnings,
        row.basisReturned,
        row.basisEnd,
      ]),
    ),
  );
  lines.push(
    ...section(
      "month_loan",
      ["date", "code", "kind", "principal_start", "interest", "principal_paid", "principal_end", "counted_in_spending"],
      loanRows,
    ),
  );
  lines.push(
    ...section(
      "month_household",
      ["date", "primary_age", "spouse_age", "income", "tax", "spending", "employee_contributions", "employer_match", "withdrawals", "surplus", "guaranteed", "air", "spendable_end", "spendable_end_today", "net_worth_end", "assets_end", "liabilities_end", "identity_left", "identity_right", "residual", "residual_engine", "inflation_index", "ordinary_taxable", "social_security", "ss_taxable", "annuity_earnings", "tax_rate", "air_guaranteed", "air_withdrawals", "air_total", "spendable_from_accounts", "spendable_residual", "net_worth_from_parts", "net_worth_residual", "cash_parked", "cash_drawn", "cash_on_hand"],
      homeRows,
    ),
  );
  lines.push(
    ...section(
      "checks",
      ["month", "code", "check", "left", "right", "difference", "tolerance", "pass"],
      checkRows,
    ),
  );

  return lines.join("\n");
}

function householdRow(
  plan: Plan,
  month: MonthSnapshot,
  inflationIndex: number,
  ssShare: number,
  goalKey: string,
  audit: PlanAudit,
  date: string,
): {
  cells: (string | number | null)[];
  checks: { check: string; left: number; right: number; difference: number }[];
} {
  const ss = month.incomeByKind.ss ?? 0;
  const ssTaxable = ss * ssShare;
  const ordinary = month.incomeTaxable - ssTaxable;
  const annuity = audit.annuityEarningsByDate[date] ?? 0;
  const employee = month.contributions - month.employerMatch;
  const cashParked = month.detail?.cashParked ?? 0;
  const cashDrawn = month.detail?.cashDrawn ?? 0;
  const cashOnHand = month.detail?.cashOnHand ?? 0;
  const left = month.income + month.withdrawals;
  const right = month.tax + month.spending + employee;
  const engineLeft = month.income + month.withdrawals + cashDrawn;
  const engineRight = month.tax + month.spending + month.contributions + cashParked;
  const retired = Boolean(goalKey) && date.slice(0, 7) >= goalKey;
  const accounts = audit.accounts.filter((row) => row.date === date);
  const spendableFrom = accounts.filter((row) => row.spendable).reduce((s, row) => s + row.end, 0);
  let netFrom = 0;
  for (const row of accounts) {
    if (!row.includeInNetWorth) continue;
    const portfolio = plan.portfolios.find((p) => p.id === row.accountId);
    const debt = portfolio?.kind === "real_estate" ? remainingMortgage(portfolio.mortgage, date) : 0;
    netFrom += row.end - debt;
  }
  for (const l of plan.liabilities ?? []) netFrom -= remainingLiability(l, date);
  const spendableFromCash = spendableFrom + cashOnHand;
  const netFromCash = netFrom + cashOnHand;
  const spendableDifference = spendableFromCash - month.spendableEnd;
  const netDifference = netFromCash - month.netWorthEnd;
  return {
    cells: [
      date,
      month.primaryAge,
      month.spouseAge,
      month.income,
      month.tax,
      month.spending,
      employee,
      month.employerMatch,
      month.withdrawals,
      month.surplus,
      month.guaranteed,
      retired ? month.guaranteed + month.withdrawals : null,
      month.spendableEnd,
      month.spendableEndReal,
      month.netWorthEnd,
      month.assetsEnd,
      month.liabilitiesEnd,
      left,
      right,
      left - right,
      engineLeft - engineRight,
      inflationIndex,
      ordinary,
      ss,
      ssTaxable,
      annuity,
      plan.assumptions.ordinaryTaxRatePct,
      retired ? month.guaranteed : null,
      retired ? month.withdrawals : null,
      retired ? month.guaranteed + month.withdrawals : null,
      spendableFromCash,
      spendableDifference,
      netFromCash,
      netDifference,
      cashParked,
      cashDrawn,
      cashOnHand,
    ],
    checks: [
      { check: "household_residual", left, right, difference: left - right },
      { check: "residual_engine", left: engineLeft, right: engineRight, difference: engineLeft - engineRight },
      { check: "spendable_residual", left: spendableFromCash, right: month.spendableEnd, difference: spendableDifference },
      { check: "net_worth_residual", left: netFromCash, right: month.netWorthEnd, difference: netDifference },
    ],
  };
}
