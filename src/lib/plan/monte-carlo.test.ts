import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SWING,
  SHOCK_FLOOR,
  SWING_PRESETS,
  applyShock,
  createStandardNormal,
} from "./monte-carlo.ts";

test("swing presets are the locked decimals and typical is the default", () => {
  assert.equal(SWING_PRESETS.calm, 0.08);
  assert.equal(SWING_PRESETS.typical, 0.15);
  assert.equal(SWING_PRESETS.rough, 0.22);
  assert.equal(DEFAULT_SWING, "typical");
});

test("a seed repeats and a different seed does not", () => {
  const first = createStandardNormal(1);
  const again = createStandardNormal(1);
  const other = createStandardNormal(2);
  const a = [first(), first(), first()];
  const b = [again(), again(), again()];
  assert.deepEqual(b, a);
  assert.notEqual(other(), a[0]);
});

test("seed 1 locks its first three standard-normal draws", () => {
  const next = createStandardNormal(1);
  const draws = [next(), next(), next()].map((z) => z.toFixed(6));
  assert.deepEqual(draws, ["0.965974", "0.016606", "1.123104"]);
});

test("20,000 draws of seed 1 sit on a standard normal", () => {
  const next = createStandardNormal(1);
  const n = 20_000;
  let sum = 0;
  let sumSquares = 0;
  for (let i = 0; i < n; i++) {
    const z = next();
    sum += z;
    sumSquares += z * z;
  }
  const mean = sum / n;
  const variance = sumSquares / n - mean * mean;
  const stdev = Math.sqrt(variance);
  assert.ok(Math.abs(mean) < 0.05, `mean ${mean}`);
  assert.ok(Math.abs(stdev - 1) < 0.05, `stdev ${stdev}`);
});

test("applyShock centers on the stated return and holds the floor", () => {
  assert.equal(applyShock(0.07, 0, SWING_PRESETS.typical), 0.07);
  assert.equal(applyShock(0.5, 1, 0.25), 0.75);
  assert.equal(applyShock(0.07, -100, SWING_PRESETS.typical), SHOCK_FLOOR);
  assert.equal(SHOCK_FLOOR, -0.95);
});
