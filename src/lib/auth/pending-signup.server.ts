/**
 * Email/password accounts are created ONLY after the 6-digit code is accepted.
 * Register stores a pending row (not a user). Bots that never open the inbox
 * never appear in "user" and never ping the owner.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { isDisposableEmail } from "./disposable-email";
import { clientIp, tooManySignups, verifyTurnstile } from "./signup-gate.server";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export type PendingResult = { ok: true } | { ok: false; reason: string };

function secret(): string {
  return (process.env.BETTER_AUTH_SECRET ?? "mach-run-pending").trim();
}

function aesKey(): Buffer {
  return createHash("sha256").update(`pending-pw:${secret()}`).digest();
}

function encryptPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptPassword(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < 29) throw new Error("bad blob");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", aesKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`${secret()}:${email}:${code}`).digest("hex");
}

async function ensurePendingTable() {
  const sql = await getSql();
  await sql.query(`
    create table if not exists pending_signups (
      email text primary key,
      name text,
      password_blob text not null,
      code_hash text not null,
      expires_at timestamptz not null,
      attempts integer not null default 0,
      created_at timestamptz not null default now(),
      emailed_at timestamptz
    )
  `);
}

async function purgeStaleUnverifiedUsers() {
  const sql = await getSql();
  try {
    await sql.query(`
      delete from "user" u
      where u."emailVerified" = false
        and u."createdAt" < now() - interval '2 hours'
        and exists (
          select 1 from account a
          where a."userId" = u.id and a."providerId" = 'credential'
        )
    `);
  } catch {
    /* table names differ in some previews — skip */
  }
  await sql.query(`delete from pending_signups where expires_at < now()`);
}

function requestIp(): string {
  const req = getRequest();
  return req ? clientIp(req) : "unknown";
}

export async function startPendingSignup(input: {
  email: string;
  password: string;
  name: string;
  captcha: string;
  honeypot: string;
}): Promise<PendingResult> {
  await ensurePendingTable();
  await purgeStaleUnverifiedUsers();

  if (input.honeypot.trim()) return { ok: true };

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const name = input.name.trim() || email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, reason: "Password must be at least 8 characters." };
  }
  if (isDisposableEmail(email)) {
    return { ok: false, reason: "Use a lasting email address, not a temporary inbox." };
  }

  const ip = requestIp();
  if (!(await verifyTurnstile(input.captcha, ip))) {
    return { ok: false, reason: "Confirm you’re not a robot, then try again." };
  }
  if (await tooManySignups(ip)) {
    return { ok: false, reason: "Too many new accounts from this network. Try again later." };
  }

  const sql = await getSql();
  const existing = await sql.query<{ id: string }>(
    `select id from "user" where lower(email) = $1 limit 1`,
    [email],
  );
  if (existing[0]) {
    return { ok: false, reason: "That email already has an account. Sign in instead." };
  }

  const prior = await sql.query<{ emailed_at: string | Date | null }>(
    `select emailed_at from pending_signups where email = $1 limit 1`,
    [email],
  );
  const emailedAt = prior[0]?.emailed_at ? new Date(prior[0].emailed_at).getTime() : 0;
  if (emailedAt && Date.now() - emailedAt < 2 * 60 * 1000) {
    return { ok: true };
  }

  const code = String(randomInt(100000, 1000000));
  await sql.query(
    `insert into pending_signups (email, name, password_blob, code_hash, expires_at, attempts, created_at, emailed_at)
     values ($1, $2, $3, $4, $5, 0, now(), now())
     on conflict (email) do update set
       name = excluded.name,
       password_blob = excluded.password_blob,
       code_hash = excluded.code_hash,
       expires_at = excluded.expires_at,
       attempts = 0,
       emailed_at = now()`,
    [email, name, encryptPassword(password), hashCode(email, code), new Date(Date.now() + TTL_MS).toISOString()],
  );

  const { sendWelcomeSignupEmail } = await import("../notify/signup");
  const sent = await sendWelcomeSignupEmail({ id: "pending", name, email, code });
  if (!sent.ok && !sent.skipped) {
    return { ok: false, reason: "Could not send the verification email. Try again in a minute." };
  }
  return { ok: true };
}

export async function resendPendingSignup(emailRaw: string): Promise<PendingResult> {
  await ensurePendingTable();
  const email = emailRaw.trim().toLowerCase();
  const sql = await getSql();
  const rows = await sql.query<{ name: string | null; emailed_at: string | Date | null }>(
    `select name, emailed_at from pending_signups where email = $1 limit 1`,
    [email],
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: "No pending registration for that email. Start at Register." };
  const emailedAt = row.emailed_at ? new Date(row.emailed_at).getTime() : 0;
  if (emailedAt && Date.now() - emailedAt < 2 * 60 * 1000) {
    return { ok: true };
  }
  const code = String(randomInt(100000, 1000000));
  await sql.query(
    `update pending_signups
     set code_hash = $2, expires_at = $3, attempts = 0, emailed_at = now()
     where email = $1`,
    [email, hashCode(email, code), new Date(Date.now() + TTL_MS).toISOString()],
  );
  const { sendWelcomeSignupEmail } = await import("../notify/signup");
  const sent = await sendWelcomeSignupEmail({
    id: "pending",
    name: row.name,
    email,
    code,
  });
  if (!sent.ok && !sent.skipped) {
    return { ok: false, reason: "Could not resend. Try again in a minute." };
  }
  return { ok: true };
}

export async function completePendingSignup(input: {
  email: string;
  code: string;
}): Promise<PendingResult> {
  await ensurePendingTable();
  const email = input.email.trim().toLowerCase();
  const code = input.code.replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) return { ok: false, reason: "Enter the 6-digit code from the email." };

  const sql = await getSql();
  const rows = await sql.query<{
    name: string | null;
    password_blob: string;
    code_hash: string;
    expires_at: string | Date;
    attempts: number;
  }>(
    `select name, password_blob, code_hash, expires_at, attempts from pending_signups where email = $1 limit 1`,
    [email],
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: "No pending registration for that email. Start at Register." };

  const expires = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expires) || expires < Date.now()) {
    return { ok: false, reason: "That code expired. Use Resend code." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "Too many tries. Use Resend code." };
  }
  if (hashCode(email, code) !== row.code_hash) {
    await sql.query(`update pending_signups set attempts = attempts + 1 where email = $1`, [email]);
    return { ok: false, reason: "That code does not match." };
  }

  let password: string;
  try {
    password = decryptPassword(row.password_blob);
  } catch {
    return { ok: false, reason: "That registration is damaged. Start at Register again." };
  }

  const { auth } = await import("./server");
  const req = getRequest();
  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: row.name || email,
      },
      headers: req?.headers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/already|exists/i.test(msg)) {
      await sql.query(`delete from pending_signups where email = $1`, [email]);
      return { ok: false, reason: "That email already has an account. Sign in instead." };
    }
    return { ok: false, reason: msg || "Could not create the account." };
  }

  await sql.query(`update "user" set "emailVerified" = true, "updatedAt" = now() where lower(email) = $1`, [
    email,
  ]);
  await sql.query(`delete from pending_signups where email = $1`, [email]);

  try {
    const created = await sql.query<{ id: string }>(
      `select id from "user" where lower(email) = $1 limit 1`,
      [email],
    );
    const id = created[0]?.id;
    if (id) {
      const { sendFirstFlightEmail } = await import("../notify/signup");
      await sendFirstFlightEmail({ id, name: row.name, email });
    }
  } catch {
    /* mail is best-effort */
  }

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: req?.headers,
    });
  } catch {
    /* cookies may still have been set by sign-up */
  }

  return { ok: true };
}
