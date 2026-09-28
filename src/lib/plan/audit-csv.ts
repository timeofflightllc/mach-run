import { inRange, monthStart, yearlyRateToMonthly, calendarColaYears } from "./dates.ts";
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
  streamWindow,
} from "./engine.ts";
import { liabilityPaymentDue, remainingLiability } from "./liability.ts";
import { mortgagePaymentDue, remainingMortgage } from "./mortgage.ts";
import { ssBenefitFromPia, ssBirthFor } from "./social-security.ts";
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
  ["residual_engine", "income + withdrawals − tax − spending − contributions. Contributions here include employee dollars, sweep, and match. Match is on both sides, so it cancels. When no sweep account is selected, leftover cash is added to spending instead of dropped. This should be near zero except for a withdrawal-tax gross-up."],
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
  ["sweep_blank", "When Sweep surplus into is blank, cash left after tax, typed spending, and contributions is spent. It is listed in month_spending as Unallocated surplus. It is not deposited."],
];

/**
 * Pasted with the CSV into any model. The model recomputes the trace.
 * It does not give financial advice and it does not trust the residual columns.
 */
const REVIEW_ORDER: string[] = [
  "You are an independent reviewer of a household cash-flow calculator. You did not write this file. Do not assume the software is correct. Do not give financial advice, do not rewrite the household, and do not praise the plan. The reader will change the TypeScript backend from your bug table.",
  "This file is one MACH RUN. MACH RUN projects one household from asOfDate through the month the primary person reaches projectionEndAge. Each month it grows balances, counts income, spends, taxes at one flat rate, saves only leftover cash, withdraws from spendable accounts when the month is short, and reports spendable wealth and net worth. The rows under this prompt are the engine's own trace of the saved inputs. Recompute from the inputs and the rules below. A residual column is a claim, not proof. Assumption fields use the names in the assumptions section. Month columns use the header row of that section.",
  "The first column of every row is the section name. Sections follow in this order: review_order (these instructions), dictionary, assumptions, people, accounts, liabilities, incomes, spending, contributions, windows, then month_account, month_income, month_spending, month_contribution, month_rmd, month_annuity, month_loan, and month_household. Amounts are rounded to two decimals. A gap under $0.05, or under 0.05 percent of a balance above $1,000, is rounding, not a bug.",
  "Month order. 1. Grow every account first. Monthly rate = (1 + annual rate) ^ (1/12) - 1. Annual rate is the percent divided by 100. A blank account return uses defaultReturnPct. 2. Add income inside its resolved window. Nominal = today's dollars times (1 + annual COLA) ^ calendar years since the as-of year. The as-of year does not step. Each later January steps once, then the paycheck stays the same through December. COLA is that income's cola_pct, else defaultColaPct, else inflationPct. 3. Add typed spending inside its window, inflated monthly from the inflation assumption. Add a mortgage or liability payment only when counted_in_spending is yes and principal remains. 4. Plan contributions inside their resolved windows. A percent rule is that percent of the named income's nominal that month. 5. Apply required minimum distributions. 6. Compute tax. 7. Split leftover cash. 8. Then add employer match.",
  "Tax is flat. Ordinary income and taken RMDs are taxed at ordinaryTaxRatePct. Social Security is taxed only on ssTaxablePct of the benefit, then at that same rate. There are no brackets and no standard deduction. Do not flag the missing brackets. Employer match is added to income after tax, so match is not taxed that month. Annuity taxable earnings are listed on month_annuity and are not inside the tax column. The withdrawal is grossed up instead.",
  "Leftover = income after RMDs and before match, minus tax, minus spending. If leftover is more than $0.50, fund employee contributions in the order they appear until the cash runs out. Do not withdraw from other accounts to fill a contribution. If a sweep account is set, deposit the rest there. If sweep is blank, add the rest to spending as Unallocated surplus. Then match = dollars actually invested on that rule times match_pct, and only when employer_match is yes and the destination is a 401(k), Roth 401(k), or TSP. Match is added to that account and to income. If leftover is under -$0.50, withdraw to cover the shortfall and fund no contributions that month.",
  "Withdrawals come only from spendable accounts, in order: taxable, then pre-tax, then Roth. Pre-tax dollars and non-qualified annuity gains are grossed up by 1 / (1 - tax rate) so the cash after that tax covers the hole. Annuity basis comes out tax-free after the gains. The extra withdrawn to pay tax on the withdrawal is not added to the tax column. That gross-up is allowed to show up in residual_engine. Roth withdrawals are not grossed up.",
  "Account identity: end = start + growth + contribution + match + sweep - withdrawal. Spendable end = sum of end balances with spendable yes. Net worth = include-in-net-worth end balances, minus that property's mortgage principal at the start of the month, minus standalone liability principal at the start of the month. A real-estate account left out of net worth does not subtract its mortgage either. Principal is the balance before that month's payment. principal_end is the next month's starting principal. Interest = principal_start times APR/12. Principal paid = payment minus interest, and not more than the remaining balance.",
  "Cash identity on month_household. Left = income + withdrawals. Right = tax + spending + employee_contributions. employee_contributions means household deposits that month, including sweep and excluding match. A month with a match is high on the left by about the match. residual_engine puts the match on both sides and should be near zero except for a withdrawal tax gross-up. When sweep is blank, the unallocated surplus is inside spending, so it sits on the right. Today's dollars = nominal divided by inflation_index. The index is 1 on the as-of month and compounds monthly.",
  "A.I.R. is blank before the retirement goal month in Family. From that month on, A.I.R. = guaranteed income plus withdrawals. Guaranteed kinds are military, VA, Social Security, pension, and other retirement. A.I.R. is not the job, not the spendable balance, and not part of the cash identity.",
  "IRS employee caps are the 2026 figures, not indexed. Flag a wrong cap. Do not flag that later years use the same dollar cap. Per person, per calendar year, age at December 31: IRA and Roth IRA $7,500, plus $1,100 at age 50. Workplace 401(k), Roth 401(k), and TSP $24,500, plus $8,000 at age 50, or plus $11,250 instead at ages 60 through 63. Trump account $5,000 with no catch-up, and its cap is per account. The cap applies only when irs_cap is yes. Match is outside the employee cap. The cap stops employee dollars for the rest of that year. It does not reject the typed amount.",
  "RMD. Roth accounts and a Roth tax bucket have none. A pre-tax IRA-style account starts the year the owner reaches 72 if born 1950 or earlier, 73 if born 1951 through 1959, and 75 if born 1960 or later. Age is the age at December 31 of that year. monthly_rmd = prior December 31 balance / Uniform Lifetime factor / 12. A workplace 401(k) or TSP uses the same rule unless a salary income is on that month AND that same account receives a contribution that month. Bonus and other pay do not defer the RMD. A taken RMD is added to income and to ordinary taxable income, and it is withdrawn from the account. If the balance is short, only the balance comes out. Status deferred means the still-working exception held.",
  "Social Security today's dollars = PIA times the claiming factor. Full retirement age is 67 unless the row says otherwise. Early: the first 36 months reduce by 5/9 of 1 percent each, then 5/12 of 1 percent each. Delayed: 2/3 of 1 percent each month, for at most 36 months. Claiming age is clamped from 62 to 70. The resolved start is that person's birthday plus the claiming age. The resolved end is the birthday plus projectionEndAge. Person spouse uses the spouse birthday. Person other uses the birth date stored on that income. A Social Security row ignores the typed start and end.",
  "VA today's dollars come from the 2026 schedular table for the rating, whether a spouse is counted, and how many listed children are under 18 that month. It steps down in the month a child turns 18, until only the veteran and spouse remain. COLA then inflates it like any other income. A VA row with no rating uses the typed monthly amount. Check the step-down dates. You do not have the table in this file, so do not invent a dollar rate. Flag a va_table_amount that fails to change when the child count changes, or that changes in the wrong month.",
  "Loans. Original principal is implied by the payment, the APR, and the term. Remaining principal uses standard amortization and is measured at the start of the month. A zero APR is straight line. A mortgage payment is counted in spending only when include_in_spending is yes. The same rule applies to a standalone liability.",
  "Windows. resolved_start and resolved_end are what the engine used. A percent-of-income contribution uses that income's window, which can replace the typed dates. end_at_retirement yes means the form stored the Family retirement date as the end. The engine follows the resolved end, not the checkbox. A stage tie replaces the window with the stage. Trust the resolved dates over the typed dates, then check that the resolved dates follow these rules.",
  "Do not flag these. They are the spec. Flat tax. Unindexed 2026 IRS caps. COLA and inflation measured from the as-of month. Institution names, which are labels and are not in the math. Match outside the simple cash identity. Withdrawal tax gross-up inside residual_engine. Rounding under the tolerance above.",
  "Work this way. Recompute every required month before you call anything a bug. Required months: the first month, the last month, the retirement goal month, the month before it, January and December of the first year a contribution is capped, the first month any RMD status is taken, the month a listed child turns 18 if VA is present, and any month where the absolute value of residual, residual_engine, spendable_residual, or net_worth_residual is greater than $1. If a required month fails, recompute every month of that calendar year. Then stop. Do not boil a 40-year file month by month once the samples and the failing year agree.",
  "Display the result in this exact order, plain text, with these headings. No introduction. VERDICT: one line, PASS, or FAIL and the count of confirmed bugs. CONFIRMED BUGS: a table with columns number, severity (wrong cash, wrong balance, wrong date, or display only), where (section, date, and id), file says, spec says, suspected code (the idea, not a patch), and what to check next. Write None if there are no bugs. LOOKS WRONG BUT MATCHES THE SPEC: a short list, or None. SAMPLES I RECOMPUTED: a table with columns month, check, file, my result, and difference. Include every required month, including the ones that passed. NOT CHECKED: what you skipped, and why.",
];

export function buildInvestmentAuditCsv(plan: Plan, sim: SimResult): string {
  const audit: PlanAudit = sim.audit ?? {
    accounts: [],
    contributions: [],
    rmds: [],
    annuities: [],
    annuityEarningsByDate: {},
  };
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
      assumptionRows(plan).map(([field, value]) => [field, value]),
    ),
  );

  const people: (string | number | null)[][] = [
    ["primary", plan.primary.name, plan.primary.birthDate],
    ["spouse", plan.spouse.name, plan.spouse.birthDate],
    ...plan.children.map((child) => ["child", child.name, child.birthDate]),
  ];
  lines.push(...section("people", ["role", "name", "birth_date"], people));

  lines.push(
    ...section(
      "accounts",
      ["id", "name", "kind", "owner", "tax_bucket", "current_value", "cost_basis", "return_override_pct", "spendable", "include_in_net_worth", "mortgage_origination", "mortgage_apr_pct", "mortgage_pi", "mortgage_term_years", "mortgage_in_spending"],
      plan.portfolios.map((p) => [
        p.id,
        p.name,
        p.kind,
        p.owner,
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
      ["id", "name", "kind", "owner", "balance", "apr_pct", "monthly_pi", "origination", "term_years", "include_in_spending"],
      (plan.liabilities ?? []).map((l) => [
        l.id,
        l.name,
        l.kind,
        l.owner,
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
      ["id", "name", "kind", "person", "monthly_today", "start", "end", "cola_pct", "tax_treatment", "ss_claim_age", "ss_pia", "va_rating"],
      plan.incomes.map((s) => [
        s.id,
        s.name,
        s.kind,
        s.person,
        s.monthlyAmount,
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
      ["id", "name", "monthly_today", "start", "end"],
      plan.spending.map((s) => [s.id, s.label, s.monthlyAmount, s.startDate, s.endDate]),
    ),
  );

  lines.push(
    ...section(
      "contributions",
      ["id", "label", "account_id", "account_name", "mode", "monthly_amount", "percent", "percent_of_income_id", "start", "end", "employer_match", "match_pct", "irs_cap", "end_at_retirement"],
      plan.contributions.map((c) => {
        const dest = plan.portfolios.find((p) => p.id === c.portfolioId);
        return [
          c.id,
          c.label,
          c.portfolioId,
          dest?.name ?? "",
          c.amountMode === "percent" ? "percent" : "fixed",
          c.amountMode === "percent" ? null : c.monthlyAmount,
          c.amountMode === "percent" ? c.percentOfIncome ?? null : null,
          c.percentOfIncomeId ?? null,
          c.startDate,
          c.endDate,
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
      stream.id,
      stream.name,
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
      phase.id,
      phase.label,
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
      rule.id,
      rule.label,
      rule.startDate,
      rule.endDate,
      resolved.start,
      resolved.end,
      windowWhy({
        retirement: Boolean(rule.endAtRetirement),
        tiedToStage: Boolean(rule.endWithStageId || (rule.amountMode === "percent" && rule.percentOfIncomeId)),
      }),
    ]);
  }
  lines.push(
    ...section(
      "windows",
      ["kind", "id", "name", "typed_start", "typed_end", "resolved_start", "resolved_end", "why"],
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

  const asOf = monthStart(plan.assumptions.asOfDate);
  sim.months.forEach((month, index) => {
    const date = month.date;
    const inflationIndex = (1 + mInf) ** index;
    const at = monthStart(date);
    for (const stream of plan.incomes) {
      const win = streamWindow(plan, stream);
      if (!inRange(at, win.start, win.end)) continue;
      const today = streamBenefitToday(plan, stream, at);
      const cola = streamColaAnnual(plan, stream, infA);
      const nominal = today * (1 + cola) ** calendarColaYears(asOf, at);
      if (Math.abs(nominal) < 0.005 && Math.abs(today) < 0.005) continue;
      const ss = stream.kind === "ss" && stream.ssPia != null && stream.ssClaimAge != null;
      const rating = vaRatingOf(stream);
      const va = stream.kind === "va" && rating != null;
      const pia = stream.ssPia ?? null;
      const factor = ss && pia ? ssBenefitFromPia(pia, stream.ssClaimAge ?? 67, stream.ssFra ?? 67) / pia : null;
      incomeRows.push([
        date,
        stream.id,
        stream.name,
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
      spendRows.push([date, phase.id, phase.label, amount]);
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
      if (due > 0) spendRows.push([date, p.id, `${p.name} mortgage`, due]);
      loanRows.push([date, p.id, "mortgage", parts.start, parts.interest, parts.principalPaid, parts.end, parts.inSpending]);
    }
    for (const l of plan.liabilities ?? []) {
      const parts = loanParts(l.monthlyPi, l.aprPct, l.termYears, l.originationDate, date, l.includeInSpending, true);
      if (!parts) continue;
      const due = liabilityPaymentDue(l, date);
      if (due > 0) spendRows.push([date, l.id, l.name, due]);
      loanRows.push([date, l.id, "liability", parts.start, parts.interest, parts.principalPaid, parts.end, parts.inSpending]);
    }
    const listedSpend = spendRows
      .filter((row) => row[0] === date)
      .reduce((sum, row) => sum + Number(row[3] ?? 0), 0);
    const unallocated = month.spending - listedSpend;
    if (unallocated > 0.5) {
      spendRows.push([
        date,
        "unallocated",
        "Unallocated surplus (no sweep account)",
        unallocated,
      ]);
    }
    homeRows.push(householdRow(plan, month, inflationIndex, ssShare, goalKey, audit, date));
  });

  lines.push(
    ...section(
      "month_account",
      ["date", "account_id", "account_name", "start_balance", "annual_return_pct", "growth", "contribution", "match", "withdrawal", "sweep", "end_balance", "residual", "spendable", "in_net_worth"],
      audit.accounts.map((row) => [
        row.date,
        row.accountId,
        row.accountName,
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
      ["date", "income_id", "name", "kind", "today_dollars", "source", "cola_pct_used", "nominal", "pia", "claim_age", "fra", "ss_factor", "va_rating", "va_spouse", "va_children_under_18", "va_table_amount"],
      incomeRows,
    ),
  );
  lines.push(...section("month_spending", ["date", "source_id", "name", "amount"], spendRows));
  lines.push(
    ...section(
      "month_contribution",
      ["date", "rule_id", "account_id", "mode", "income_dollars", "planned", "irs_limit", "catch_up", "invested", "match"],
      audit.contributions.map((row) => [
        row.date,
        row.ruleId,
        row.accountId,
        row.mode,
        row.incomeBase,
        row.planned,
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
      ["date", "account_id", "owner_age", "rmd_start_age", "uniform_lifetime_factor", "prior_dec_31_balance", "monthly_rmd", "status"],
      audit.rmds.map((row) => [
        row.date,
        row.accountId,
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
      ["date", "account_id", "basis_start", "basis_added", "taxable_earnings_withdrawn", "tax_free_basis_returned", "basis_end"],
      audit.annuities.map((row) => [
        row.date,
        row.accountId,
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
      ["date", "loan_id", "kind", "principal_start", "interest", "principal_paid", "principal_end", "counted_in_spending"],
      loanRows,
    ),
  );
  lines.push(
    ...section(
      "month_household",
      ["date", "primary_age", "spouse_age", "income", "tax", "spending", "employee_contributions", "employer_match", "withdrawals", "surplus", "guaranteed", "air", "spendable_end", "spendable_end_today", "net_worth_end", "assets_end", "liabilities_end", "identity_left", "identity_right", "residual", "residual_engine", "inflation_index", "ordinary_taxable", "social_security", "ss_taxable", "annuity_earnings", "tax_rate", "air_guaranteed", "air_withdrawals", "air_total", "spendable_from_accounts", "spendable_residual", "net_worth_from_parts", "net_worth_residual"],
      homeRows,
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
): (string | number | null)[] {
  const ss = month.incomeByKind.ss ?? 0;
  const ssTaxable = ss * ssShare;
  const ordinary = month.incomeTaxable - ssTaxable;
  const annuity = audit.annuityEarningsByDate[date] ?? 0;
  const employee = month.contributions - month.employerMatch;
  const left = month.income + month.withdrawals;
  const right = month.tax + month.spending + employee;
  const engineRight = month.tax + month.spending + month.contributions;
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
  return [
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
    left - engineRight,
    inflationIndex,
    ordinary,
    ss,
    ssTaxable,
    annuity,
    plan.assumptions.ordinaryTaxRatePct,
    retired ? month.guaranteed : null,
    retired ? month.withdrawals : null,
    retired ? month.guaranteed + month.withdrawals : null,
    spendableFrom,
    spendableFrom - month.spendableEnd,
    netFrom,
    netFrom - month.netWorthEnd,
  ];
}
