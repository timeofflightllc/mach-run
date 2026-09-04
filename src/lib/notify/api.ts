import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { readEmailPrefs, writeOptionalEmails } from "./prefs.server";
import { isNotifyOwner, notifyConfigured, notifyOwnerOfSignup } from "./signup";

async function emailFor(userId: string): Promise<string | null> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ email: string }>(
      `select email from "user" where id = $1 limit 1`,
      [userId],
    );
    return rows[0]?.email ?? null;
  } catch {
    return null;
  }
}

export const signupAlertStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = await emailFor(context.userId);
    return {
      owner: isNotifyOwner(email),
      configured: notifyConfigured(),
    };
  });

export const sendTestSignupAlert = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = await emailFor(context.userId);
    if (!isNotifyOwner(email)) {
      throw new Error("Signup alerts can only be tested from the owner inbox.");
    }
    const result = await notifyOwnerOfSignup({
      id: context.userId,
      name: "Test ping (not a real signup)",
      email,
    });
    if (result.ok) return { ok: true as const };
    throw new Error(result.reason);
  });

export const emailPrefsStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => readEmailPrefs(context.userId));

export const setOptionalEmails = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { optionalOk: boolean }) => ({
    optionalOk: Boolean(input?.optionalOk),
  }))
  .handler(async ({ context, data }) => writeOptionalEmails(context.userId, data.optionalOk));
