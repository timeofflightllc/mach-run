import assert from "node:assert/strict";
import test from "node:test";
import { rateAt, tableInEffect } from "./formula.ts";
import { OFFICIAL_SEED } from "./official-seed.ts";

test("a 1960 entry uses the June 1958 scale until October 1963", () => {
  assert.equal(tableInEffect(OFFICIAL_SEED, 1960, 6)?.effectiveYear, 1958);
  assert.equal(tableInEffect(OFFICIAL_SEED, 1960, 6)?.effectiveMonth, 6);
  assert.equal(tableInEffect(OFFICIAL_SEED, 1963, 9)?.effectiveYear, 1958);
  const october = tableInEffect(OFFICIAL_SEED, 1963, 10);
  assert.equal(october?.effectiveYear, 1963);
  assert.equal(october?.effectiveMonth, 10);
});

test("October 1963 matches the DFAS basic-pay chart", () => {
  const table = tableInEffect(OFFICIAL_SEED, 1963, 10);
  assert.ok(table);
  const o5 = table.rates["O-5"];
  assert.equal(o5?.[0], 474.24);
  assert.equal(o5?.[4], undefined);
  assert.equal(rateAt(table, "O-5", 3), 630);
  assert.equal(rateAt(table, "O-5", 10), 650);
  assert.equal(rateAt(table, "O-5", 20), 855);
  assert.equal(rateAt(table, "E-7", 0), 206.39);
  assert.equal(rateAt(table, "E-7", 20), 375);
});

test("over-20 basic pay does not step down from one official scale to the next", () => {
  let prevO5 = 0;
  let prevE7 = 0;
  for (const table of OFFICIAL_SEED) {
    const label = `${table.effectiveYear}-${table.effectiveMonth ?? 1}`;
    const o5 = rateAt(table, "O-5", 20);
    const e7 = rateAt(table, "E-7", 20);
    assert.ok(o5 != null && e7 != null, label);
    assert.ok(o5 + 0.05 >= prevO5, label);
    assert.ok(e7 + 0.05 >= prevE7, label);
    prevO5 = o5;
    prevE7 = e7;
  }
});

test("July 2000 and April 2007 are separate scales", () => {
  const january = tableInEffect(OFFICIAL_SEED, 2000, 1);
  const july = tableInEffect(OFFICIAL_SEED, 2000, 7);
  assert.equal(january?.effectiveMonth, 1);
  assert.equal(july?.effectiveMonth, 7);
  assert.ok((rateAt(july!, "O-5", 20) ?? 0) > (rateAt(january!, "O-5", 20) ?? 0));
  const april = tableInEffect(OFFICIAL_SEED, 2007, 4);
  const before = tableInEffect(OFFICIAL_SEED, 2007, 3);
  assert.equal(before?.effectiveMonth, 1);
  assert.equal(april?.effectiveMonth, 4);
  assert.equal(rateAt(april!, "O-5", 20), rateAt(before!, "O-5", 20));
  assert.ok((rateAt(april!, "E-7", 20) ?? 0) > (rateAt(before!, "E-7", 20) ?? 0));
});
