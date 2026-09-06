import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 8;

async function ensureTable() {
  const sql = await getSql();
  await sql.query(`
    create table if not exists email_verify_codes (
      user_id text primary key references "user" ("id") on delete cascade,
      code_hash text not null,
      expires_at timestamptz not null,
      attempts integer not null default 0,
      created_at timestamptz not null default now(),
      emailed_at timestamptz
    )
  `);
  await sql.query(
    `alter table email_verify_codes add column if not exists emailed_at timestamptz`,
  );
}

function hashCode(userId: string, code: string): string {
  const secret = (process.env.BETTER_AUTH_SECRET ?? "mach-run-verify").trim();
  return createHash("sha256").update(`${secret}:${userId}:${code}`).digest("hex");
}

function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function issueVerifyCode(userId: string): Promise<string> {
  await ensureTable();
  const code = String(randomInt(100000, 1000000));
  const sql = await getSql();
  await sql.query(
    `insert into email_verify_codes (user_id, code_hash, expires_at, attempts, created_at, emailed_at)
     values ($1, $2, $3, 0, now(), null)
     on conflict (user_id) do update set
       code_hash = excluded.code_hash,
       expires_at = excluded.expires_at,
       attempts = 0,
       created_at = now(),
       emailed_at = null`,
    [userId, hashCode(userId, code), new Date(Date.now() + TTL_MS).toISOString()],
  );
  return code;
}

/** Signup after-hook can run before the user row is visible to the FK. */
export async function issueVerifyCodeRetry(userId: string): Promise<string> {
  let last: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await issueVerifyCode(userId);
    } catch (err) {
      last = err;
      await sleep(200 * (attempt + 1));
    }
  }
  throw last instanceof Error ? last : new Error("Could not issue a verify code.");
}

export async function markCodeEmailed(userId: string): Promise<void> {
  await ensureTable();
  const sql = await getSql();
  await sql.query(`update email_verify_codes set emailed_at = now() where user_id = $1`, [userId]);
}

export async function verifyEmailMeta(userId: string): Promise<{
  hasCode: boolean;
  emailedAt: Date | null;
}> {
  await ensureTable();
  const sql = await getSql();
  const rows = await sql.query<{ emailed_at: string | Date | null }>(
    `select emailed_at from email_verify_codes where user_id = $1 limit 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return { hasCode: false, emailedAt: null };
  return {
    hasCode: true,
    emailedAt: row.emailed_at ? new Date(row.emailed_at) : null,
  };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function consumeVerifyCode(
  userId: string,
  rawCode: string,
): Promise<VerifyResult> {
  const code = rawCode.replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) return { ok: false, reason: "Enter the 6-digit code from the email." };
  await ensureTable();
  const sql = await getSql();
  const rows = await sql.query<{
    code_hash: string;
    expires_at: string | Date;
    attempts: number;
  }>(
    `select code_hash, expires_at, attempts from email_verify_codes where user_id = $1 limit 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: "No code on file. Use Resend code." };

  const expires = new Date(row.expires_at).getTime();
  if (Number.isFinite(expires) && expires < Date.now()) {
    return { ok: false, reason: "That code expired. Use Resend code." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "Too many tries. Use Resend code." };
  }

  if (!hashesEqual(row.code_hash, hashCode(userId, code))) {
    await sql.query(
      `update email_verify_codes set attempts = attempts + 1 where user_id = $1`,
      [userId],
    );
    return { ok: false, reason: "That code does not match." };
  }

  await sql.query(`delete from email_verify_codes where user_id = $1`, [userId]);
  await sql.query(
    `update "user" set "emailVerified" = true, "updatedAt" = now() where id = $1`,
    [userId],
  );
  return { ok: true };
}

export async function deliverVerifyEmail(input: {
  userId: string;
  name: string | null;
  email: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { sendWelcomeSignupEmail } = await import("../notify/signup");
  const code = await issueVerifyCodeRetry(input.userId);
  const sent = await sendWelcomeSignupEmail({
    id: input.userId,
    name: input.name,
    email: input.email,
    code,
  });
  if (!sent.ok) return { ok: false, reason: sent.reason };
  await markCodeEmailed(input.userId);
  return { ok: true };
}
