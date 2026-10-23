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
