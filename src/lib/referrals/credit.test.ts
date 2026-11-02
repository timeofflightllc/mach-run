import assert from "node:assert/strict";
import test from "node:test";
import { parseCreditDollars, referralCreditKey } from "./credit.ts";

test("the credit is whole dollars, and the default is a valid amount", () => {
  assert.equal(parseCreditDollars("20"), 20);
  assert.equal(parseCreditDollars(0), 0);
  assert.equal(parseCreditDollars("20.5"), null);
  assert.equal(parseCreditDollars("-1"), null);
  assert.equal(parseCreditDollars("1001"), null);
  assert.equal(referralCreditKey("signup-1"), "referral-credit-signup-1");
});
