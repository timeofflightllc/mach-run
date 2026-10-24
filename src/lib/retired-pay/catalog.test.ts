import assert from "node:assert/strict";
import test from "node:test";
import { commitUpload, parsePayUpload, resolvePayTable, resolvePayTables } from "./catalog.ts";
import type { PayTable } from "./formula.ts";

function fake(year: number, rate: number): PayTable {
  return { effectiveYear: year, rates: { "E-7": { 20: rate } } };
}

test("a bad upload saves nothing", () => {
  const existing = [fake(2026, 1)];
  const upload = parsePayUpload({ officers: "<p>no table</p>", prior: "", warrant: "", enlisted: "" });
  assert.equal(upload.ok, false);
  const next = commitUpload(existing, upload);
  assert.equal(next, existing);
  assert.equal(next[0]?.effectiveYear, 2026);
});

test("a newer uploaded year is the one the quiz selects", () => {
  const seed = [fake(2024, 1), fake(2026, 2)];
  const uploaded = [fake(2027, 3)];
  assert.equal(resolvePayTable(seed, uploaded)?.effectiveYear, 2027);
  assert.equal(resolvePayTable(seed, [fake(2026, 9)])?.rates["E-7"]?.[20], 9);
  assert.equal(resolvePayTable(seed, [fake(2024, 8)])?.effectiveYear, 2026);
  assert.deepEqual(
    resolvePayTables(seed, [fake(2026, 9)]).map((table) => table.effectiveYear),
    [2024, 2026],
  );
  assert.equal(resolvePayTables(seed, [fake(2026, 9)])[1]?.rates["E-7"]?.[20], 9);
});

test("two scales in one year both stay, and an upload replaces that year", () => {
  const january: PayTable = { effectiveYear: 2000, effectiveMonth: 1, rates: { "E-7": { 20: 1 } } };
  const july: PayTable = { effectiveYear: 2000, effectiveMonth: 7, rates: { "E-7": { 20: 2 } } };
  const kept = resolvePayTables([january, july, fake(2001, 3)], []);
  assert.deepEqual(
    kept.map((table) => [table.effectiveYear, table.effectiveMonth ?? 1, table.rates["E-7"]?.[20]]),
    [
      [2000, 1, 1],
      [2000, 7, 2],
      [2001, 1, 3],
    ],
  );
  const replaced = resolvePayTables([january, july], [fake(2000, 9)]);
  assert.deepEqual(
    replaced.map((table) => table.rates["E-7"]?.[20]),
    [9],
  );
});
