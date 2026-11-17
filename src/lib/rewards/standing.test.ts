import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { readRewardStanding, rewardStandingFrom } from "./standing.ts";

const USER = "user-1";

test("160 granted and 50 redeemed leaves 110", async () => {
  assert.deepEqual(rewardStandingFrom(160, 50), { earned: 160, spent: 50, balance: 110 });
  assert.deepEqual(rewardStandingFrom(40, 50), { earned: 40, spent: 50, balance: 0 });

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
    create table mach_reward_redemptions (
      id text primary key,
      user_id text not null,
      points integer not null check (points > 0),
      cents integer not null check (cents > 0),
      created_at timestamptz not null default now()
    );
  `);
  await pg.query(
    `insert into mach_reward_grants (id, user_id, source, source_id, points) values ($1, $2, 'beta', 'b1', 160)`,
    ["g1", USER],
  );
  await pg.query(
    `insert into mach_reward_redemptions (id, user_id, points, cents) values ($1, $2, 50, 500)`,
    ["r1", USER],
  );
  const standing = await readRewardStanding(
    {
      query: async (text, params = []) => (await pg.query(text, params)).rows,
    },
    USER,
  );
  assert.deepEqual(standing, { earned: 160, spent: 50, balance: 110 });
});
