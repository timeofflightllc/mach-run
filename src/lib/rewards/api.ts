import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const rewardsAcceptanceFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ accepted: boolean }> => {
    const { rewardsTermsAccepted } = await import("./acceptance.server");
    return { accepted: await rewardsTermsAccepted(context.userId) };
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
