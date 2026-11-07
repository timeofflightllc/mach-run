import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/** Record a visit or a finished tool. A failure stays quiet. */
export const noteVisitor = createServerFn({ method: "POST" })
  .validator((input: { event?: string }) => ({
    event: typeof input?.event === "string" ? input.event : "",
  }))
  .handler(async ({ data }) => {
    try {
      const { noteVisitorEvent } = await import("./note.server");
      await noteVisitorEvent(data.event);
    } catch {
      /* a missed count must not break the caller */
    }
    return { ok: true as const };
  });

/** Stamp the signed-in account on this browser. Never takes a user id from the body. */
export const attachVisitor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const { attachVisitorUser } = await import("./note.server");
      await attachVisitorUser(context.userId);
    } catch {
      /* a missed link must not break the page */
    }
    return { ok: true as const };
  });
