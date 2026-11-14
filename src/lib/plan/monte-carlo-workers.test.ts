import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultPlan } from "./defaults.ts";
import { economicHash, pathRanges, runOnePath, runSurvival } from "./monte-carlo-run.ts";
import type { Plan } from "./types.ts";
import type { SwingName } from "./monte-carlo.ts";

function shortPlan(): Plan {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2026-01-01";
  plan.assumptions.projectionEndAge = 50;
  plan.assumptions.defaultReturnPct = 7;
  plan.primary = { name: "Pat", birthDate: "1980-01-01" };
  plan.spouse = { name: "", birthDate: "" };
  plan.children = [];
  plan.stages = [];
  plan.incomes = [];
  plan.spending = [];
  plan.contributions = [];
  plan.liabilities = [];
  plan.portfolios = [
    {
      id: "port-one",
      name: "Brokerage",
      kind: "taxable",
      owner: "primary",
      currentValue: 100_000,
      returnPct: 7,
      taxBucket: "taxable",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  return plan;
}

test("path ranges cover every path exactly once", () => {
  const ranges = pathRanges(1000, 4);
  assert.equal(ranges.length, 4);
  const seen = new Set<number>();
  for (const range of ranges) {
    for (let i = 0; i < range.count; i++) seen.add(range.start + i);
  }
  assert.equal(seen.size, 1000);
  assert.equal(Math.min(...seen), 0);
  assert.equal(Math.max(...seen), 999);
});

test("merged worker ranges match a full main-thread run to the cent", () => {
  const plan = shortPlan();
  const swing: SwingName = "typical";
  const hash = economicHash(plan, swing);
  const paths = 40;
  const ranges = pathRanges(paths, 4);

  let fullSurvived = 0;
  const fullAges: number[] = [];
  const fullColumns = new Map<number, { nominal: number[]; real: number[] }>();
  for (let path = 0; path < paths; path++) {
    const result = runOnePath(plan, swing, hash, path);
    if (result.depletedAge == null) fullSurvived += 1;
    else fullAges.push(result.depletedAge);
    for (const row of result.yearEnds ?? []) {
      let col = fullColumns.get(row.year);
      if (!col) {
        col = { nominal: [], real: [] };
        fullColumns.set(row.year, col);
      }
      col.nominal.push(row.nominal);
      col.real.push(row.real);
    }
  }

  let mergedSurvived = 0;
  const mergedAges: number[] = [];
  const mergedColumns = new Map<number, { nominal: number[]; real: number[] }>();
  for (const range of ranges) {
    for (let path = range.start; path < range.start + range.count; path++) {
      const result = runOnePath(plan, swing, hash, path);
      if (result.depletedAge == null) mergedSurvived += 1;
      else mergedAges.push(result.depletedAge);
      for (const row of result.yearEnds ?? []) {
        let col = mergedColumns.get(row.year);
        if (!col) {
          col = { nominal: [], real: [] };
          mergedColumns.set(row.year, col);
        }
        col.nominal.push(row.nominal);
        col.real.push(row.real);
      }
    }
  }

  assert.equal(mergedSurvived, fullSurvived);
  assert.deepEqual(mergedAges.sort(), fullAges.sort());
  for (const [year, full] of fullColumns) {
    const merged = mergedColumns.get(year);
    assert.ok(merged);
    assert.equal(merged.nominal.length, full.nominal.length);
    for (let i = 0; i < full.nominal.length; i++) {
      assert.equal(merged.nominal[i], full.nominal[i]);
      assert.equal(merged.real[i], full.real[i]);
    }
  }
});

test("runOnePath is deterministic for the same path index", () => {
  const plan = shortPlan();
  const swing: SwingName = "typical";
  const hash = economicHash(plan, swing);
  const a = runOnePath(plan, swing, hash, 7);
  const b = runOnePath(plan, swing, hash, 7);
  assert.equal(a.depletedAge, b.depletedAge);
  assert.equal(a.yearEnds?.length, b.yearEnds?.length);
  for (let i = 0; i < (a.yearEnds?.length ?? 0); i++) {
    assert.equal(a.yearEnds![i].nominal, b.yearEnds![i].nominal);
    assert.equal(a.yearEnds![i].real, b.yearEnds![i].real);
  }
});

test("abort returns null and does not leave a score", async () => {
  const plan = shortPlan();
  const controller = new AbortController();
  controller.abort();
  const score = await runSurvival(plan, "typical", { signal: controller.signal });
  assert.equal(score, null);
});

test("progress counter still moves", async () => {
  const plan = shortPlan();
  const seen: number[] = [];
  const score = await runSurvival(plan, "typical", {
    onProgress: (done) => seen.push(done),
  });
  assert.ok(score);
  assert.ok(seen.length > 0);
  assert.equal(seen[seen.length - 1], 1000);
  assert.ok(seen.some((n) => n > 0 && n < 1000));
});
