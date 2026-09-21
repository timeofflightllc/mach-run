import { describe, expect, it } from "vitest";
import {
  builtinPromo,
  describePromo,
  evaluatePromo,
  promoCodeOk,
  sanitizePromoCode,
  type PromoRecord,
} from "./promo";

const trial: PromoRecord = {
  code: "WINGMAN",
  kind: "trial_days",
  trialDays: 21,
  percentOff: null,
  packages: ["individual", "unlimited"],
  startsAt: "2026-09-01",
  endsAt: "2026-09-30",
  active: true,
  builtin: false,
  note: "",
  stripeCouponId: null,
  used: 0,
  activeUsers: 0,
  activeEmails: [],
};

describe("desk promo codes", () => {
  it("keeps SUPER14 as a built-in on every paid package", () => {
    const row = builtinPromo("super14");
    expect(row?.trialDays).toBe(14);
    expect(row?.packages).toEqual(["individual", "unlimited", "advisor_lite", "advisor"]);
  });

  it("keeps EAGLE as Individual Unlimited only", () => {
    const row = builtinPromo("EAGLE");
    expect(row?.trialDays).toBe(30);
    expect(row?.packages).toEqual(["unlimited"]);
    expect(evaluatePromo(row, "individual")).toMatchObject({ ok: false, reason: "wrong_package" });
    expect(evaluatePromo(row, "unlimited")).toMatchObject({ ok: true });
  });

  it("rejects before start, after end, inactive, and wrong package", () => {
    const mid = new Date("2026-09-15T12:00:00Z");
    expect(evaluatePromo(trial, "unlimited", mid).ok).toBe(true);
    expect(evaluatePromo(trial, "unlimited", new Date("2026-08-31T12:00:00Z"))).toMatchObject({
      reason: "not_started",
    });
    expect(evaluatePromo(trial, "unlimited", new Date("2026-10-01T12:00:00Z"))).toMatchObject({
      reason: "expired",
    });
    expect(evaluatePromo({ ...trial, active: false }, "unlimited", mid)).toMatchObject({
      reason: "inactive",
    });
    expect(evaluatePromo(trial, "advisor", mid)).toMatchObject({ reason: "wrong_package" });
    expect(evaluatePromo(null, "unlimited", mid)).toMatchObject({ reason: "unknown" });
  });

  it("sanitizes codes and describes the offer", () => {
    expect(sanitizePromoCode("  wing-man 99! ")).toBe("WING-MAN99");
    expect(promoCodeOk("WING-MAN")).toBe(true);
    expect(promoCodeOk("NO")).toBe(false);
    expect(describePromo(trial)).toBe("21 days free · Individual, Individual Unlimited");
    expect(
      describePromo({
        ...trial,
        kind: "percent_off",
        percentOff: 20,
        packages: ["individual", "unlimited", "advisor_lite", "advisor"],
      }),
    ).toBe("20% off first invoice · all paid packages");
  });
});
