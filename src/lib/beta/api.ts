import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { BetaPage } from "./form";

export type { BetaPage } from "./form";

export const betaAccountLinkFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { loadBetaAccountLink } = await import("./page.server");
    return loadBetaAccountLink(context.userId);
  });

export const betaPageFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BetaPage> => {
    const { loadBetaPage } = await import("./page.server");
    return loadBetaPage(context.userId);
  });

export const saveBetaDraftFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { saveBetaDraft } = await import("./page.server");
    return saveBetaDraft(context.userId, data);
  });

export const submitBetaFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { submitBeta } = await import("./page.server");
    return submitBeta(context.userId, data);
  });
