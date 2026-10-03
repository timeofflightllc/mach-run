import assert from "node:assert/strict";
import { test } from "node:test";
import {
  afterAuthHref,
  parseCheckoutIntent,
  registerForPlanHref,
  resumeCheckoutHref,
  wantsCheckout,
} from "./checkout-intent.ts";

test("paid card login query names package and interval", () => {
  assert.equal(
    registerForPlanHref("unlimited", "year"),
    "/login?mode=up&package=unlimited&interval=year",
  );
  assert.equal(
    registerForPlanHref("advisor_lite", "month"),
    "/login?mode=up&package=advisor_lite&interval=month",
  );
});

test("auth return starts checkout only when both package and interval are real", () => {
  assert.equal(
    resumeCheckoutHref({ package: "unlimited", interval: "year" }),
    "/pricing?package=unlimited&interval=year&checkout=1",
  );
  assert.equal(resumeCheckoutHref({ package: "individual", interval: null }), null);
  assert.equal(afterAuthHref({}), "/");
  assert.equal(
    afterAuthHref({ package: "advisor", interval: "month" }),
    "/pricing?package=advisor&interval=month&checkout=1",
  );
});

test("junk package or a cancelled checkout does not start a charge", () => {
  assert.deepEqual(parseCheckoutIntent({ package: "free", interval: "year" }), {
    package: null,
    interval: "year",
  });
  assert.equal(wantsCheckout({ checkout: "cancel" }), false);
  assert.equal(wantsCheckout({ checkout: "1" }), true);
  assert.equal(afterAuthHref({ package: "nope", interval: "year" }), "/");
});
