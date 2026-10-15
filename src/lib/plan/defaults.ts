import type { Plan, Portfolio } from "./types";
import { coerceIsoDate, todayIso, validIso } from "./dates.ts";
import { institutionFields } from "./institutions.ts";
import { isPayCadence } from "./pay-cadence.ts";

/**
 * Blank household. Observe accounts, income stages, and contribution rules
 * are typed in — MACH does not invent them.
 */
export function createDefaultPlan(): Plan {
  const asOf = todayIso();
  return {
    primary: { name: "", birthDate: "" },
    spouse: { name: "", birthDate: "" },
    children: [],
    assumptions: {
      asOfDate: asOf,
      inflationPct: 2.5,
      defaultColaPct: 2.5,
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
      incomeGoalMonthly: null,
      goalMode: "nest",
    },
    stages: [],
    portfolios: [],
    liabilities: [],
    contributions: [],
    incomes: [],
    spending: [],
  };
}

export function ensurePlan(plan: Plan): Plan {
  const next: Plan = {
    ...plan,
    children: Array.isArray(plan.children) ? plan.children : [],
    portfolios: Array.isArray(plan.portfolios) ? plan.portfolios : [],
    liabilities: Array.isArray(plan.liabilities) ? plan.liabilities : [],
    contributions: Array.isArray(plan.contributions) ? plan.contributions : [],
    incomes: Array.isArray(plan.incomes) ? plan.incomes : [],
    spending: Array.isArray(plan.spending) ? plan.spending : [],
  };
  if (!validIso(next.assumptions?.asOfDate)) {
    next.assumptions = { ...next.assumptions, asOfDate: todayIso() };
  }
  const asOf = next.assumptions.asOfDate;
  next.incomes = next.incomes.map((s) => ({
    ...s,
    startDate: coerceIsoDate(s.startDate) || s.startDate || asOf,
    endDate: s.endDate ? coerceIsoDate(s.endDate) || s.endDate : null,
    monthlyAmount: Number.isFinite(s.monthlyAmount) ? s.monthlyAmount : 0,
    payCadence: isPayCadence(s.payCadence) ? s.payCadence : undefined,
    payAmount: s.payAmount != null && Number.isFinite(s.payAmount) ? s.payAmount : undefined,
  }));
  next.portfolios = next.portfolios.map((p) => {
    const legacy = (p as { endAtChildAge23?: boolean }).endAtChildAge23 === true;
    const { endAtChildAge23: _legacyAge, ...rest } = p as Portfolio & {
      endAtChildAge23?: boolean;
    };
    const raw = rest.sunsetAge;
    const sunsetAge =
      rest.kind === "529"
        ? raw != null && Number.isFinite(Number(raw)) && Number(raw) > 0
          ? Math.min(99, Math.round(Number(raw)))
          : legacy
            ? 23
            : undefined
        : undefined;
    return {
      ...rest,
      ...institutionFields(rest.institutionId, rest.institutionName),
      costBasis:
        rest.kind === "annuity"
          ? Number.isFinite(rest.costBasis as number)
            ? Number(rest.costBasis)
            : 0
          : rest.costBasis ?? null,
      mortgage: rest.mortgage
        ? {
            ...rest.mortgage,
            ...institutionFields(rest.mortgage.institutionId, rest.mortgage.institutionName),
          }
        : rest.mortgage ?? null,
      sunsetAge,
    };
  });
  next.liabilities = next.liabilities.map((l) => ({
    ...l,
    ...institutionFields(l.institutionId, l.institutionName),
  }));
  next.noLiabilities = next.liabilities.length === 0 && plan.noLiabilities === true;
  next.contributions = next.contributions.map((c) => ({
    ...c,
    capToIrsLimit: Boolean(c.capToIrsLimit),
    startDate: coerceIsoDate(c.startDate) || c.startDate,
    endDate: c.endDate ? coerceIsoDate(c.endDate) || c.endDate : null,
    stopDate: c.stopDate ? coerceIsoDate(c.stopDate) || c.stopDate : null,
    payCadence: isPayCadence(c.payCadence) ? c.payCadence : undefined,
    payAmount: c.payAmount != null && Number.isFinite(c.payAmount) ? c.payAmount : undefined,
  }));
  next.spending = next.spending.map((p) => ({
    ...p,
    startDate: coerceIsoDate(p.startDate) || p.startDate,
    endDate: p.endDate ? coerceIsoDate(p.endDate) || p.endDate : null,
  }));
  next.confirmations = Array.isArray(plan.confirmations)
    ? plan.confirmations.filter(
        (row) =>
          row &&
          typeof row.id === "string" &&
          row.id.length > 0 &&
          typeof row.fingerprint === "string",
      )
    : [];
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
  if (next.assumptions.incomeGoalMonthly == null || !Number.isFinite(next.assumptions.incomeGoalMonthly)) {
    next.assumptions = { ...next.assumptions, incomeGoalMonthly: null };
  } else if (next.assumptions.incomeGoalMonthly <= 0) {
    next.assumptions = { ...next.assumptions, incomeGoalMonthly: null };
  }
  if (next.assumptions.goalMode !== "income") {
    next.assumptions = { ...next.assumptions, goalMode: "nest" };
  }
  if (
    next.assumptions.defaultColaPct == null ||
    !Number.isFinite(next.assumptions.defaultColaPct)
  ) {
    next.assumptions = { ...next.assumptions, defaultColaPct: 2.5 };
  }
  return next;
}

/** @deprecated use ensurePlan */
export function ensureStages(plan: Plan): Plan {
  return ensurePlan(plan);
}

export function clonePlan(plan: Plan): Plan {
  try {
    return ensurePlan(structuredClone(plan));
  } catch {
    return ensurePlan(JSON.parse(JSON.stringify(plan)) as Plan);
  }
}
