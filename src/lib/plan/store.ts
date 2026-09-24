import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createDefaultPlan, ensurePlan } from "./defaults";
import { todayIso } from "./dates";
import type {
  Assumptions,
  Child,
  ContributionRule,
  IncomeStream,
  Liability,
  Plan,
  Portfolio,
  SpendingPhase,
} from "./types";

interface PlanState {
  plan: Plan;
  setPlan: (plan: Plan) => void;
  patchAssumptions: (patch: Partial<Assumptions>) => void;
  patchPrimary: (patch: Partial<Plan["primary"]>) => void;
  patchSpouse: (patch: Partial<Plan["spouse"]>) => void;
  addChild: (row: Child) => void;
  updateChild: (id: string, patch: Partial<Child>) => void;
  removeChild: (id: string) => void;
  updatePortfolio: (id: string, patch: Partial<Portfolio>) => void;
  addPortfolio: (row: Portfolio) => void;
  removePortfolio: (id: string) => void;
  updateLiability: (id: string, patch: Partial<Liability>) => void;
  addLiability: (row: Liability) => void;
  removeLiability: (id: string) => void;
  updateContribution: (id: string, patch: Partial<ContributionRule>) => void;
  addContribution: (row: ContributionRule) => void;
  removeContribution: (id: string) => void;
  updateIncome: (id: string, patch: Partial<IncomeStream>) => void;
  addIncome: (row: IncomeStream) => void;
  removeIncome: (id: string) => void;
  updateSpending: (id: string, patch: Partial<SpendingPhase>) => void;
  addSpending: (row: SpendingPhase) => void;
  removeSpending: (id: string) => void;
  reset: () => void;
}

function stampAsOf(plan: Plan): Plan {
  if (plan.assumptions.asOfPinned) return plan;
  const today = todayIso();
  if (plan.assumptions.asOfDate === today) return plan;
  return {
    ...plan,
    assumptions: { ...plan.assumptions, asOfDate: today },
  };
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => {
      const edit = (recipe: (plan: Plan) => Plan) =>
        set((s) => ({ plan: stampAsOf(recipe(s.plan)) }));
      return {
        plan: createDefaultPlan(),
        setPlan: (plan) => set({ plan: ensurePlan(plan) }),
        patchAssumptions: (patch) =>
          set((s) => {
            const keys = Object.keys(patch);
            const onlyView = keys.length > 0 && keys.every((key) => key === "dollars");
            const settingAsOf = Object.prototype.hasOwnProperty.call(patch, "asOfDate");
            const plan = {
              ...s.plan,
              assumptions: {
                ...s.plan.assumptions,
                ...patch,
                ...(settingAsOf ? { asOfPinned: true } : {}),
              },
            };
            return { plan: onlyView || settingAsOf ? plan : stampAsOf(plan) };
          }),
        patchPrimary: (patch) =>
          edit((plan) => ({ ...plan, primary: { ...plan.primary, ...patch } })),
        patchSpouse: (patch) =>
          edit((plan) => ({ ...plan, spouse: { ...plan.spouse, ...patch } })),
        addChild: (row) => edit((plan) => ({ ...plan, children: [...plan.children, row] })),
        updateChild: (id, patch) =>
          edit((plan) => ({
            ...plan,
            children: plan.children.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          })),
        removeChild: (id) =>
          edit((plan) => ({
            ...plan,
            children: plan.children.filter((c) => c.id !== id),
          })),
        updatePortfolio: (id, patch) =>
          edit((plan) => ({
            ...plan,
            portfolios: plan.portfolios.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          })),
        addPortfolio: (row) =>
          edit((plan) => ({ ...plan, portfolios: [...plan.portfolios, row] })),
        removePortfolio: (id) =>
          edit((plan) => ({
            ...plan,
            portfolios: plan.portfolios.filter((p) => p.id !== id),
            contributions: plan.contributions.filter((c) => c.portfolioId !== id),
            assumptions: {
              ...plan.assumptions,
              sweepPortfolioId:
                plan.assumptions.sweepPortfolioId === id
                  ? null
                  : plan.assumptions.sweepPortfolioId,
            },
          })),
        updateLiability: (id, patch) =>
          edit((plan) => ({
            ...plan,
            liabilities: (plan.liabilities ?? []).map((l) =>
              l.id === id ? { ...l, ...patch } : l,
            ),
          })),
        addLiability: (row) =>
          edit((plan) => ({
            ...plan,
            liabilities: [...(plan.liabilities ?? []), row],
          })),
        removeLiability: (id) =>
          edit((plan) => ({
            ...plan,
            liabilities: (plan.liabilities ?? []).filter((l) => l.id !== id),
          })),
        updateContribution: (id, patch) =>
          edit((plan) => ({
            ...plan,
            contributions: plan.contributions.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          })),
        addContribution: (row) =>
          edit((plan) => ({ ...plan, contributions: [...plan.contributions, row] })),
        removeContribution: (id) =>
          edit((plan) => ({
            ...plan,
            contributions: plan.contributions.filter((c) => c.id !== id),
          })),
        updateIncome: (id, patch) =>
          edit((plan) => {
            const incomes = plan.incomes.map((c) => (c.id === id ? { ...c, ...patch } : c));
            const datePatch = patch.startDate !== undefined || patch.endDate !== undefined;
            const contributions = datePatch
              ? plan.contributions.map((c) => {
                  if (c.amountMode !== "percent" || c.percentOfIncomeId !== id) return c;
                  return {
                    ...c,
                    startDate: patch.startDate !== undefined ? patch.startDate : c.startDate,
                    endDate: patch.endDate !== undefined ? patch.endDate : c.endDate,
                  };
                })
              : plan.contributions;
            return { ...plan, incomes, contributions };
          }),
        addIncome: (row) => edit((plan) => ({ ...plan, incomes: [...plan.incomes, row] })),
        removeIncome: (id) =>
          edit((plan) => ({
            ...plan,
            incomes: plan.incomes.filter((c) => c.id !== id),
          })),
        updateSpending: (id, patch) =>
          edit((plan) => ({
            ...plan,
            spending: plan.spending.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          })),
        addSpending: (row) =>
          edit((plan) => ({ ...plan, spending: [...plan.spending, row] })),
        removeSpending: (id) =>
          edit((plan) => ({
            ...plan,
            spending: plan.spending.filter((c) => c.id !== id),
          })),
        reset: () => set({ plan: createDefaultPlan() }),
      };
    },
    {
      name: "mach-plan-v4",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ plan: s.plan }),
      merge: (persisted, current) => {
        const p = persisted as { plan?: Plan } | undefined;
        if (!p?.plan) return current;
        return { ...current, plan: ensurePlan({ ...current.plan, ...p.plan }) };
      },
    },
  ),
);

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
