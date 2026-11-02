import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { ReferralPerson, ReferralSummary } from "./page.server";

export const recordCampaignClickFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { recordCampaignClick } = await import("./clicks.server");
    await recordCampaignClick();
    return { ok: true as const };
  });

export const referralSummaryFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ReferralSummary> => {
    const { loadReferralSummary } = await import("./page.server");
    return loadReferralSummary(context.userId);
  });

export const referralPeopleFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ReferralPerson[]> => {
    const { loadReferralPeople } = await import("./page.server");
    return loadReferralPeople(context.userId);
  });
