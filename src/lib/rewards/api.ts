import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { RewardGrant, RewardStanding } from "./balance.server";

export const rewardsAcceptanceFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ accepted: boolean; acceptedAt: string | null }> => {
    const { rewardsAcceptedAt, rewardsTermsAccepted } = await import("./acceptance.server");
    const [accepted, acceptedAt] = await Promise.all([
      rewardsTermsAccepted(context.userId),
      rewardsAcceptedAt(context.userId),
    ]);
    return { accepted, acceptedAt: accepted ? acceptedAt : null };
  });

export const acceptRewardsTermsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true } | { ok: false; reason: string }> => {
    try {
      const { acceptRewardsTerms } = await import("./acceptance.server");
      await acceptRewardsTerms(context.userId);
      return { ok: true };
    } catch {
      return { ok: false, reason: "Could not save that. Try again." };
    }
  });

export const instagramRewardCodeFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ code: string | null }> => {
    const { instagramRewardCode } = await import("./instagram.server");
    return { code: await instagramRewardCode(context.userId) };
  });

export const rewardLedgerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<RewardStanding & { grants: RewardGrant[] }> => {
    const { loadRewardGrants, rewardStanding } = await import("./balance.server");
    const [standing, grants] = await Promise.all([
      rewardStanding(context.userId),
      loadRewardGrants(context.userId),
    ]);
    return { ...standing, grants };
  });

export const applyRewardPointsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { points?: unknown }) => ({
    points: typeof input?.points === "number" ? input.points : Number.NaN,
  }))
  .handler(async ({ context, data }) => {
    const { applyRewardPoints } = await import("./apply.server");
    return applyRewardPoints(context.userId, data.points);
  });

