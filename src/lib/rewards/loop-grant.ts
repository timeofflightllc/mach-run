import { persistHousehold, viewForFree, viewForPaid } from "../billing/free-hold.ts";
import { ensurePlan } from "../plan/defaults.ts";
import { demoPlan } from "../plan/demo-plan.ts";
import type { Plan } from "../plan/types.ts";
import type { PlanLibrary } from "../plan/profile-store.ts";

export const LOOP_POINTS = 10;

type GrantSql = {
  query(text: string, params?: unknown[]): Promise<unknown>;
};

/** UTC month, YYYY-MM. The same clock the grant history uses. */
export function loopMonth(now: Date): string {
  return now.toISOString().slice(0, 7);
}

function isLibrary(raw: unknown): raw is PlanLibrary {
  if (!raw || typeof raw !== "object") return false;
  const row = raw as PlanLibrary;
  return row.kind === "library" && Array.isArray(row.profiles) && typeof row.activeId === "string";
}

function asPlan(raw: unknown): Plan | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    return ensurePlan(raw as Plan);
  } catch {
    return null;
  }
}

function presentPlan(plan: Plan, paid: boolean): Plan {
  if (paid) return ensurePlan(viewForPaid(plan) as Plan);
  const sweep = plan.assumptions?.sweepPortfolioId ?? null;
  const next = ensurePlan(viewForFree(plan) as Plan);
  const visible = new Set(next.portfolios.map((portfolio) => portfolio.id));
  if (sweep && !visible.has(sweep)) {
    next.assumptions = { ...next.assumptions, sweepPortfolioId: sweep };
  }
  return next;
}

function keepHeldSweep(plan: Plan): Plan {
  const sweep = plan.assumptions?.sweepPortfolioId ?? null;
  const next = ensurePlan(plan);
  const held = (next as Plan & { freeHold?: { portfolios?: { id?: string }[] } }).freeHold;
  const heldIds = new Set((held?.portfolios ?? []).map((portfolio) => portfolio.id).filter(Boolean));
  if (sweep && heldIds.has(sweep) && !next.portfolios.some((portfolio) => portfolio.id === sweep)) {
    next.assumptions = { ...next.assumptions, sweepPortfolioId: sweep };
  }
  return next;
}

function persistedHousehold(stored: Plan, incoming: Plan, paid: boolean): Plan {
  return keepHeldSweep(persistHousehold(stored, incoming, paid) as Plan);
}

/** The active household only. A library uses the profile id on the save, not the one that was active before. */
function incomingHousehold(incoming: Plan | PlanLibrary): Plan | null {
  if (isLibrary(incoming)) {
    const hit = incoming.profiles.find((profile) => profile.id === incoming.activeId) ?? incoming.profiles[0];
    return hit ? asPlan(hit.plan) : null;
  }
  return asPlan(incoming);
}

function matchingStoredHousehold(stored: unknown, incoming: Plan | PlanLibrary): Plan | null {
  if (stored == null) return null;
  if (isLibrary(incoming)) {
    if (!isLibrary(stored)) return asPlan(stored);
    const hit = stored.profiles.find((profile) => profile.id === incoming.activeId);
    return hit ? asPlan(hit.plan) : null;
  }
  if (isLibrary(stored)) {
    const hit = stored.profiles.find((profile) => profile.id === stored.activeId) ?? stored.profiles[0];
    return hit ? asPlan(hit.plan) : null;
  }
  return asPlan(stored);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stable(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function fingerprint(plan: Plan): string {
  return stable(ensurePlan(plan));
}

function haleDemo(): string {
  return fingerprint(demoPlan());
}

/**
 * True only when a stored household changed and the save is not the Hale demo.
 * Both sides go through the same persist path, so a reload is not a change.
 */
export function savedHouseholdChanged(stored: unknown, incoming: Plan | PlanLibrary, paid: boolean): boolean {
  const storedPlan = matchingStoredHousehold(stored, incoming);
  const incomingPlan = incomingHousehold(incoming);
  if (!storedPlan || !incomingPlan) return false;
  if (fingerprint(incomingPlan) === haleDemo()) return false;
  const before = persistedHousehold(storedPlan, presentPlan(storedPlan, paid), paid);
  const after = persistedHousehold(storedPlan, incomingPlan, paid);
  if (fingerprint(before) === fingerprint(after)) return false;
  if (fingerprint(after) === haleDemo()) return false;
  return true;
}

export async function insertLoopGrant(sql: GrantSql, userId: string, now: Date): Promise<void> {
  const sourceId = `${userId}:${loopMonth(now)}`;
  await sql.query(
    `insert into mach_reward_grants (id, user_id, source, source_id, points)
     values ($1, $2, 'loop', $3, $4)
     on conflict (source, source_id) do nothing`,
    [`loop-${sourceId}`, userId, sourceId, LOOP_POINTS],
  );
}

/** Writes one monthly grant, or nothing. Does not look at admin, owner, or plan. */
export async function considerLoopGrant(
  sql: GrantSql,
  input: {
    userId: string;
    stored: unknown;
    incoming: Plan | PlanLibrary;
    paid: boolean;
    accepted: boolean;
    now?: Date;
  },
): Promise<void> {
  if (!input.accepted) return;
  if (!savedHouseholdChanged(input.stored, input.incoming, input.paid)) return;
  await insertLoopGrant(sql, input.userId, input.now ?? new Date());
}
