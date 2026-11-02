import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { parseCreditDollars } from "./credit";
import type { CampaignStat } from "./desk";

const opsSessionMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    return next({ context: { bearerToken: context.bearerToken as string | undefined } });
  });

export const referralDeskFn = createServerFn({ method: "GET" })
  .middleware([opsSessionMiddleware])
  .handler(async ({ context }): Promise<{ allowed: false } | { allowed: true; dollars: number; campaigns: CampaignStat[] }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false };
    const { referralDesk } = await import("./desk.server");
    return { allowed: true, ...(await referralDesk(actor.id)) };
  });

export const saveReferralCreditFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { dollars?: unknown }) => ({ dollars: input?.dollars }))
  .handler(async ({ context, data }): Promise<{ allowed: false } | { allowed: true; ok: false; error: string } | { allowed: true; ok: true; dollars: number }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false };
    const dollars = parseCreditDollars(data.dollars);
    if (dollars == null) return { allowed: true, ok: false, error: "Enter a whole dollar amount from 0 to 1000." };
    const { saveReferralDollars } = await import("./desk.server");
    await saveReferralDollars(dollars);
    return { allowed: true, ok: true, dollars };
  });

export const createReferralCampaignFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { name?: unknown }) => ({
    name: typeof input?.name === "string" ? input.name : "",
  }))
  .handler(async ({ context, data }): Promise<{ allowed: false } | { allowed: true; ok: false; error: string } | { allowed: true; ok: true; code: string }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false };
    const name = data.name.trim();
    if (!name || name.length > 80) return { allowed: true, ok: false, error: "Name the campaign." };
    const { addOwnerCampaign } = await import("./desk.server");
    const code = await addOwnerCampaign(actor.id, name);
    return { allowed: true, ok: true, code };
  });
