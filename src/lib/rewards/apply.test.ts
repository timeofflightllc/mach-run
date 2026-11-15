import assert from "node:assert/strict";
import test from "node:test";
import { rewardApplyAllowed, rewardApplyChoices, rewardAppliedLine, rewardDollars } from "./apply.ts";

test("apply choices stay inside the balance", () => {
  assert.deepEqual(rewardApplyChoices(0), []);
  assert.deepEqual(rewardApplyChoices(40), [40]);
  assert.deepEqual(rewardApplyChoices(50), [50]);
  assert.deepEqual(rewardApplyChoices(120), [50, 100, 120]);
  assert.deepEqual(rewardApplyChoices(150), [50, 100, 150]);
  assert.equal(rewardApplyAllowed(120, 100), true);
  assert.equal(rewardApplyAllowed(120, 120), true);
  assert.equal(rewardApplyAllowed(120, 150), false);
  assert.equal(rewardApplyAllowed(40, 50), false);
  assert.equal(rewardApplyAllowed(40, 0), false);
  assert.equal(rewardDollars(50), "$5");
  assert.equal(rewardDollars(155), "$15.50");
  assert.equal(rewardAppliedLine(200), "Applied 200 points. That is $20 off your next bill.");
});
