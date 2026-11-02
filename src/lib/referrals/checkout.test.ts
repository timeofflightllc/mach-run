import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarMonths,
  checkoutWasPaid,
  personalYearlyInvite,
  priceInterval,
  referralCouponRefusal,
  renewalWasPulledBack,
  REFERRAL_COUPON_MESSAGE,
} from "./checkout.ts";

test("a personal yearly invite refuses a coupon and a campaign does not", () => {
  assert.equal(
    referralCouponRefusal({ personalOpen: true, interval: "year", promoCode: "SAVE" }),
    REFERRAL_COUPON_MESSAGE,
  );
  assert.equal(referralCouponRefusal({ personalOpen: true, interval: "year", promoCode: "" }), null);
  assert.equal(referralCouponRefusal({ personalOpen: true, interval: "month", promoCode: "SAVE" }), null);
  assert.equal(referralCouponRefusal({ personalOpen: false, interval: "year", promoCode: "SAVE" }), null);
  assert.equal(personalYearlyInvite(true, "year"), true);
  assert.equal(personalYearlyInvite(true, "month"), false);
  assert.equal(personalYearlyInvite(false, "year"), false);
});

test("only a paid yearly charge is ready to extend", () => {
  assert.equal(checkoutWasPaid({ paymentStatus: "paid", subscriptionStatus: "active" }), true);
  assert.equal(checkoutWasPaid({ paymentStatus: "unpaid", subscriptionStatus: "trialing" }), false);
  assert.equal(checkoutWasPaid({ paymentStatus: null, subscriptionStatus: "active" }), true);
  assert.equal(priceInterval("price_year", ["price_year"], ["price_month"]), "year");
  assert.equal(priceInterval("price_month", ["price_year"], ["price_month"]), "month");
  assert.equal(priceInterval("other", ["price_year"], ["price_month"]), null);
});

test("two calendar months are added, and a later change cannot come back early", () => {
  const end = new Date(Date.UTC(2026, 0, 31, 12, 0, 0));
  const bonus = addCalendarMonths(end, 2);
  assert.equal(bonus.toISOString(), "2026-03-31T12:00:00.000Z");
  const march = addCalendarMonths(new Date(Date.UTC(2026, 0, 15)), 2);
  assert.equal(march.toISOString().slice(0, 10), "2026-03-15");
  assert.equal(renewalWasPulledBack(bonus, new Date(Date.UTC(2026, 2, 1)), new Date(Date.UTC(2026, 1, 1))), true);
  assert.equal(renewalWasPulledBack(bonus, new Date(Date.UTC(2027, 0, 1)), new Date(Date.UTC(2026, 1, 1))), false);
  assert.equal(renewalWasPulledBack(bonus, new Date(Date.UTC(2026, 2, 1)), new Date(Date.UTC(2026, 5, 1))), false);
});
