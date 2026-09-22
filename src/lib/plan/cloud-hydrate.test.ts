import { describe, expect, it } from "vitest";
import { pickDisplayedPlan } from "./cloud-hydrate";
import { createDefaultPlan } from "./defaults";
import type { PlanLibrary } from "./profile-store";
import type { Plan } from "./types";

function fatClient(): Plan {
  const p = createDefaultPlan();
  p.primary.name = "Client 2";
  p.portfolios = [
    {
      id: "a1",
      name: "TSP",
      kind: "tsp",
      owner: "primary",
      taxBucket: "pre_tax",
      currentValue: 400_000,
      returnPct: 7,
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  p.incomes = [{ ...p.incomes[0], name: "Boeing", monthlyAmount: 25_000 }];
  p.contributions = [
    {
      id: "c1",
      label: "TSP deferral",
      portfolioId: "a1",
      monthlyAmount: 2000,
      amountMode: "fixed",
      startDate: "2026-08-01",
      endDate: null,
    },
  ];
  return p;
}

function thinTest(): Plan {
  const p = createDefaultPlan();
  p.primary.name = "Test";
  p.portfolios = [
    {
      id: "t1",
      name: "One account",
      kind: "taxable",
      owner: "primary",
      taxBucket: "taxable",
      currentValue: 100,
      returnPct: 7,
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  p.incomes = [{ ...p.incomes[0], name: "One income", monthlyAmount: 10 }];
  p.contributions = [
    {
      id: "tc1",
      label: "One contribution",
      portfolioId: "t1",
      monthlyAmount: 1,
      amountMode: "fixed",
      startDate: "2026-08-01",
      endDate: null,
    },
  ];
  return p;
}

describe("pickDisplayedPlan — advisor isolation", () => {
  it("does not replace a thin active client with a heavier leftover local plan", () => {
    const test = thinTest();
    const client2 = fatClient();
    const library: PlanLibrary = {
      kind: "library",
      activeId: "test",
      profiles: [
        { id: "c2", name: "Client 2", plan: client2 },
        { id: "test", name: "test client", plan: test },
      ],
    };
    const shown = pickDisplayedPlan({
      local: client2,
      cloudPlan: test,
      library,
    });
    expect(shown.primary.name).toBe("Test");
    expect(shown.portfolios).toHaveLength(1);
    expect(shown.portfolios[0].name).toBe("One account");
    expect(shown.incomes[0].monthlyAmount).toBe(10);
    expect(shown.contributions).toHaveLength(1);
  });

  it("loads the active library client even when cloudPlan is the other household", () => {
    const test = thinTest();
    const client2 = fatClient();
    const library: PlanLibrary = {
      kind: "library",
      activeId: "test",
      profiles: [
        { id: "c2", name: "Client 2", plan: client2 },
        { id: "test", name: "test client", plan: test },
      ],
    };
    const shown = pickDisplayedPlan({
      local: client2,
      cloudPlan: client2,
      library,
    });
    expect(shown.primary.name).toBe("Test");
  });

  it("single household still prefers a heavier cloud plan", () => {
    const local = createDefaultPlan();
    const cloud = fatClient();
    const shown = pickDisplayedPlan({
      local,
      cloudPlan: cloud,
      library: null,
    });
    expect(shown.primary.name).toBe("Client 2");
    expect(shown.portfolios[0].currentValue).toBe(400_000);
  });
});
