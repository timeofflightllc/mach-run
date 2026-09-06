import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export const emailVerifyStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const sql = await getSql();
      const rows = await sql.query<{ verified: boolean }>(
        `select "emailVerified" as verified from "user" where id = $1 limit 1`,
        [context.userId],
      );
      return { verified: Boolean(rows[0]?.verified) };
    } catch {
      return { verified: true };
    }
  });

export const submitEmailVerifyCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code?: string }) => ({
    code: String(input?.code ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { consumeVerifyCode } = await import("./email-verify.server");
    const result = await consumeVerifyCode(context.userId, data.code);
    if (!result.ok) return result;
    try {
      const sql = await getSql();
      const rows = await sql.query<{ email: string | null; name: string | null }>(
        `select email, name from "user" where id = $1 limit 1`,
        [context.userId],
      );
      const user = rows[0];
      if (user?.email) {
        const { sendFirstFlightEmail } = await import("../notify/signup");
        await sendFirstFlightEmail({
          id: context.userId,
          name: user.name,
          email: user.email,
        });
      }
    } catch {
      /* verify already stuck; mail is best-effort */
    }
    return result;
  });

async function sendCodeForSession(userId: string): Promise<
  { ok: true; already?: true } | { ok: false; reason: string }
> {
  const sql = await getSql();
  const rows = await sql.query<{ email: string | null; name: string | null; verified: boolean }>(
    `select email, name, "emailVerified" as verified from "user" where id = $1 limit 1`,
    [userId],
  );
  const user = rows[0];
  if (!user?.email) return { ok: false, reason: "No email on this account." };
  if (user.verified) return { ok: true, already: true };
  const { deliverVerifyEmail } = await import("./email-verify.server");
  const sent = await deliverVerifyEmail({
    userId,
    name: user.name,
    email: user.email,
  });
  if (sent.ok) return { ok: true };
  return { ok: false, reason: sent.reason };
}

export const resendEmailVerifyCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => sendCodeForSession(context.userId));

/** First landing on /verify-email: send if the signup hook never got the mail out. */
export const ensureEmailVerifyCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ email: string | null; name: string | null; verified: boolean }>(
      `select email, name, "emailVerified" as verified from "user" where id = $1 limit 1`,
      [context.userId],
    );
    const user = rows[0];
    if (!user?.email) return { ok: false as const, reason: "No email on this account." };
    if (user.verified) return { ok: true as const, already: true as const };

    const { verifyEmailMeta, deliverVerifyEmail } = await import("./email-verify.server");
    const meta = await verifyEmailMeta(context.userId);
    const emailedAgo = meta.emailedAt ? Date.now() - meta.emailedAt.getTime() : Infinity;
    if (meta.hasCode && meta.emailedAt && emailedAgo < 10 * 60 * 1000) {
      return { ok: true as const };
    }
    const sent = await deliverVerifyEmail({
      userId: context.userId,
      name: user.name,
      email: user.email,
    });
    if (sent.ok) return { ok: true as const };
    return { ok: false as const, reason: sent.reason };
  });
