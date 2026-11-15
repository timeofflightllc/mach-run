import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { deliverInstagramWebhook } from "./instagram-delivery.ts";
import { readRewardGrants } from "./grants-read.ts";

const SECRET = "app-secret";
const CODE = "ABCDEFGHJK";
const USER = "user-1";

function sign(raw: string, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
}

function message(text: string): string {
  return JSON.stringify({
    object: "instagram",
    entry: [{ messaging: [{ message: { text } }] }],
  });
}

function asSql(pg: PGlite) {
  return {
    query: async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
      const result = await pg.query<T>(text, params);
      return result.rows;
    },
  };
}

test("a fake Instagram post cannot add a grant", async () => {
  const pg = new PGlite();
  await pg.exec(`
    create table "user" (id text primary key, name text);
    create table mach_referral_signups (
      id text primary key,
      new_user_id text,
      new_email text
    );
    create table mach_reward_grants (
      id text primary key,
      user_id text not null,
      source text not null,
      source_id text not null,
      points integer not null check (points > 0),
      created_at timestamptz not null default now(),
      unique (source, source_id)
    );
    create table mach_reward_instagram_codes (
      user_id text primary key,
      code text not null unique
    );
  `);
  await pg.query(`insert into "user" (id, name) values ('friend', 'Riley Hale')`);
  await pg.query(
    `insert into mach_referral_signups (id, new_user_id, new_email) values ('s1', 'friend', 'riley@example.com')`,
  );
  await pg.query(
    `insert into mach_reward_grants (id, user_id, source, source_id, points) values
     ('beta-b1', $1, 'beta', 'b1', 150),
     ('referral-s1', $1, 'referral', 's1', 20)`,
    [USER],
  );
  await pg.query(`insert into mach_reward_instagram_codes (user_id, code) values ($1, $2)`, [USER, CODE]);
  const sql = asSql(pg);

  async function rows() {
    const result = await pg.query<{ id: string; user_id: string; source: string; source_id: string; points: number }>(
      `select id, user_id, source, source_id, points from mach_reward_grants order by id`,
    );
    return result.rows;
  }

  const before = await rows();
  async function unchanged(raw: string, signature: string | null, secret: string | undefined) {
    const response = await deliverInstagramWebhook(sql, { raw, signature, secret });
    assert.equal(response.status, 200);
    assert.deepEqual(await rows(), before);
  }

  const good = message(CODE);
  await unchanged(good, "sha256=" + "ab".repeat(32), SECRET);
  await unchanged(good, null, SECRET);
  await unchanged(good, sign(good), undefined);
  await unchanged(good, sign(good), "");
  await unchanged(message("ZZZZZZZZZZ"), sign(message("ZZZZZZZZZZ")), SECRET);
  const two = message(`${CODE} ZZZZZZZZZZ`);
  await unchanged(two, sign(two), SECRET);
  const twoMessages = JSON.stringify({
    object: "instagram",
    entry: [{ messaging: [{ message: { text: CODE } }, { message: { text: "ZZZZZZZZZZ" } }] }],
  });
  await unchanged(twoMessages, sign(twoMessages), SECRET);

  const paid = await deliverInstagramWebhook(sql, { raw: good, signature: sign(good), secret: SECRET });
  assert.equal(paid.status, 200);
  const after = await rows();
  assert.deepEqual(
    after.filter((row) => row.source === "instagram"),
    [{ id: `instagram-${USER}`, user_id: USER, source: "instagram", source_id: USER, points: 20 }],
  );
  assert.equal(after.length, before.length + 1);

  const again = await deliverInstagramWebhook(sql, { raw: good, signature: sign(good), secret: SECRET });
  assert.equal(again.status, 200);
  assert.deepEqual(await rows(), after);

  const loaded = await readRewardGrants(sql, USER);
  const bySource = Object.fromEntries(loaded.map((row) => [row.source, row]));
  assert.equal(bySource.beta?.points, 150);
  assert.equal(bySource.referral?.points, 20);
  assert.equal(bySource.referral?.name, "Riley Hale");
  assert.equal(bySource.instagram?.points, 20);
  assert.equal(bySource.instagram?.name, "");
  assert.equal(loaded.length, 3);
});
