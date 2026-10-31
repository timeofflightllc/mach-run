import { createHmac, timingSafeEqual } from "node:crypto";
import { createAuthMiddleware } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";

export const ADVISOR_MFA_COOKIE = "__Host-mach-advisor-mfa";

const PROOF_PATHS = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/passkey/verify-authentication",
  "/passkey/verify-registration",
]);

type ProofSession = {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
};

function mfaSecret(): string {
  const fromEnv = process.env.BETTER_AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  const preview = (globalThis as { __grokAuthPreviewSecret__?: string }).__grokAuthPreviewSecret__;
  return preview || "mach-advisor-mfa";
}

export function advisorMfaProof(sessionToken: string): string {
  return createHmac("sha256", mfaSecret()).update(sessionToken).digest("base64url");
}

export function advisorMfaProofMatches(sessionToken: string, cookie: string | null | undefined): boolean {
  if (!cookie || !sessionToken) return false;
  const expected = advisorMfaProof(sessionToken);
  const left = Buffer.from(expected);
  const right = Buffer.from(cookie);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function proofSession(ctx: {
  context: {
    newSession?: { session?: { id?: string; token?: string; expiresAt?: Date | string }; user?: { id?: string } } | null;
    session?: { session?: { id?: string; token?: string; expiresAt?: Date | string }; user?: { id?: string } } | null;
  };
}): ProofSession | null {
  const fresh = ctx.context.newSession;
  const current = ctx.context.session;
  const picked = fresh?.session?.token ? fresh : current?.session?.token ? current : null;
  const session = picked?.session;
  const userId = picked?.user?.id;
  if (!session?.id || !session.token || !userId) return null;
  const expiresAt = session.expiresAt ? new Date(session.expiresAt) : new Date(Date.now() + 60 * 60 * 1000);
  if (Number.isNaN(expiresAt.getTime())) return null;
  return { id: session.id, token: session.token, userId, expiresAt };
}

function failed(returned: unknown): boolean {
  if (!returned) return true;
  if (returned instanceof Response) return returned.status >= 400;
  if (typeof returned === "object" && returned && "statusCode" in returned) {
    const code = (returned as { statusCode?: unknown }).statusCode;
    return typeof code === "number" && code >= 400;
  }
  return false;
}

function stampCookie(
  ctx: {
    setCookie: (name: string, value: string, attributes: Record<string, unknown>) => void;
    context: { responseHeaders?: Headers };
  },
  token: string,
) {
  const value = advisorMfaProof(token);
  const attributes = { httpOnly: true, secure: true, sameSite: "lax", path: "/" };
  ctx.setCookie(ADVISOR_MFA_COOKIE, value, attributes);
  ctx.context.responseHeaders?.append(
    "set-cookie",
    `${ADVISOR_MFA_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax`,
  );
}

function clearCookie(ctx: {
  setCookie: (name: string, value: string, attributes: Record<string, unknown>) => void;
  context: { responseHeaders?: Headers };
}) {
  ctx.setCookie(ADVISOR_MFA_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  ctx.context.responseHeaders?.append(
    "set-cookie",
    `${ADVISOR_MFA_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

/** Sets the advisor proof cookie after a real code or passkey. Does not log anyone out. */
export function advisorMfaStampPlugin(): BetterAuthPlugin {
  return {
    id: "advisor-mfa-stamp",
    hooks: {
      after: [
        {
          matcher: (ctx: { path?: string }) =>
            ctx.path === "/sign-out" || PROOF_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            try {
              if (ctx.path === "/sign-out") {
                clearCookie(ctx);
                return;
              }
              if (failed(ctx.context.returned)) return;
              const session = proofSession(ctx);
              if (!session) return;
              const identifier = `advisor-mfa:${session.id}`;
              await ctx.context.internalAdapter
                .deleteVerificationByIdentifier(identifier)
                .catch(() => undefined);
              await ctx.context.internalAdapter.createVerificationValue({
                value: session.userId,
                identifier,
                expiresAt: session.expiresAt,
              });
              stampCookie(ctx, session.token);
            } catch {
              /* A missed proof cookie must not break sign-in. */
            }
          }),
        },
      ],
    },
  } as BetterAuthPlugin;
}

/** Turns the advisor check off after a code, a backup code, or a passkey from this device. */
export async function turnOffAdvisorCheck(
  userId: string,
  input: { code?: string; backup?: boolean; passkey?: boolean },
  bearerToken?: string,
): Promise<void> {
  const { proveAdvisorFactor } = await import("./delete-account.server");
  await proveAdvisorFactor(userId, input, bearerToken);
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql.query(`update "user" set "twoFactorEnabled" = false where id = $1`, [userId]);
  await sql.query(`delete from "twoFactor" where "userId" = $1`, [userId]).catch(() => undefined);
  await sql.query(`delete from passkey where "userId" = $1`, [userId]).catch(() => undefined);
  await sql
    .query(`delete from "verification" where identifier like $1 and value = $2`, [
      "advisor-mfa:%",
      userId,
    ])
    .catch(() => undefined);
}
