import assert from "node:assert/strict";
import test from "node:test";
import {
  referralCountLine,
  referralDisplayName,
  referralStatusLabel,
} from "./summary.ts";

test("a blank or email name stays off the list", () => {
  assert.equal(referralDisplayName(""), "New account");
  assert.equal(referralDisplayName("  "), "New account");
  assert.equal(referralDisplayName("a@x.com"), "New account");
  assert.equal(referralDisplayName("Sarah"), "Sarah");
});

test("the count line is the rate of yearly plans", () => {
  assert.equal(referralCountLine(0, 0), "0 signed up. 0 started a yearly plan. 0%.");
  assert.equal(referralCountLine(1, 0), "1 signed up. 0 started a yearly plan. 0%.");
  assert.equal(referralCountLine(4, 2), "4 signed up. 2 started a yearly plan. 50%.");
  assert.equal(referralStatusLabel("signed-up"), "Signed up");
  assert.equal(referralStatusLabel("chose-monthly"), "Chose monthly");
  assert.equal(referralStatusLabel("yearly"), "Started a yearly plan");
  assert.equal(referralStatusLabel("yearly", 2000), "$20 credit");
  assert.equal(referralStatusLabel("yearly", 1500), "$15 credit");
});
