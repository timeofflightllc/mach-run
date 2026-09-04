import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultPlan } from "./defaults";
import { useProfileStore } from "./profile-store";

function twoClients() {
  const a = createDefaultPlan();
  const b = createDefaultPlan();
  useProfileStore.setState({
    profiles: [
      { id: "p1", name: "Alpha", plan: a },
      { id: "p2", name: "Bravo", plan: b },
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
