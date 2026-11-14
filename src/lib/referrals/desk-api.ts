import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { parseCreditPoints } from "./credit";
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
  .handler(async ({ context }): Promise<{ allowed: false } | { allowed: true; points: number; campaigns: CampaignStat[] }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false };
    const { referralDesk } = await import("./desk.server");
    return { allowed: true, ...(await referralDesk(actor.id)) };
  });

export const saveReferralCreditFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { points?: unknown }) => ({ points: input?.points }))
  .handler(async ({ context, data }): Promise<{ allowed: false } | { allowed: true; ok: false; error: string } | { allowed: true; ok: true; points: number }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false };
    const points = parseCreditPoints(data.points);
    if (points == null) return { allowed: true, ok: false, error: "Enter a whole number of points from 0 to 10000." };
    const { saveReferralPoints } = await import("./desk.server");
    await saveReferralPoints(points);
    return { allowed: true, ok: true, points };
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
