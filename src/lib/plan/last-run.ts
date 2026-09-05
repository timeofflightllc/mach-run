import { ensurePlan } from "./defaults";
import type { Plan } from "./types";

const STORAGE_KEY = "mach-last-run-v1";

export type StoredRun = {
  id: number;
  plan: Plan;
};

type Store = Record<string, StoredRun>;

function readStore(): Store {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Store = {};
    for (const [key, row] of Object.entries(parsed)) {
      if (!row || typeof row !== "object") continue;
      if (typeof row.id !== "number" || !row.plan) continue;
      out[key] = { id: row.id, plan: ensurePlan(row.plan) };
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function loadStoredRuns(): Store {
  return readStore();
}

export function saveStoredRun(key: string, run: StoredRun) {
  const store = readStore();
  store[key] = run;
  writeStore(store);
}

export function clearStoredRun(key: string) {
  const store = readStore();
  if (!(key in store)) return;
  delete store[key];
  writeStore(store);
}

export function clearAllStoredRuns() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
