import { createMiddleware, createServerFn } from "@tanstack/react-start";
import type { BetaDeskDetail, BetaDeskRow, BetaInvite } from "./desk";

const opsSessionMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    return next({ context: { bearerToken: context.bearerToken as string | undefined } });
  });

async function actor(bearerToken: string | undefined) {
  const { getOpsActor } = await import("@/lib/ops/gate.server");
  return getOpsActor(bearerToken);
}

export const betaDeskFn = createServerFn({ method: "GET" })
  .middleware([opsSessionMiddleware])
  .handler(async ({ context }): Promise<{ allowed: false } | { allowed: true; invites: BetaInvite[]; rows: BetaDeskRow[] }> => {
    const who = await actor(context.bearerToken);
    if (!who) return { allowed: false };
    const { betaDesk } = await import("./desk.server");
    return { allowed: true, ...(await betaDesk()) };
  });

export const grantBetaEmailFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { email?: unknown }) => ({ email: input?.email }))
  .handler(async ({ context, data }): Promise<{ allowed: false } | { allowed: true; ok: false; error: string } | { allowed: true; ok: true }> => {
    const who = await actor(context.bearerToken);
    if (!who) return { allowed: false };
    const { grantBetaEmail, normalizeBetaEmail } = await import("./desk.server");
    const email = normalizeBetaEmail(data.email);
    if (!email) return { allowed: true, ok: false, error: "Enter an email address." };
    try {
      await grantBetaEmail(email, who.id);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "23505") return { allowed: true, ok: false, error: "That email is already invited." };
      throw err;
    }
    return { allowed: true, ok: true };
  });

export const setBetaLimitFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { email?: unknown; limit?: unknown }) => ({
    email: input?.email,
    limit: input?.limit,
  }))
  .handler(async ({ context, data }): Promise<{ allowed: false } | { allowed: true; ok: false; error: string } | { allowed: true; ok: true }> => {
    const who = await actor(context.bearerToken);
    if (!who) return { allowed: false };
    const { normalizeBetaEmail, parseBetaLimit, setBetaLimit } = await import("./desk.server");
    const email = normalizeBetaEmail(data.email);
    const limit = parseBetaLimit(data.limit);
    if (!email || limit == null) return { allowed: true, ok: false, error: "Enter a whole number from 0 to 100." };
    const saved = await setBetaLimit(email, limit);
    if (!saved) return { allowed: true, ok: false, error: "That email is not invited." };
    return { allowed: true, ok: true };
  });

export const revokeBetaEmailFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { email?: unknown }) => ({ email: input?.email }))
  .handler(async ({ context, data }): Promise<{ allowed: false } | { allowed: true; ok: true }> => {
    const who = await actor(context.bearerToken);
    if (!who) return { allowed: false };
    const { normalizeBetaEmail, revokeBetaEmail } = await import("./desk.server");
    const email = normalizeBetaEmail(data.email);
    if (email) await revokeBetaEmail(email);
    return { allowed: true, ok: true };
  });

export const betaDeskOneFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { id?: unknown }) => ({ id: typeof input?.id === "string" ? input.id : "" }))
  .handler(async ({ context, data }): Promise<{ allowed: false } | { allowed: true; row: BetaDeskDetail | null }> => {
    const who = await actor(context.bearerToken);
    if (!who) return { allowed: false };
    const { betaDeskOne } = await import("./desk.server");
    return { allowed: true, row: data.id ? await betaDeskOne(data.id) : null };
  });

export const betaDeskCsvFn = createServerFn({ method: "GET" })
  .middleware([opsSessionMiddleware])
  .handler(async ({ context }): Promise<{ allowed: false } | { allowed: true; csv: string }> => {
    const who = await actor(context.bearerToken);
    if (!who) return { allowed: false };
    const { betaDeskCsv } = await import("./desk.server");
    return { allowed: true, csv: await betaDeskCsv() };
  });
