import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { ADVISOR_MFA_COOKIE, advisorMfaProofMatches, turnOffAdvisorCheck } from "./advisor-mfa.server";
import { auth } from "./server";

const bearerMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    return next({ context: { bearerToken: context.bearerToken as string | undefined } });
  });

export const advisorMfaStatusFn = createServerFn({ method: "GET" })
  .middleware([bearerMiddleware])
  .handler(async ({ context }): Promise<{ enrolled: boolean; proven: boolean }> => {
    const request = getRequest();
    if (!request) return { enrolled: false, proven: false };
    const headers = new Headers(request.headers);
    if (context.bearerToken) headers.set("Authorization", `Bearer ${context.bearerToken}`);
    const session = await auth.api.getSession({ headers });
    const userId = session?.user?.id;
    const token = session?.session?.token;
    const sessionId = session?.session?.id;
    if (!userId || !token || !sessionId) return { enrolled: false, proven: false };

    const sql = await getSql();
    const users = await sql.query<{ twoFactorEnabled: boolean | null }>(
      `select "twoFactorEnabled" from "user" where id = $1 limit 1`,
      [userId],
    );
    const passkeys = await sql.query<{ id: string }>(
      `select id from "passkey" where "userId" = $1 limit 1`,
      [userId],
    );
    const enrolled = Boolean(users[0]?.twoFactorEnabled) || Boolean(passkeys[0]);

    const cookieOk = advisorMfaProofMatches(token, getCookie(ADVISOR_MFA_COOKIE));
    let rowOk = false;
    if (!cookieOk) {
      const rows = await sql.query<{ value: string; expiresAt: Date | string }>(
        `select value, "expiresAt" from "verification" where identifier = $1 limit 1`,
        [`advisor-mfa:${sessionId}`],
      );
      const row = rows[0];
      rowOk = Boolean(
        row &&
          row.value === userId &&
          new Date(row.expiresAt).getTime() > Date.now(),
      );
    }
    return { enrolled, proven: enrolled && (cookieOk || rowOk) };
  });

export const turnOffAdvisorCheckFn = createServerFn({ method: "POST" })
  .middleware([bearerMiddleware])
  .validator((input: { code?: string; backup?: boolean; passkey?: boolean }) => ({
    code: String(input?.code ?? "").trim(),
    backup: Boolean(input?.backup),
    passkey: Boolean(input?.passkey),
  }))
  .handler(async ({ context, data }) => {
    const request = getRequest();
    if (!request) throw new Error("Could not turn the check off.");
    const headers = new Headers(request.headers);
    if (context.bearerToken) headers.set("Authorization", `Bearer ${context.bearerToken}`);
    const session = await auth.api.getSession({ headers });
    const userId = session?.user?.id;
    if (!userId) throw new Error("Could not turn the check off.");
    await turnOffAdvisorCheck(
      userId,
      { code: data.code || undefined, backup: data.backup, passkey: data.passkey },
      context.bearerToken,
    );
    return { ok: true as const };
  });
