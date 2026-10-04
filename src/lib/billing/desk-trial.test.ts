import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deskTrialBlocked,
  deskTrialDays,
  deskTrialSubscriptionParams,
} from "./desk-trial.ts";

test("desk trial payload uses the passed day count and cancel-if-no-card", () => {
  const params = deskTrialSubscriptionParams({
    customerId: "cus_test",
    priceId: "price_unlimited_passed_in",
    userId: "user_1",
    trialDays: 100,
  });
  assert.equal(params.trial_period_days, 100);
  assert.equal(params.items[0]?.price, "price_unlimited_passed_in");
  assert.equal(params.trial_settings.end_behavior.missing_payment_method, "cancel");
  assert.equal(params.metadata.userId, "user_1");
  assert.equal(params.metadata.package, "unlimited");
  assert.equal(params.metadata.deskTrial, "100");
});

test("desk trial length bounds", () => {
  assert.equal(deskTrialDays(0, "days").ok, false);
  assert.equal(deskTrialDays(731, "days").ok, false);
  assert.equal(deskTrialDays(1.5, "days").ok, false);
  assert.equal(deskTrialDays(100, "months").ok, false);
  assert.deepEqual(deskTrialDays(1, "days"), { ok: true, days: 1 });
  assert.deepEqual(deskTrialDays(100, "days"), { ok: true, days: 100 });
  assert.deepEqual(deskTrialDays(1, "months"), { ok: true, days: 30 });
});

test("desk trial refuses a paid or trialing Stripe subscription", () => {
  assert.match(
    deskTrialBlocked({
      hasEmail: true,
      advisorGrant: false,
      stripeSubscriptionId: "sub_live",
      status: "active",
    }) ?? "",
    /Set package/,
  );
  assert.match(
    deskTrialBlocked({
      hasEmail: true,
      advisorGrant: false,
      stripeSubscriptionId: "sub_trial",
      status: "trialing",
    }) ?? "",
    /Set package/,
  );
  assert.equal(
    deskTrialBlocked({
      hasEmail: true,
      advisorGrant: false,
      stripeSubscriptionId: "sub_old",
      status: "canceled",
    }),
    null,
  );
});
