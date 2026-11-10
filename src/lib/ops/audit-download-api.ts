import { createMiddleware, createServerFn } from "@tanstack/react-start";

const ownerSession = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    return next({
      context: { bearerToken: context.bearerToken as string | undefined },
    });
  });

/**
 * Yes or no only. True for an ops owner, or for this session's user when
 * "superBeta" is on. Never returns a plan, a balance, or the CSV.
 * A missing session, a missing column, or a failed read is not allowed.
 */
export const canDownloadInvestmentAudit = createServerFn({ method: "GET" })
  .middleware([ownerSession])
  .handler(async ({ context }) => {
    try {
      const { getOpsActor } = await import("./gate.server");
      const actor = await getOpsActor(context.bearerToken);
      if (actor) return { allowed: true };

      const { getSessionUser } = await import("@/lib/auth/verify.server");
      const user = await getSessionUser(context.bearerToken);
      if (!user?.id) return { allowed: false };

      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      const rows = await sql.query<{ superBeta: boolean }>(
        `select "superBeta" from "user" where id = $1 limit 1`,
        [user.id],
      );
      return { allowed: rows[0]?.superBeta === true };
    } catch {
      return { allowed: false };
    }
  });
