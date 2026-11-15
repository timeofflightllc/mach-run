import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { RewardGrant } from "./balance.server";

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
  .handler(async ({ context }): Promise<{ balance: number; grants: RewardGrant[] }> => {
    const { loadRewardGrants, rewardBalance } = await import("./balance.server");
    const [balance, grants] = await Promise.all([
      rewardBalance(context.userId),
      loadRewardGrants(context.userId),
    ]);
    return { balance, grants };
  });

export const applyRewardPointsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { points?: unknown }) => ({
    points: typeof input?.points === "number" ? input.points : Number.NaN,
  }))
  .handler(async ({ context, data }): Promise<{ ok: true; balance: number; line: string } | { ok: false; error: string }> => {
    const { applyRewardPoints } = await import("./apply.server");
    return applyRewardPoints(context.userId, data.points);
  });

