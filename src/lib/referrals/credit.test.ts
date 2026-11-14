import assert from "node:assert/strict";
import test from "node:test";
import { centsFromPoints, parseCreditPoints, pointsFromCents, referralCreditKey, referralCreditLabel } from "./credit.ts";

test("200 points is 2000 cents, and a stored credit displays as points", () => {
  assert.equal(parseCreditPoints("200"), 200);
  assert.equal(parseCreditPoints(0), 0);
  assert.equal(parseCreditPoints("200.5"), null);
  assert.equal(parseCreditPoints("-1"), null);
  assert.equal(parseCreditPoints("10001"), null);
  assert.equal(centsFromPoints(200), 2000);
  assert.equal(pointsFromCents(2000), 200);
  assert.equal(pointsFromCents(1500), 150);
  assert.equal(referralCreditLabel(2000), "200 points");
  assert.equal(referralCreditLabel(1500), "150 points");
  assert.equal(referralCreditKey("signup-1"), "referral-credit-signup-1");
});
