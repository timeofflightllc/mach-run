import { describe, expect, it } from "vitest";
import { activityLabel, describeActivity, shapeFromPlan } from "./activity";

describe("user activity helpers", () => {
  it("counts plan blocks without amounts", () => {
    expect(
      shapeFromPlan({
        portfolios: [1, 2],
        incomes: [1],
        contributions: [],
        spending: [1],
        liabilities: [1, 2, 3],
      }),
    ).toEqual({
      accounts: 2,
      incomes: 1,
      contributions: 0,
      spending: 1,
      liabilities: 3,
      profiles: 1,
    });
  });

  it("labels calculate and pdf", () => {
    expect(activityLabel("calculate")).toMatch(/MACH Run/);
    expect(activityLabel("pdf")).toMatch(/PDF/);
    expect(
      describeActivity({
        id: "1",
        at: null,
        action: "calculate",
        detail: { accounts: 2, incomes: 1, contributions: 0, spending: 0, liabilities: 0 },
      }),
    ).toBe("2 accounts · 1 incomes");
  });
});
