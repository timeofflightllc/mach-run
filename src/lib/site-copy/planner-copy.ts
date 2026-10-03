import type { SiteCopy } from "./types";

/** Desk-editable calculator instructions. Live numbers stay in code via {spendable}, {net}, {return}. */
export type PlannerCopy = {
  familyHint: string;
  assumptionsHint: string;
  assetsHint: string;
  assetsBody: string;
  liabilitiesHint: string;
  liabilitiesBody: string;
  incomeHint: string;
  incomeBody: string;
  spendingHint: string;
  spendingBody: string;
  contributionsHint: string;
  contributionsP1: string;
  contributionsP2: string;
  contributionsP3: string;
};

export const PLANNER_COPY_KEYS = [
  "familyHint",
  "assumptionsHint",
  "assetsHint",
  "assetsBody",
  "liabilitiesHint",
  "liabilitiesBody",
  "incomeHint",
  "incomeBody",
  "spendingHint",
  "spendingBody",
  "contributionsHint",
  "contributionsP1",
  "contributionsP2",
  "contributionsP3",
] as const satisfies readonly (keyof PlannerCopy)[];

export const DEFAULT_PLANNER_COPY: PlannerCopy = {
  familyHint: "Names and birthdays for the household.",
  assumptionsHint: "As-of date, longevity, returns, retirement goal, and where leftover dollars go.",
  assetsHint: "The accounts you have today, and what each one is worth.",
  assetsBody:
    "Spendable (retirement) {spendable} · Net worth {net}. These accounts are the only ones Orient can sweep into and Decide can contribute to. Per-account return blank uses the global {return}% nominal.",
  liabilitiesHint: "What you owe, apart from a mortgage already on a house.",
  liabilitiesBody:
    "Car, student, HELOC, personal, credit card. Remaining principal comes off net worth. House mortgages stay on the real estate account above — do not enter those here.",
  incomeHint: "Each paycheck, what kind it is, and how long it lasts.",
  incomeBody:
    "Each block is one paycheck over a specific stretch of time. Name it, set the monthly amount, set start and end. Tell MACH RUN what kind of income it is — earned (salary, bonus, other income) or guaranteed (pension, military retired pay, VA, Social Security, other retirement). Blank end date = it keeps paying indefinitely.",
  spendingHint: "What the household spends in a normal month.",
  spendingBody:
    "Phases are in today's dollars and inflate with the assumption rate. Overlapping phases add together. Add a second phase when spending steps up or down.",
  contributionsHint: "How much goes into which account, and when it stops.",
  contributionsP1:
    "Tell MACH RUN how much to put into which account, and when. It only invests what’s left after taxes and spending — it will not invent extra cash — so ensure your income and spending is accurate.",
  contributionsP2:
    "If your 401(k) or TSP has a company match, select that below. That match is free money on top, not from your paycheck.",
  contributionsP3:
    "When the paycheck cannot cover every contribution, rules are paid tax-qualified first, then taxable. Inside each of those groups, rules are paid in the order they are listed.",
};

export function serializePlannerCopy(copy: PlannerCopy): string {
  return JSON.stringify(copy);
}

export function parsePlannerCopy(raw: string): PlannerCopy {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PLANNER_COPY };
  }
  const src = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const next = { ...DEFAULT_PLANNER_COPY };
  for (const key of PLANNER_COPY_KEYS) {
    const value = src[key];
    if (typeof value === "string") {
      if (key === "familyHint" && value === "Who is in the household, and when you want to retire.") continue;
      next[key] = value;
    }
  }
  return next;
}

export function plannerFromSiteCopy(site: SiteCopy): PlannerCopy {
  const page = site.pages.find((row) => row.slug === "planner");
  if (!page?.body.trim()) return { ...DEFAULT_PLANNER_COPY };
  return parsePlannerCopy(page.body);
}

export function fillPlanner(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(spendable|net|return)\}/g, (_, key: string) => vars[key] ?? "");
}
