import { createDefaultPlan } from "./defaults.ts";
import type { IncomeStream, Plan } from "./types.ts";

/** True when Observe or Orient already has something a demo would erase. */
export function planHasEntries(plan: Plan): boolean {
  if (plan.primary.name.trim() || plan.primary.birthDate.trim()) return true;
  if (plan.spouse.name.trim() || plan.spouse.birthDate.trim()) return true;
  if (plan.children.length > 0) return true;
  if (plan.portfolios.length > 0) return true;
  if ((plan.liabilities ?? []).length > 0) return true;
  if (plan.incomes.length > 0) return true;
  if (plan.spending.length > 0) return true;
  if (plan.contributions.length > 0) return true;
  return false;
}

function wage(
  id: string,
  name: string,
  kind: IncomeStream["kind"],
  monthlyAmount: number,
  startDate: string,
  endDate: string | null,
  person: IncomeStream["person"],
  taxTreatment: IncomeStream["taxTreatment"] = "ordinary",
): IncomeStream {
  return {
    id,
    name,
    kind,
    monthlyAmount,
    startDate,
    endDate,
    colaPct: null,
    taxTreatment,
    person,
  };
}

/**
 * Jordan Hale is a 29-year-old Air Force captain, O-3 over 8.
 * Riley Hale teaches school in Hampton, Virginia.
 * Same three children. Balances and pay are a young household, not a 40-year-old one.
 *
 * 2026 DFAS basic pay, O-3 over 8: $8,125.50 a month.
 * Officer BAS 2026: $328 a month, tax-free.
 * O-4 in June 2028, at 10 years. O-5 in June 2034, at 16 years.
 * 2026 DFAS: O-5 over 16 is $11,391. O-5 over 18 is $11,714.
 * High-3 is the last 36 months, $11,606. BRS retired pay is 40% of that, $4,643.
 * Langley BAH 2026, with dependents: O-3 $2,475, O-4 $2,835, O-5 $3,099.
 * Commissioned June 2018, so this career is BRS: 2% a year, not High-3's 2.5%.
 * Military retirement is June 2038, age 41. That is a paycheck, not the household retirement.
 * Invested accounts are modest there: the TSP at 5% of basic pay, plus the match.
 * A second career pays $7,500 a month and runs to age 60.
 * The household plans to retire in June 2057, age 60, with a $1.8 million goal.
 * On the modest savings rate they are short. About $800 more a month, or retiring at 65, meets it.
 * Cash earns 0.5%. Only money they actually contribute gets the market return.
 */
export function demoPlan(): Plan {
  const base = createDefaultPlan();
  return {
    ...base,
    primary: { name: "Jordan Hale", birthDate: "1997-06-12" },
    spouse: { name: "Riley Hale", birthDate: "1998-04-08" },
    children: [
      { id: "demo-sam", name: "Sam Hale", birthDate: "2020-05-14" },
      { id: "demo-quinn", name: "Quinn Hale", birthDate: "2022-09-02" },
      { id: "demo-avery", name: "Avery Hale", birthDate: "2024-08-19" },
    ],
    assumptions: {
      ...base.assumptions,
      asOfDate: "2026-11-01",
      asOfPinned: true,
      inflationPct: 2.5,
      defaultColaPct: 2.5,
      defaultReturnPct: 7,
      retirementGoalDate: "2057-06-01",
      careerEndDate: "2057-06-01",
      militaryRetireDate: "2038-06-01",
      nestEggGoal: 1_800_000,
      incomeGoalMonthly: null,
      goalMode: "nest",
      sweepPortfolioId: "demo-savings",
    },
    portfolios: [
      {
        id: "demo-checking",
        name: "Checking",
        kind: "cash",
        owner: "joint",
        currentValue: 4_800,
        returnPct: 0.5,
        taxBucket: "none",
        spendable: true,
        includeInNetWorth: true,
        institutionId: null,
        institutionName: "",
      },
      {
        id: "demo-savings",
        name: "Savings",
        kind: "cash",
        owner: "joint",
        currentValue: 12_000,
        returnPct: 0.5,
        taxBucket: "none",
        spendable: true,
        includeInNetWorth: true,
        institutionId: null,
        institutionName: "",
      },
      {
        id: "demo-tsp",
        name: "Jordan TSP",
        kind: "tsp",
        owner: "primary",
        currentValue: 36_000,
        returnPct: null,
        taxBucket: "pre_tax",
        spendable: true,
        includeInNetWorth: true,
        institutionId: null,
        institutionName: "",
      },
      {
        id: "demo-tsp-roth",
        name: "Jordan Roth TSP",
        kind: "tsp_roth",
        owner: "primary",
        currentValue: 8_500,
        returnPct: null,
        taxBucket: "roth",
        spendable: true,
        includeInNetWorth: true,
        institutionId: null,
        institutionName: "",
      },
      {
        id: "demo-401k",
        name: "Jordan 401(k)",
        kind: "401k",
        owner: "primary",
        currentValue: 0,
        returnPct: null,
        taxBucket: "pre_tax",
        spendable: true,
        includeInNetWorth: true,
        institutionId: null,
        institutionName: "",
      },
      {
        id: "demo-roth",
        name: "Riley Roth IRA",
        kind: "roth_ira",
        owner: "spouse",
        currentValue: 7_200,
        returnPct: null,
        taxBucket: "roth",
        spendable: true,
        includeInNetWorth: true,
        institutionId: null,
        institutionName: "",
      },
      {
        id: "demo-home",
        name: "Home",
        kind: "real_estate",
        owner: "joint",
        currentValue: 340_000,
        returnPct: null,
        taxBucket: "none",
        spendable: false,
        includeInNetWorth: true,
        institutionId: null,
        institutionName: "",
        mortgage: {
          originationDate: "2023-08-01",
          aprPct: 6.5,
          monthlyPi: 2040,
          termYears: 30,
          includeInSpending: true,
          associated: true,
          institutionId: null,
          institutionName: "",
        },
      },
    ],
    liabilities: [
      {
        id: "demo-car",
        name: "Car loan",
        kind: "car",
        balance: 16_200,
        aprPct: 6.2,
        monthlyPi: 365,
        originationDate: "2025-03-01",
        termYears: 5,
        includeInSpending: true,
        owner: "joint",
        institutionId: null,
        institutionName: "",
      },
    ],
    incomes: [
      wage("demo-o3", "Jordan basic pay, O-3", "military", 8126, "2018-06-01", "2028-05-01", "primary"),
      wage("demo-o4", "Jordan basic pay, O-4", "military", 9420, "2028-06-01", "2034-05-01", "primary"),
      wage("demo-o5", "Jordan basic pay, O-5", "military", 11391, "2034-06-01", "2036-05-01", "primary"),
      wage("demo-o5-18", "Jordan basic pay, O-5", "military", 11714, "2036-06-01", "2038-05-01", "primary"),
      wage("demo-bah", "BAH, Langley", "allowance", 2475, "2018-06-01", "2028-05-01", "primary", "tax_free"),
      wage("demo-bah-o4", "BAH, Langley, O-4", "allowance", 2835, "2028-06-01", "2034-05-01", "primary", "tax_free"),
      wage("demo-bah-o5", "BAH, Langley, O-5", "allowance", 3099, "2034-06-01", "2038-05-01", "primary", "tax_free"),
      wage("demo-bas", "BAS", "allowance", 328, "2018-06-01", "2038-05-01", "primary", "tax_free"),
      wage("demo-second", "Jordan second career", "salary", 7500, "2038-06-01", "2057-05-01", "primary"),
      wage("demo-riley-pay", "Riley teacher pay", "salary", 4200, "2020-08-01", "2057-05-01", "spouse"),
      wage("demo-retired", "Jordan military retired pay", "military", 4643, "2038-06-01", null, "primary"),
      wage("demo-riley-pension", "Riley teacher pension", "pension", 1800, "2057-06-01", null, "spouse"),
      {
        id: "demo-jordan-ss",
        name: "Jordan Social Security",
        kind: "ss",
        monthlyAmount: 2200,
        startDate: "2064-06-12",
        endDate: null,
        colaPct: null,
        taxTreatment: "ss",
        person: "primary",
        ssPia: 2200,
        ssClaimAge: 67,
        ssFra: 67,
        ssEstimated: false,
      },
    ],
    spending: [
      {
        id: "demo-spend",
        label: "Household",
        monthlyAmount: 8_600,
        startDate: "2026-11-01",
        endDate: null,
      },
    ],
    contributions: [
      contrib("demo-tsp-o3", "TSP, 5% of O-3 pay", "demo-tsp", 406, "2026-11-01", "2028-05-01", true),
      contrib("demo-tsp-o4", "TSP, 5% of O-4 pay", "demo-tsp", 471, "2028-06-01", "2034-05-01", true),
      contrib("demo-tsp-o5", "TSP, 5% of O-5 pay", "demo-tsp", 570, "2034-06-01", "2036-05-01", true),
      contrib("demo-tsp-o5b", "TSP, 5% of O-5 pay", "demo-tsp", 586, "2036-06-01", "2038-05-01", true),
      contrib("demo-401k", "Jordan 401(k)", "demo-401k", 200, "2038-06-01", "2056-12-01", true, 50),
      contrib("demo-riley-roth", "Riley Roth IRA", "demo-roth", 100, "2026-11-01", "2056-12-01", false),
    ],
    confirmations: [],
  };
}

function contrib(
  id: string,
  label: string,
  portfolioId: string,
  monthlyAmount: number,
  startDate: string,
  endDate: string,
  match: boolean,
  matchPct = 100,
): Plan["contributions"][number] {
  return {
    id,
    label,
    portfolioId,
    monthlyAmount,
    startDate,
    endDate,
    amountMode: "fixed",
    percentOfIncome: null,
    percentOfIncomeId: null,
    employerMatch: match,
    employerMatchPct: match ? matchPct : 0,
    capToIrsLimit: false,
    capPerson: portfolioId === "demo-roth" ? "spouse" : "primary",
    endAtRetirement: false,
  };
}