import { verifyPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { loadSubscription } from "@/lib/billing/stripe.server";
import {
  DELETE_REAUTH_MS,
  isCredentialProvider,
  labelForProviderId,
  type DeleteProvider,
} from "./delete-account";

async function cancelStripeIfAny(userId: string): Promise<void> {
  try {
    const row = await loadSubscription(userId);
    const subId = row?.stripe_subscription_id?.trim();
    const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
    if (!subId || !key) return;
    await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch {
    /* billing cleanup is best-effort — account rows still delete */
  }
}

type LinkedAccount = { providerId: string; password: string | null };

async function linkedAccounts(userId: string): Promise<LinkedAccount[]> {
  const sql = await getSql();
  return sql.query<LinkedAccount>(
    `select "providerId" as "providerId", password from "account" where "userId" = $1`,
    [userId],
  );
}

function passwordHashFrom(rows: LinkedAccount[]): string | null {
  const hit = rows.find((row) => row.password && row.password.length > 0);
  return hit?.password ?? null;
}

export async function loadDeleteOptions(userId: string): Promise<{
  hasPassword: boolean;
  providers: DeleteProvider[];
}> {
  const rows = await linkedAccounts(userId);
  const providers: DeleteProvider[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (isCredentialProvider(row.providerId)) continue;
    const label = labelForProviderId(row.providerId);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    providers.push({ providerId: row.providerId, label });
  }
  return { hasPassword: Boolean(passwordHashFrom(rows)), providers };
}

export async function sessionIsFresh(userId: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query<{ createdAt: Date | string; updatedAt: Date | string }>(
    `select "createdAt", "updatedAt" from "session"
     where "userId" = $1
     order by "updatedAt" desc
     limit 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return false;
  const stamp = new Date(row.updatedAt || row.createdAt).getTime();
  if (!Number.isFinite(stamp)) return false;
  return Date.now() - stamp <= DELETE_REAUTH_MS;
}

async function wipeUserRows(userId: string): Promise<void> {
  const sql = await getSql();
  const users = await sql.query<{ email: string }>(
    `select email from "user" where id = $1 limit 1`,
    [userId],
  );
  const stored = users[0]?.email ?? null;
  await cancelStripeIfAny(userId);
  await sql.query(`delete from mach_plans where user_id = $1`, [userId]).catch(() => undefined);
  await sql.query(`delete from mach_subscriptions where user_id = $1`, [userId]).catch(() => undefined);
  await sql.query(`delete from mach_email_prefs where user_id = $1`, [userId]).catch(() => undefined);
  await sql.query(`delete from email_verify_codes where user_id = $1`, [userId]).catch(() => undefined);
  if (stored) {
    await sql
      .query(`delete from "verification" where "identifier" = $1`, [stored.trim().toLowerCase()])
      .catch(() => undefined);
  }
  await sql.query(`delete from "session" where "userId" = $1`, [userId]);
  await sql.query(`delete from "account" where "userId" = $1`, [userId]);
  await sql.query(`delete from "user" where "id" = $1`, [userId]);
}

export async function deleteAccountForUser(
  userId: string,
  input: { password?: string },
): Promise<void> {
  const options = await loadDeleteOptions(userId);
  if (options.hasPassword) {
    const password = input.password ?? "";
    if (!password) throw new Error("Type your password to confirm.");
    const rows = await linkedAccounts(userId);
    const hash = passwordHashFrom(rows);
    if (!hash) throw new Error("Type your password to confirm.");
    const ok = await verifyPassword({ hash, password });
    if (!ok) throw new Error("That password does not match.");
    await wipeUserRows(userId);
    return;
  }

  if (options.providers.length === 0) {
    throw new Error("Set a MACH RUN password on Account profile first, then delete.");
  }
  const fresh = await sessionIsFresh(userId);
  if (!fresh) {
    throw new Error("Sign in again with Apple, Google, or X, then confirm delete.");
  }
  await wipeUserRows(userId);
}
