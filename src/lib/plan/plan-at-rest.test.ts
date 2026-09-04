import assert from "node:assert/strict";
import test from "node:test";
import { isAtRestEnvelope, openPlanPayload, sealPlanPayload } from "./plan-at-rest.ts";

test("sealPlanPayload wraps a plan when a key is set", () => {
  const prev = process.env.MACH_PLAN_AT_REST_KEY;
  process.env.MACH_PLAN_AT_REST_KEY = "unit-test-key-32chars-minimum";
  try {
    const sealed = sealPlanPayload({
      family: { primaryName: "Cain" },
      portfolios: [{ name: "Roth", balance: 12345 }],
    });
    assert.equal(isAtRestEnvelope(sealed), true);
    const text = JSON.stringify(sealed);
    assert.equal(text.includes("Cain"), false);
    assert.equal(text.includes("12345"), false);
    const opened = openPlanPayload(sealed) as {
      family: { primaryName: string };
      portfolios: { balance: number }[];
    };
    assert.equal(opened.family.primaryName, "Cain");
    assert.equal(opened.portfolios[0].balance, 12345);
  } finally {
    if (prev == null) delete process.env.MACH_PLAN_AT_REST_KEY;
    else process.env.MACH_PLAN_AT_REST_KEY = prev;
  }
});

test("openPlanPayload still reads legacy plaintext JSON", () => {
  const legacy = { kind: "library", activeId: "a", profiles: [] };
  assert.deepEqual(openPlanPayload(legacy), legacy);
  assert.deepEqual(openPlanPayload(JSON.stringify(legacy)), legacy);
});
