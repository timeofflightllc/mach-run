import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createDefaultPlan } from "../plan/defaults.ts";
import { demoPlan } from "../plan/demo-plan.ts";
import type { Plan } from "../plan/types.ts";
import type { PlanLibrary } from "../plan/profile-store.ts";
import { considerLoopGrant, savedHouseholdChanged } from "./loop-grant.ts";

const USER = "user-1";
const NOV = new Date("2026-11-15T12:00:00.000Z");
const DEC = new Date("2026-12-01T00:00:00.000Z");

function household(name: string): Plan {
  const plan = createDefaultPlan();
  plan.primary = { name, birthDate: "1979-03-15" };
  return plan;
}

function library(activeId: string, profiles: { id: string; name: string; plan: Plan }[]): PlanLibrary {
  return { kind: "library", activeId, profiles };
}

function asSql(pg: PGlite) {
  return {
    query: async (text: string, params: unknown[] = []) => {
      const result = await pg.query(text, params);
      return result.rows;
    },
  };
}

async function grantRows(pg: PGlite) {
  const result = await pg.query<{ id: string; user_id: string; source: string; source_id: string; points: number }>(
    `select id, user_id, source, source_id, points from mach_reward_grants order by id`,
  );
  return result.rows;
}

test("a reload does not pay, a Hale demo does not pay, and a real change pays once a month", async () => {
  const stored = household("Cain");
  const reloaded = household("Cain");
  assert.equal(savedHouseholdChanged(stored, reloaded, true), false);
  assert.equal(savedHouseholdChanged(null, household("Cain"), true), false);
  assert.equal(savedHouseholdChanged(stored, demoPlan(), true), false);

  const edited = household("Cain");
  edited.assumptions = { ...edited.assumptions, nestEggGoal: 1_800_000 };
  assert.equal(savedHouseholdChanged(stored, edited, true), true);

  const oneField = demoPlan();
  oneField.primary = { ...oneField.primary, name: "Jordan Hale Jr" };
  assert.equal(savedHouseholdChanged(demoPlan(), oneField, true), true);

  const cain = household("Cain");
  const riley = household("Riley");
  const book = library("a", [
    { id: "a", name: "Cain", plan: cain },
    { id: "b", name: "Riley", plan: riley },
  ]);
  const switched = library("b", [
    { id: "a", name: "Cain", plan: household("Cain") },
    { id: "b", name: "Riley", plan: household("Riley") },
  ]);
  assert.equal(savedHouseholdChanged(book, switched, true), false);

  const pg = new PGlite();
  await pg.exec(`
    create table mach_reward_grants (
      id text primary key,
      user_id text not null,
      source text not null,
      source_id text not null,
      points integer not null check (points > 0),
      created_at timestamptz not null default now(),
      unique (source, source_id)
    );
  `);
  const sql = asSql(pg);

  await considerLoopGrant(sql, {
    userId: USER,
    stored,
    incoming: reloaded,
    paid: true,
    accepted: true,
    now: NOV,
  });
  await considerLoopGrant(sql, {
    userId: USER,
    stored,
    incoming: demoPlan(),
    paid: true,
    accepted: true,
    now: NOV,
  });
  await considerLoopGrant(sql, {
    userId: USER,
    stored,
    incoming: edited,
    paid: true,
    accepted: false,
    now: NOV,
  });
  assert.deepEqual(await grantRows(pg), []);

  await considerLoopGrant(sql, {
    userId: USER,
    stored,
    incoming: edited,
    paid: true,
    accepted: true,
    now: NOV,
  });
  const again = household("Cain");
  again.assumptions = { ...again.assumptions, nestEggGoal: 2_000_000 };
  await considerLoopGrant(sql, {
    userId: USER,
    stored: edited,
    incoming: again,
    paid: true,
    accepted: true,
    now: NOV,
  });
  assert.deepEqual(await grantRows(pg), [
    {
      id: "loop-user-1:2026-11",
      user_id: USER,
      source: "loop",
      source_id: "user-1:2026-11",
      points: 10,
    },
  ]);

  await considerLoopGrant(sql, {
    userId: USER,
    stored: edited,
    incoming: again,
    paid: true,
    accepted: true,
    now: DEC,
  });
  const rows = await grantRows(pg);
  assert.equal(rows.length, 2);
  assert.equal(rows[1]?.source_id, "user-1:2026-12");
  assert.equal(rows[1]?.points, 10);
});
