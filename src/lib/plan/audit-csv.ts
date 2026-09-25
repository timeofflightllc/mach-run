import { inRange, monthStart, yearlyRateToMonthly } from "./dates.ts";
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
  ["residual_engine", "income + withdrawals − tax − spending − contributions. Contributions here include employee dollars, sweep, and match. Match is on both sides, so it cancels. This is the ledger identity."],
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

  sim.months.forEach((month, index) => {
    const date = month.date;
    const inflationIndex = (1 + mInf) ** index;
    const at = monthStart(date);
    for (const stream of plan.incomes) {
      const win = streamWindow(plan, stream);
      if (!inRange(at, win.start, win.end)) continue;
      const today = streamBenefitToday(plan, stream, at);
      const cola = streamColaAnnual(plan, stream, infA);
      const nominal = today * (1 + yearlyRateToMonthly(cola)) ** index;
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
