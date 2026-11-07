import { createMiddleware, createServerFn } from "@tanstack/react-start";
import type { ConversionWindow } from "./desk";

const opsSessionMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    return next({ context: { bearerToken: context.bearerToken as string | undefined } });
  });

export const conversionDeskFn = createServerFn({ method: "GET" })
  .middleware([opsSessionMiddleware])
  .handler(async ({ context }): Promise<{ allowed: false } | { allowed: true; windows: ConversionWindow[] }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false };
    const { loadConversionCounts } = await import("./desk.server");
    return { allowed: true, windows: await loadConversionCounts() };
  });
