import { describe, expect, it } from "vitest";
import { pickDisplayedPlan, planForSignedInUser } from "./cloud-hydrate";
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
  p.incomes = [
    {
      id: "inc-boeing",
      name: "Boeing",
      kind: "salary",
      monthlyAmount: 25_000,
      startDate: p.assumptions.asOfDate,
      endDate: null,
      colaPct: null,
      taxTreatment: "ordinary",
      person: "household",
    },
  ];
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
  p.incomes = [
    {
      id: "inc-one",
      name: "One income",
      kind: "salary",
      monthlyAmount: 10,
      startDate: p.assumptions.asOfDate,
      endDate: null,
      colaPct: null,
      taxTreatment: "ordinary",
      person: "household",
    },
  ];
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

describe("planForSignedInUser — new accounts stay empty", () => {
  it("a new account with no cloud plan ignores a leftover local plan", () => {
    const leftover = fatClient();
    leftover.primary.name = "Cary";
    const shown = planForSignedInUser({
      local: leftover,
      cloudPlan: null,
      library: null,
      switchedAccount: true,
    });
    expect(shown.primary.name).toBe("");
    expect(shown.spouse.name).toBe("");
    expect(shown.children).toHaveLength(0);
    expect(shown.portfolios).toHaveLength(0);
    expect(shown.incomes).toHaveLength(0);
    expect(shown.spending).toHaveLength(0);
    expect(shown.contributions).toHaveLength(0);
    expect(shown.liabilities ?? []).toHaveLength(0);
  });

  it("a new account stays empty even if the browser did not detect a switch", () => {
    const shown = planForSignedInUser({
      local: fatClient(),
      cloudPlan: null,
      library: null,
      switchedAccount: false,
    });
    expect(shown.primary.name).toBe("");
    expect(shown.portfolios).toHaveLength(0);
  });

  it("a returning account after a switch shows its own cloud plan, not the leftover", () => {
    const leftover = fatClient();
    leftover.primary.name = "Cary";
    const own = thinTest();
    const shown = planForSignedInUser({
      local: leftover,
      cloudPlan: own,
      library: null,
      switchedAccount: true,
    });
    expect(shown.primary.name).toBe("Test");
    expect(shown.portfolios).toHaveLength(1);
  });
});
