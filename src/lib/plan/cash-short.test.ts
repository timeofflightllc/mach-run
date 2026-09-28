import assert from "node:assert/strict";
import test from "node:test";
import { cashShortYears } from "./cash-short.ts";
import type { SimResult, YearCap } from "./types.ts";

function cap(partial: Pick<YearCap, "year" | "kind" | "planned" | "leftover" | "employerMatch">): YearCap {
  return {
    funded: Math.min(partial.planned, partial.leftover),
    irsCut: 0,
    ...partial,
  };
}

test("cash short ignores employer match and skips years the paycheck covered", () => {
  const sim = {
    yearCaps: [
      cap({ year: 2029, kind: "cash", planned: 278691.58, leftover: 249129.74, employerMatch: 24345.79 }),
      cap({ year: 2029, kind: "match", planned: 278691.58, leftover: 249129.74, employerMatch: 24345.79 }),
      cap({ year: 2030, kind: "cash", planned: 147000, leftover: 71907.95, employerMatch: 0 }),
      cap({ year: 2035, kind: "cash", planned: 87000, leftover: 0, employerMatch: 0 }),
    ],
  } as SimResult;
  const rows = cashShortYears(sim);
  assert.deepEqual(
    rows.map((row) => row.year),
    [2029, 2030, 2035],
  );
  assert.ok(Math.abs(rows[0].asked - (278691.58 - 24345.79)) < 0.01);
  assert.ok(Math.abs(rows[0].missed - (rows[0].asked - 249129.74)) < 0.01);
  assert.ok(Math.abs(rows[1].missed - (147000 - 71907.95)) < 0.01);
  assert.equal(rows[2].left, 0);
  assert.equal(rows[2].missed, 87000);
});
