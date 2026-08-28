import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createDefaultPlan, ensurePlan } from "./defaults";
import type {
  Assumptions,
  Child,
  ContributionRule,
  IncomeStream,
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

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      plan: createDefaultPlan(),
      setPlan: (plan) => set({ plan: ensurePlan(plan) }),
      patchAssumptions: (patch) =>
        set((s) => ({
          plan: { ...s.plan, assumptions: { ...s.plan.assumptions, ...patch } },
        })),
      patchPrimary: (patch) =>
        set((s) => ({ plan: { ...s.plan, primary: { ...s.plan.primary, ...patch } } })),
      patchSpouse: (patch) =>
        set((s) => ({ plan: { ...s.plan, spouse: { ...s.plan.spouse, ...patch } } })),
      addChild: (row) =>
        set((s) => ({ plan: { ...s.plan, children: [...s.plan.children, row] } })),
      updateChild: (id, patch) =>
        set((s) => ({
          plan: {
            ...s.plan,
            children: s.plan.children.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          },
        })),
      removeChild: (id) =>
        set((s) => ({
          plan: { ...s.plan, children: s.plan.children.filter((c) => c.id !== id) },
        })),
      updatePortfolio: (id, patch) =>
        set((s) => ({
          plan: {
            ...s.plan,
            portfolios: s.plan.portfolios.map((p) =>
              p.id === id ? { ...p, ...patch } : p,
            ),
          },
        })),
      addPortfolio: (row) =>
        set((s) => ({ plan: { ...s.plan, portfolios: [...s.plan.portfolios, row] } })),
      removePortfolio: (id) =>
        set((s) => ({
          plan: {
            ...s.plan,
            portfolios: s.plan.portfolios.filter((p) => p.id !== id),
            contributions: s.plan.contributions.filter((c) => c.portfolioId !== id),
            assumptions: {
              ...s.plan.assumptions,
              sweepPortfolioId:
                s.plan.assumptions.sweepPortfolioId === id
                  ? null
                  : s.plan.assumptions.sweepPortfolioId,
            },
          },
        })),
      updateContribution: (id, patch) =>
        set((s) => ({
          plan: {
            ...s.plan,
            contributions: s.plan.contributions.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          },
        })),
      addContribution: (row) =>
        set((s) => ({
          plan: { ...s.plan, contributions: [...s.plan.contributions, row] },
        })),
      removeContribution: (id) =>
        set((s) => ({
          plan: {
            ...s.plan,
            contributions: s.plan.contributions.filter((c) => c.id !== id),
          },
        })),
      updateIncome: (id, patch) =>
        set((s) => {
          const incomes = s.plan.incomes.map((c) => (c.id === id ? { ...c, ...patch } : c));
          const datePatch =
            patch.startDate !== undefined || patch.endDate !== undefined;
          const contributions = datePatch
            ? s.plan.contributions.map((c) => {
                if (c.amountMode !== "percent" || c.percentOfIncomeId !== id) {
                  return c;
                }
                return {
                  ...c,
                  startDate:
                    patch.startDate !== undefined ? patch.startDate : c.startDate,
                  endDate: patch.endDate !== undefined ? patch.endDate : c.endDate,
                };
              })
            : s.plan.contributions;
          return { plan: { ...s.plan, incomes, contributions } };
        }),
      addIncome: (row) =>
        set((s) => ({ plan: { ...s.plan, incomes: [...s.plan.incomes, row] } })),
      removeIncome: (id) =>
        set((s) => ({
          plan: { ...s.plan, incomes: s.plan.incomes.filter((c) => c.id !== id) },
        })),
      updateSpending: (id, patch) =>
        set((s) => ({
          plan: {
            ...s.plan,
            spending: s.plan.spending.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          },
        })),
      addSpending: (row) =>
        set((s) => ({ plan: { ...s.plan, spending: [...s.plan.spending, row] } })),
      removeSpending: (id) =>
        set((s) => ({
          plan: {
            ...s.plan,
            spending: s.plan.spending.filter((c) => c.id !== id),
          },
        })),
      reset: () => set({ plan: createDefaultPlan() }),
    }),
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