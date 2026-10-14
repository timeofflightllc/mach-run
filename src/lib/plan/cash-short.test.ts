import assert from "node:assert/strict";
import test from "node:test";
import { cashParkedYears, cashShortYears, paycheckGapNote } from "./cash-short.ts";
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

test("a short year does not erase years that parked cash", () => {
  const parked = paycheckGapNote([2032, 2033, 2034], [2028, 2029, 2030, 2031]);
  assert.equal(
    parked,
    "Only 2032, 2033, and 2034 are short. Other years are parking leftover as cash, and that cash is already inside this number.",
  );
  assert.equal(
    paycheckGapNote([2032], [2028]),
    "Only 2032 is short. Other years are parking leftover as cash, and that cash is already inside this number.",
  );
  assert.equal(
    paycheckGapNote([2032, 2033], []),
    "The paycheck does not have room for the extra saving that would close this.",
  );
  assert.equal(paycheckGapNote([], [2028]), null);
});

test("parked years stop at the goal year", () => {
  const sim = {
    months: [
      { year: 2030, detail: { cashParked: 5000 } },
      { year: 2031, detail: { cashParked: 0 } },
      { year: 2036, detail: { cashParked: 9000 } },
    ],
  } as SimResult;
  assert.deepEqual(cashParkedYears(sim, 2035), [2030]);
});

