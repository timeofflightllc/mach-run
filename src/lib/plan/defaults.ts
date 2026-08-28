import type { Plan } from "./types";
import { coerceIsoDate } from "./dates.ts";

/**
 * Blank household. Observe accounts, income stages, and contribution rules
 * are typed in — MACH does not invent them.
 */
export function createDefaultPlan(): Plan {
  return {
    primary: { name: "", birthDate: "" },
    spouse: { name: "", birthDate: "" },
    children: [],
    assumptions: {
      asOfDate: "2026-08-01",
      inflationPct: 2.5,
      defaultReturnPct: 7,
      ordinaryTaxRatePct: 22,
      ssTaxablePct: 85,
      projectionEndAge: 95,
      careerEndDate: "2036-09-01",
      militaryRetireDate: "2026-09-01",
      sweepPortfolioId: null,
      dollars: "real",
      retirementGoalDate: null,
      nestEggGoal: null,
    },
    stages: [],
    portfolios: [],
    contributions: [],
    incomes: [
      {
        id: "inc-1",
        name: "",
        kind: "salary",
        monthlyAmount: 0,
        startDate: "2026-08-01",
        endDate: null,
        colaPct: 0,
        taxTreatment: "ordinary",
        person: "household",
      },
    ],
    spending: [
      {
        id: "sp-1",
        label: "Household spending",
        monthlyAmount: 8500,
        startDate: "2026-08-01",
        endDate: null,
      },
    ],
  };
}

export function ensurePlan(plan: Plan): Plan {
  const next: Plan = {
    ...plan,
    children: Array.isArray(plan.children) ? plan.children : [],
    portfolios: Array.isArray(plan.portfolios) ? plan.portfolios : [],
    contributions: Array.isArray(plan.contributions) ? plan.contributions : [],
    incomes: Array.isArray(plan.incomes) ? plan.incomes : [],
    spending: Array.isArray(plan.spending) ? plan.spending : [],
  };
  const asOf = next.assumptions?.asOfDate ?? "2026-08-01";
  next.incomes = next.incomes.map((s) => ({
    ...s,
    startDate: coerceIsoDate(s.startDate) || s.startDate || asOf,
    endDate: s.endDate ? coerceIsoDate(s.endDate) || s.endDate : null,
    monthlyAmount: Number.isFinite(s.monthlyAmount) ? s.monthlyAmount : 0,
  }));
  next.portfolios = next.portfolios.map((p) => ({
    ...p,
    costBasis:
      p.kind === "annuity"
        ? Number.isFinite(p.costBasis as number)
          ? Number(p.costBasis)
          : 0
        : p.costBasis ?? null,
  }));
  next.contributions = next.contributions.map((c) => ({
    ...c,
    capToIrsLimit: Boolean(c.capToIrsLimit),
    startDate: coerceIsoDate(c.startDate) || c.startDate,
    endDate: c.endDate ? coerceIsoDate(c.endDate) || c.endDate : null,
  }));
  next.spending = next.spending.map((p) => ({
    ...p,
    startDate: coerceIsoDate(p.startDate) || p.startDate,
    endDate: p.endDate ? coerceIsoDate(p.endDate) || p.endDate : null,
  }));
  const ids = new Set(next.portfolios.map((p) => p.id));
  if (next.assumptions.sweepPortfolioId && !ids.has(next.assumptions.sweepPortfolioId)) {
    next.assumptions = { ...next.assumptions, sweepPortfolioId: null };
  }
  if (next.assumptions.retirementGoalDate === undefined) {
    next.assumptions = { ...next.assumptions, retirementGoalDate: null };
  }
  if (next.assumptions.nestEggGoal === undefined) {
    next.assumptions = { ...next.assumptions, nestEggGoal: null };
  }
  return next;
}

/** @deprecated use ensurePlan */
export function ensureStages(plan: Plan): Plan {
  return ensurePlan(plan);
}
