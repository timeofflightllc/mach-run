import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bulletsFromText,
  DEFAULT_PRICING_COPY,
  mergePricingCopy,
  parsePricingCopy,
  serializePricingCopy,
} from "./pricing-copy.ts";

test("missing or junk body uses live defaults", () => {
  assert.equal(parsePricingCopy("").heroH1, DEFAULT_PRICING_COPY.heroH1);
  assert.equal(parsePricingCopy("not json").couponLabel, DEFAULT_PRICING_COPY.couponLabel);
  assert.deepEqual(parsePricingCopy("{}").free.bullets, DEFAULT_PRICING_COPY.free.bullets);
});

test("partial save merges; empty bullet lines drop", () => {
  const next = mergePricingCopy({
    heroH1: "Pick a lane:\nTest.",
    free: { tag: "Hello", bullets: ["A", "  ", "B"] },
  });
  assert.equal(next.heroH1, "Pick a lane:\nTest.");
  assert.equal(next.heroSub, DEFAULT_PRICING_COPY.heroSub);
  assert.deepEqual(next.free.bullets, ["A", "B"]);
  assert.equal(next.individual.tag, DEFAULT_PRICING_COPY.individual.tag);
});

test("round-trip JSON keeps a hero edit", () => {
  const edited = { ...DEFAULT_PRICING_COPY, heroH1: "Pick a lane:\nEdited." };
  const again = parsePricingCopy(serializePricingCopy(edited));
  assert.equal(again.heroH1, "Pick a lane:\nEdited.");
  assert.equal(again.personalP1, DEFAULT_PRICING_COPY.personalP1);
});

test("bulletsFromText omits blank lines", () => {
  assert.deepEqual(bulletsFromText("One\n\nTwo\n  \nThree"), ["One", "Two", "Three"]);
});
