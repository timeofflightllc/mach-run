import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { MachActivityAction } from "./activity";

export const recordOwnActivityFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { action: MachActivityAction; detail?: Record<string, unknown> }) => ({
    action: input?.action,
    detail: input?.detail && typeof input.detail === "object" ? input.detail : {},
  }))
  .handler(async ({ context, data }) => {
    const allowed: MachActivityAction[] = [
      "calculate",
      "pdf",
      "plan_save",
      "backup_download",
      "backup_import",
    ];
    if (!allowed.includes(data.action)) return { ok: false as const };
    const { recordUserActivity } = await import("./activity.server");
    await recordUserActivity({
      userId: context.userId,
      action: data.action,
      detail: data.detail,
    });
    return { ok: true as const };
  });

export function pingActivity(
  action: MachActivityAction,
  detail?: Record<string, unknown>,
): void {
  void recordOwnActivityFn({ data: { action, detail } }).catch(() => {
    /* guest or table missing */
  });
}
