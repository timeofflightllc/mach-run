/**
 * Optional Cloudflare Turnstile + rate limit for email register.
 * Turnstile runs ONLY when TURNSTILE_SECRET_KEY is set.
 * The “no user until the code is accepted” path does not need Cloudflare.
 */
import { getSql } from "@/lib/db";

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

export function turnstileSecretConfigured(): boolean {
  return Boolean(env("TURNSTILE_SECRET_KEY"));
}

export function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 64);
  const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff.slice(0, 64);
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = env("TURNSTILE_SECRET_KEY");
  if (!secret) return true;
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function tooManySignups(ip: string): Promise<boolean> {
  const sql = await getSql();
  await sql.query(`
    create table if not exists signup_rate (
      key text primary key,
      hits integer not null default 0,
      window_start timestamptz not null default now()
    )
  `);
  const key = `ip:${ip}`;
  const rows = await sql.query<{ hits: number; window_start: string | Date }>(
    `select hits, window_start from signup_rate where key = $1 limit 1`,
    [key],
  );
  const now = Date.now();
  const row = rows[0];
  if (!row) {
    await sql.query(
      `insert into signup_rate (key, hits, window_start) values ($1, 1, now())
       on conflict (key) do update set hits = signup_rate.hits + 1`,
      [key],
    );
    return false;
  }
  const start = new Date(row.window_start).getTime();
  const windowMs = 15 * 60 * 1000;
  if (!Number.isFinite(start) || now - start > windowMs) {
    await sql.query(`update signup_rate set hits = 1, window_start = now() where key = $1`, [key]);
    return false;
  }
  if (row.hits >= 3) return true;
  await sql.query(`update signup_rate set hits = hits + 1 where key = $1`, [key]);
  return false;
}

export async function gateEmailSignup(request: Request): Promise<Response | null> {
  return Response.json(
    {
      message:
        "An account is not created until the email code is confirmed. Start from Register.",
    },
    { status: 403 },
  );
}
