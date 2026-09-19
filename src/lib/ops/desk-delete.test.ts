import { describe, expect, it } from "vitest";
import { opsDeleteBlockReason, opsDeletePasswordMissing } from "./desk-delete";

const owners = ["cain@machrun.com"];

describe("ops desk delete gates", () => {
  it("blocks deleting yourself", () => {
    expect(
      opsDeleteBlockReason({
        actorId: "a1",
        actorEmail: "cain@machrun.com",
        targetId: "a1",
        targetEmail: "cain@machrun.com",
        owners,
      }),
    ).toMatch(/own desk login/);
  });

  it("blocks owner emails even if the actor is a different owner", () => {
    expect(
      opsDeleteBlockReason({
        actorId: "a1",
        actorEmail: "other@machrun.com",
        targetId: "b2",
        targetEmail: "CAIN@machrun.com",
        owners: ["cain@machrun.com", "other@machrun.com"],
      }),
    ).toMatch(/MACH_OWNER_EMAILS/);
  });

  it("allows a normal user", () => {
    expect(
      opsDeleteBlockReason({
        actorId: "a1",
        actorEmail: "cain@machrun.com",
        targetId: "u9",
        targetEmail: "guest@example.com",
        owners,
      }),
    ).toBeNull();
  });

  it("requires a password", () => {
    expect(opsDeletePasswordMissing("")).toMatch(/desk password/);
    expect(opsDeletePasswordMissing(undefined)).toMatch(/desk password/);
    expect(opsDeletePasswordMissing("secret")).toBeNull();
  });
});
