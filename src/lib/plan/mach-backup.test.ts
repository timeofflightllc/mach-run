import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptBackup, encryptBackup } from "./mach-backup.ts";

const SECRET = "correct-horse-battery";
const PLAN = {
  type: "mach-run-profile",
  version: 1,
  name: "AardvarkHousehold",
  plan: {
    portfolios: [{ id: "p1", name: "AardvarkHousehold Brokerage", balance: 1234567.89 }],
  },
};

test("encryptBackup rejects an empty password", async () => {
  await assert.rejects(() => encryptBackup(PLAN, ""), /empty/i);
  await assert.rejects(() => encryptBackup(PLAN, "   "), /empty/i);
});

test("round-trip a tiny fake plan", async () => {
  const file = await encryptBackup(PLAN, SECRET);
  const back = (await decryptBackup(file, SECRET)) as typeof PLAN;
  assert.equal(back.name, PLAN.name);
  assert.equal(back.plan.portfolios[0]?.balance, 1234567.89);
});

test("wrong password fails", async () => {
  const file = await encryptBackup(PLAN, SECRET);
  await assert.rejects(() => decryptBackup(file, "wrong-password"), /password/i);
});

test("file text must not contain the account name or dollar amount", async () => {
  const file = await encryptBackup(PLAN, SECRET);
  assert.equal(file.includes("AardvarkHousehold"), false);
  assert.equal(file.includes("1234567.89"), false);
  assert.equal(file.includes("1234567"), false);
  const env = JSON.parse(file) as { type: string; ciphertext: string };
  assert.equal(env.type, "mach-run-backup");
  assert.ok(env.ciphertext.length > 20);
});

test("unknown type is rejected", async () => {
  await assert.rejects(
    () => decryptBackup(JSON.stringify({ type: "nope", version: 1 }), SECRET),
    /unknown/i,
  );
});
