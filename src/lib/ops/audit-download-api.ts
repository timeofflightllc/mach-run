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

/** True only when the signed-in email is on MACH_OWNER_EMAILS. Never returns the list. */
export const canDownloadInvestmentAudit = createServerFn({ method: "GET" })
  .middleware([ownerSession])
  .handler(async ({ context }) => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    return { allowed: Boolean(actor) };
  });
