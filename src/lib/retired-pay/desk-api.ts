import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { listPayYears, parsePayUpload, type PayFiles, type PayYearRow } from "./catalog.ts";

const opsSessionMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    return next({ context: { bearerToken: context.bearerToken as string | undefined } });
  });

function filesFrom(input: Partial<PayFiles> | null | undefined): PayFiles {
  return {
    officers: typeof input?.officers === "string" ? input.officers : "",
    prior: typeof input?.prior === "string" ? input.prior : "",
    warrant: typeof input?.warrant === "string" ? input.warrant : "",
    enlisted: typeof input?.enlisted === "string" ? input.enlisted : "",
  };
}

export const listPayTablesFn = createServerFn({ method: "GET" })
  .middleware([opsSessionMiddleware])
  .handler(async ({ context }): Promise<{ allowed: true; rows: PayYearRow[] } | { allowed: false }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false };
    const { OFFICIAL_SEED } = await import("./official-seed.ts");
    const { listUploadedTables } = await import("./store.server.ts");
    const uploaded = await listUploadedTables().catch(() => []);
    return { allowed: true, rows: listPayYears(OFFICIAL_SEED, uploaded) };
  });

export const readPayUploadFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: Partial<PayFiles>) => filesFrom(input))
  .handler(async ({ context, data }): Promise<{ allowed: false } | { allowed: true; ok: false; error: string } | { allowed: true; ok: true; year: number; spot: number }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false };
    const parsed = parsePayUpload(data);
    if (!parsed.ok) return { allowed: true, ok: false, error: parsed.error };
    return { allowed: true, ok: true, year: parsed.table.effectiveYear, spot: parsed.spot };
  });

export const savePayUploadFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: Partial<PayFiles>) => filesFrom(input))
  .handler(async ({ context, data }): Promise<{ allowed: false } | { allowed: true; ok: false; error: string } | { allowed: true; ok: true; year: number }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false };
    const parsed = parsePayUpload(data);
    if (!parsed.ok) return { allowed: true, ok: false, error: parsed.error };
    const { saveUploadedTable } = await import("./store.server.ts");
    await saveUploadedTable(parsed.table);
    return { allowed: true, ok: true, year: parsed.table.effectiveYear };
  });
