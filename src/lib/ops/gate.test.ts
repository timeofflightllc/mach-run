import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPS_PATH,
  emailsMatch,
  isOwnerEmail,
  parseOpsPath,
  parseOwnerEmails,
} from "./gate";

describe("ops gate helpers", () => {
  it("defaults the path to top-3-desk", () => {
    expect(parseOpsPath("")).toBe(DEFAULT_OPS_PATH);
    expect(parseOpsPath(" /Top-3-Desk/ ")).toBe("Top-3-Desk");
  });

  it("parses owner emails case-insensitive", () => {
    expect(parseOwnerEmails("Cain@MachRun.com, other@x.com")).toEqual([
      "cain@machrun.com",
      "other@x.com",
    ]);
    expect(isOwnerEmail("CAIN@machrun.com", ["cain@machrun.com"])).toBe(true);
    expect(isOwnerEmail("guest@x.com", ["cain@machrun.com"])).toBe(false);
    expect(isOwnerEmail("cain@machrun.com", [])).toBe(false);
  });

  it("matches typed confirm emails", () => {
    expect(emailsMatch("Matt@MachRun.com", " matt@machrun.com ")).toBe(true);
    expect(emailsMatch("a@x.com", "b@x.com")).toBe(false);
    expect(emailsMatch("", "a@x.com")).toBe(false);
  });
});
