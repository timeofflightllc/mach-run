import { runOnePath } from "./monte-carlo-run.ts";
import type { SwingName } from "./monte-carlo.ts";
import type { Plan } from "./types.ts";

type WorkerRequest = {
  plan: Plan;
  swing: SwingName;
  hash: string;
  start: number;
  count: number;
  workerId: number;
};

type ColumnData = { nominal: number[]; real: number[] };

type WorkerResponse = {
  type: "progress" | "done" | "error";
  workerId?: number;
  done?: number;
  total?: number;
  survived?: number;
  runOutAges?: number[];
  columns?: [number, ColumnData][];
  message?: string;
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const { plan, swing, hash, start, count, workerId } = event.data;
    let survived = 0;
    const runOutAges: number[] = [];
    const columns = new Map<number, ColumnData>();
    const end = start + count;

    for (let path = start; path < end; path++) {
      const result = runOnePath(plan, swing, hash, path);
      if (result.depletedAge == null) survived += 1;
      else runOutAges.push(result.depletedAge);
      if (result.yearEnds) {
        for (const row of result.yearEnds) {
          let col = columns.get(row.year);
          if (!col) {
            col = { nominal: [], real: [] };
            columns.set(row.year, col);
          }
          col.nominal.push(row.nominal);
          col.real.push(row.real);
        }
      }
      const done = path - start + 1;
      if (done === count || done % 50 === 0) {
        self.postMessage({
          type: done === count ? "done" : "progress",
          workerId,
          done,
          total: count,
          survived,
          runOutAges: [...runOutAges],
          columns: [...columns.entries()],
        } satisfies WorkerResponse);
      }
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      workerId: event.data?.workerId,
      message: err instanceof Error ? err.message : "worker failed",
    } satisfies WorkerResponse);
  }
};
