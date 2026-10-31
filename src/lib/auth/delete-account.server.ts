import { verifyPassword } from "better-auth/crypto";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { loadSubscription, packageFromPriceId } from "@/lib/billing/stripe.server";
import { isAdvisorPlan, paidFromStatus, type MachPackage } from "@/lib/billing/limits";
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
  needsFactor: boolean;
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
  return {
    hasPassword: Boolean(passwordHashFrom(rows)),
    providers,
    needsFactor: await advisorNeedsFactor(userId),
  };
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

export async function wipeUserRows(userId: string): Promise<void> {
  const sql = await getSql();
  const users = await sql.query<{ email: string }>(
    `select email from "user" where id = $1 limit 1`,
    [userId],
  );
  const stored = users[0]?.email ?? null;
  await cancelStripeIfAny(userId);
  await sql.query(`delete from mach_plans where user_id = $1`, [userId]).catch(() => undefined);
  await sql.query(`delete from mach_user_activity where user_id = $1`, [userId]).catch(() => undefined);
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

async function advisorNeedsFactor(userId: string): Promise<boolean> {
  const sql = await getSql();
  const users = await sql.query<{ twoFactorEnabled: boolean | null }>(
    `select "twoFactorEnabled" from "user" where id = $1 limit 1`,
    [userId],
  );
  const keys = await sql
    .query<{ n: string }>(`select count(*)::text as n from passkey where "userId" = $1`, [userId])
    .catch(() => [{ n: "0" }]);
  const enrolled = Boolean(users[0]?.twoFactorEnabled) || Number(keys[0]?.n ?? 0) > 0;
  if (!enrolled) return false;
  const subs = await sql
    .query<{ status: string | null; price_id: string | null; advisor_grant: boolean | null }>(
      `select status, price_id, advisor_grant from mach_subscriptions where user_id = $1 limit 1`,
      [userId],
    )
    .catch(() => []);
  const row = subs[0];
  const paid = paidFromStatus(row?.status);
  const billed = paid ? packageFromPriceId(row?.price_id) : null;
  const plan: MachPackage = paid && row?.advisor_grant ? "advisor" : (billed ?? "free");
  return isAdvisorPlan(plan);
}

export async function proveAdvisorFactor(
  userId: string,
  input: { code?: string; backup?: boolean; passkey?: boolean },
  bearerToken?: string,
): Promise<void> {
  const request = getRequest();
  const headers = new Headers(request?.headers);
  if (bearerToken) headers.set("Authorization", `Bearer ${bearerToken}`);
  const code = input.code?.trim() ?? "";
  if (code) {
    const { auth } = await import("./server");
    try {
      const checked = input.backup
        ? await auth.api.verifyBackupCode({ body: { code }, headers, asResponse: true })
        : await auth.api.verifyTOTP({ body: { code }, headers, asResponse: true });
      if (!checked.ok) throw new Error("That code did not work.");
    } catch (err) {
      if (err instanceof Error && err.message === "That code did not work.") throw err;
      throw new Error("That code did not work.");
    }
    return;
  }
  if (!input.passkey) {
    throw new Error("Enter a current code, or use Face ID or this device.");
  }
  const { auth } = await import("./server");
  const session = await auth.api.getSession({ headers });
  const sessionId = session?.session?.id;
  if (!sessionId || session.user.id !== userId) {
    throw new Error("Use Face ID or this device, then delete.");
  }
  const sql = await getSql();
  const rows = await sql.query<{ createdAt: Date | string }>(
    `select "createdAt" from "verification" where identifier = $1 and value = $2 limit 1`,
    [`advisor-mfa:${sessionId}`, userId],
  );
  const stamp = rows[0] ? new Date(rows[0].createdAt).getTime() : 0;
  if (!stamp || Date.now() - stamp > 2 * 60 * 1000) {
    throw new Error("Use Face ID or this device, then delete.");
  }
}

export async function deleteAccountForUser(
  userId: string,
  input: { password?: string; code?: string; backup?: boolean; passkey?: boolean },
  bearerToken?: string,
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
  } else if (options.providers.length === 0) {
    throw new Error("Set a MACH RUN password on Account profile first, then delete.");
  } else {
    const fresh = await sessionIsFresh(userId);
    if (!fresh) {
      throw new Error("Sign in again with Apple, Google, or X, then confirm delete.");
    }
  }

  if (options.needsFactor) {
    await proveAdvisorFactor(userId, input, bearerToken);
  }
  await wipeUserRows(userId);
}
