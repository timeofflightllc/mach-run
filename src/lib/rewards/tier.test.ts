import assert from "node:assert/strict";
import test from "node:test";
import { rewardTier } from "./tier.ts";

const NOW = new Date("2026-11-17T12:00:00.000Z");
const DAY_ONE = "2026-11-17T12:00:00.000Z";
const MONTHS_18 = "2025-05-17T12:00:00.000Z";

test("0 points on day one is Green", () => {
  assert.equal(rewardTier(0, DAY_ONE, NOW), "Green");
});

test("200 points on day one is Silver", () => {
  assert.equal(rewardTier(200, DAY_ONE, NOW), "Silver");
});

test("0 points at 18 months is Gold", () => {
  assert.equal(rewardTier(0, MONTHS_18, NOW), "Gold");
});

test("1,500 points is Platinum", () => {
  assert.equal(rewardTier(1500, DAY_ONE, NOW), "Platinum");
  assert.equal(rewardTier(1500, null, NOW), "Platinum");
});

test("spending 50 of those points does not change the tier", () => {
  const earned = 1500;
  const spent = 50;
  assert.equal(rewardTier(earned, DAY_ONE, NOW), "Platinum");
  assert.equal(rewardTier(earned - spent, DAY_ONE, NOW), "Gold");
});
