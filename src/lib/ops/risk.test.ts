import { describe, expect, it } from "vitest";
import {
  gradeFromScore,
  looksGeneratedLocal,
  scoreBotRisk,
  type RiskInput,
} from "./risk";

const base: RiskInput = {
  email: "cain@gmail.com",
  emailVerified: true,
  name: "Cain",
  createdAt: "2026-01-01T00:00:00.000Z",
  authHint: "Apple",
  paid: true,
  isComp: false,
  calculateCount: 4,
  loginCount: 6,
  pdfCount: 1,
  backupCount: 0,
  planPresent: true,
  lastIps: ["8.8.8.8"],
  userAgents: ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605"],
  sharedIpUsers: 0,
  now: Date.parse("2026-09-19T00:00:00.000Z"),
};

describe("bot / spam risk grade", () => {
  it("maps scores to A–F", () => {
    expect(gradeFromScore(0)).toBe("A");
    expect(gradeFromScore(19)).toBe("A");
    expect(gradeFromScore(20)).toBe("B");
    expect(gradeFromScore(40)).toBe("C");
    expect(gradeFromScore(60)).toBe("D");
    expect(gradeFromScore(80)).toBe("F");
  });

  it("gives a real paid household an A or B", () => {
    const r = scoreBotRisk(base);
    expect(["A", "B"]).toContain(r.grade);
    expect(r.score).toBeLessThan(40);
  });

  it("fails a disposable mailbox with a bot user-agent and shared IP", () => {
    const r = scoreBotRisk({
      ...base,
      email: "x9f3k2@mailinator.com",
      emailVerified: false,
      name: "",
      authHint: "Email",
      paid: false,
      calculateCount: 0,
      loginCount: 20,
      pdfCount: 0,
      backupCount: 0,
      planPresent: false,
      userAgents: ["python-requests/2.32"],
      sharedIpUsers: 6,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    expect(r.grade).toBe("F");
    expect(r.reasons.some((x) => /disposable/i.test(x))).toBe(true);
    expect(r.reasons.some((x) => /automated/i.test(x))).toBe(true);
  });

  it("flags generated local-parts", () => {
    expect(looksGeneratedLocal("a8f3c91e2b7d44aa90cc")).toBe(true);
    expect(looksGeneratedLocal("cain.olde")).toBe(false);
  });

  it("treats unverified email-only new accounts as weaker than OAuth", () => {
    const fresh = scoreBotRisk({
      ...base,
      email: "someone@not-a-known-host.xyz",
      emailVerified: false,
      authHint: "Email",
      paid: false,
      calculateCount: 0,
      loginCount: 1,
      pdfCount: 0,
      backupCount: 0,
      planPresent: false,
      createdAt: "2026-09-18T23:00:00.000Z",
      sharedIpUsers: 0,
      userAgents: ["Mozilla/5.0"],
    });
    expect(["C", "D", "F"]).toContain(fresh.grade);
    expect(fresh.score).toBeGreaterThan(scoreBotRisk(base).score);
  });
});
