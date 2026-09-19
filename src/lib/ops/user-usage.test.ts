import { describe, expect, it } from "vitest";
import { shapeFromPlan } from "./activity";
import {
  deviceHintFromUa,
  lastUniqueIps,
  shapeFromLatestEvent,
} from "./user-usage";

describe("ops user usage helpers", () => {
  it("keeps the last four unique IPs in newest-first order", () => {
    expect(
      lastUniqueIps(["1.1.1.1", "1.1.1.1", "8.8.8.8", "9.9.9.9", "2.2.2.2", "3.3.3.3"]),
    ).toEqual(["1.1.1.1", "8.8.8.8", "9.9.9.9", "2.2.2.2"]);
  });

  it("maps a user-agent to a short device hint", () => {
    expect(deviceHintFromUa("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)")).toBe("iPhone / iPad");
    expect(deviceHintFromUa("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)")).toBe("Mac");
    expect(deviceHintFromUa("")).toBeNull();
  });

  it("counts family, stages, and nested mortgages without amounts", () => {
    expect(
      shapeFromPlan({
        primary: { name: "A", birthDate: "1979-01-01" },
        spouse: { name: "B", birthDate: "1986-01-01" },
        children: [{}, {}],
        stages: [{}],
        portfolios: [
          { mortgage: { associated: true, originationDate: "2012-01" } },
          { mortgage: { associated: false } },
          {},
        ],
        incomes: [1, 2],
        contributions: [1],
        spending: [1],
        liabilities: [1, 2, 3],
      }),
    ).toEqual({
      accounts: 3,
      incomes: 2,
      contributions: 1,
      spending: 1,
      liabilities: 3,
      profiles: 1,
      familyPeople: 4,
      stages: 1,
      mortgages: 1,
    });
  });

  it("reads inventory from the latest Calculate event", () => {
    expect(
      shapeFromLatestEvent([
        {
          id: "1",
          at: null,
          action: "login",
          detail: {},
        },
        {
          id: "2",
          at: null,
          action: "calculate",
          detail: { accounts: 5, incomes: 2, contributions: 1, spending: 1, liabilities: 0, profiles: 1 },
        },
      ]),
    ).toMatchObject({ accounts: 5, incomes: 2, contributions: 1 });
  });
});
