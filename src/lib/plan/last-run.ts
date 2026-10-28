import { ensurePlan } from "./defaults";
import type { SurvivalScore } from "./monte-carlo-run";
import type { Plan } from "./types";

const STORAGE_KEY = "mach-last-run-v1";
const SURVIVAL_KEY = "mach-last-survival-v1";

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
  if (key in store) {
    delete store[key];
    writeStore(store);
  }
  clearStoredSurvival(key);
}

export function clearAllStoredRuns() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SURVIVAL_KEY);
  } catch {
    /* ignore */
  }
}

type SurvivalStore = Record<string, SurvivalScore>;

function isSwing(value: unknown): value is SurvivalScore["swing"] {
  return value === "calm" || value === "typical" || value === "rough";
}

function readScore(value: unknown): SurvivalScore | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<SurvivalScore>;
  if (typeof row.score !== "number" || !Number.isFinite(row.score)) return null;
  if (typeof row.survived !== "number" || !Number.isFinite(row.survived)) return null;
  if (typeof row.hash !== "string" || !row.hash) return null;
  if (!isSwing(row.swing)) return null;
  if (!Array.isArray(row.bands)) return null;
  const traces = row.traces;
  const safeTraces =
    traces &&
    typeof traces === "object" &&
    Array.isArray(traces.years) &&
    Array.isArray(traces.nominal) &&
    Array.isArray(traces.real)
      ? traces
      : null;
  return {
    score: row.score,
    survived: row.survived,
    paths: 1000,
    swing: row.swing,
    hash: row.hash,
    runOutAge: typeof row.runOutAge === "number" && Number.isFinite(row.runOutAge) ? row.runOutAge : null,
    bands: row.bands,
    traces: safeTraces,
  };
}

function readSurvivalStore(): SurvivalStore {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SURVIVAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: SurvivalStore = {};
    for (const [key, row] of Object.entries(parsed)) {
      const score = readScore(row);
      if (score) out[key] = score;
    }
    return out;
  } catch {
    return {};
  }
}

function writeSurvivalStore(store: SurvivalStore) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SURVIVAL_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode: keep the result for this visit */
  }
}

export function loadStoredSurvivals(): SurvivalStore {
  return readSurvivalStore();
}

export function saveStoredSurvival(key: string, score: SurvivalScore) {
  const store = readSurvivalStore();
  store[key] = score;
  writeSurvivalStore(store);
}

export function clearStoredSurvival(key: string) {
  const store = readSurvivalStore();
  if (!(key in store)) return;
  delete store[key];
  writeSurvivalStore(store);
}
