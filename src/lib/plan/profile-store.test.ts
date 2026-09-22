import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultPlan } from "./defaults";
import { useProfileStore } from "./profile-store";

function twoClients() {
  const a = createDefaultPlan();
  a.primary.name = "Alpha";
  a.incomes[0].monthlyAmount = 1111;
  const b = createDefaultPlan();
  b.primary.name = "Bravo";
  b.incomes[0].monthlyAmount = 2222;
  useProfileStore.setState({
    profiles: [
      { id: "p1", name: "Client 1", plan: a },
      { id: "p2", name: "Client 2", plan: b },
    ],
    activeId: "p1",
  });
}

describe("advisor profile remove", () => {
  beforeEach(() => {
    useProfileStore.setState({ profiles: [], activeId: "" });
  });

  it("removes a second client and keeps the other active", () => {
    twoClients();
    const next = useProfileStore.getState().remove("p2", createDefaultPlan());
    expect(next).not.toBeNull();
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual(["p1"]);
    expect(useProfileStore.getState().activeId).toBe("p1");
  });

  it("switches away when the active client is deleted", () => {
    twoClients();
    const next = useProfileStore.getState().remove("p1", createDefaultPlan());
    expect(next).not.toBeNull();
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual(["p2"]);
    expect(useProfileStore.getState().activeId).toBe("p2");
  });

  it("refuses to delete the last profile", () => {
    useProfileStore.setState({
      profiles: [{ id: "only", name: "Solo", plan: createDefaultPlan() }],
      activeId: "only",
    });
    const next = useProfileStore.getState().remove("only", createDefaultPlan());
    expect(next).toBeNull();
    expect(useProfileStore.getState().profiles).toHaveLength(1);
  });
});

describe("advisor profile isolation", () => {
  beforeEach(() => {
    useProfileStore.setState({ profiles: [], activeId: "" });
  });

  it("addProfile starts blank and does not copy the current household", () => {
    twoClients();
    useProfileStore.setState({ activeId: "p2" });
    const current = useProfileStore.getState().profiles.find((p) => p.id === "p2")!.plan;
    const next = useProfileStore.getState().addProfile(current, "test client");
    expect(next.primary.name).toBe("");
    expect(next.incomes[0]?.monthlyAmount ?? 0).toBe(0);
    const p2 = useProfileStore.getState().profiles.find((p) => p.id === "p2")!;
    expect(p2.plan.primary.name).toBe("Bravo");
    expect(p2.plan.incomes[0].monthlyAmount).toBe(2222);
    next.primary.name = "HACK";
    expect(p2.plan.primary.name).toBe("Bravo");
  });

  it("switchTo keeps each client's numbers", () => {
    twoClients();
    const fromP1 = useProfileStore.getState().profiles.find((p) => p.id === "p1")!.plan;
    const loaded = useProfileStore.getState().switchTo("p2", fromP1);
    expect(loaded?.primary.name).toBe("Bravo");
    expect(useProfileStore.getState().profiles.find((p) => p.id === "p1")?.plan.primary.name).toBe(
      "Alpha",
    );
    const back = useProfileStore.getState().switchTo("p1", loaded!);
    expect(back?.primary.name).toBe("Alpha");
    expect(useProfileStore.getState().profiles.find((p) => p.id === "p2")?.plan.primary.name).toBe(
      "Bravo",
    );
  });

  it("switchTo does not copy Client 2 accounts into a thin test client", () => {
    const c2 = createDefaultPlan();
    c2.primary.name = "Client 2";
    c2.portfolios = [
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
    const test = createDefaultPlan();
    test.primary.name = "Test";
    test.portfolios = [
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
    useProfileStore.setState({
      profiles: [
        { id: "c2", name: "Client 2", plan: c2 },
        { id: "test", name: "test client", plan: test },
      ],
      activeId: "c2",
    });
    const loaded = useProfileStore.getState().switchTo("test", c2);
    expect(loaded?.portfolios).toHaveLength(1);
    expect(loaded?.portfolios[0].name).toBe("One account");
    expect(useProfileStore.getState().profiles.find((p) => p.id === "c2")?.plan.portfolios).toHaveLength(
      1,
    );
    const back = useProfileStore.getState().switchTo("c2", loaded!);
    expect(back?.primary.name).toBe("Client 2");
    expect(back?.portfolios[0].name).toBe("TSP");
    expect(
      useProfileStore.getState().profiles.find((p) => p.id === "test")?.plan.portfolios[0].name,
    ).toBe("One account");
  });

  it("asLibraryFor writes onto the given id even if activeId already moved", () => {
    twoClients();
    useProfileStore.setState({ activeId: "p2" });
    const stale = createDefaultPlan();
    stale.primary.name = "Alpha";
    stale.incomes[0].monthlyAmount = 1111;
    useProfileStore.getState().asLibraryFor(stale, "p1");
    expect(useProfileStore.getState().profiles.find((p) => p.id === "p1")?.plan.primary.name).toBe(
      "Alpha",
    );
    expect(useProfileStore.getState().profiles.find((p) => p.id === "p2")?.plan.primary.name).toBe(
      "Bravo",
    );
  });
});
