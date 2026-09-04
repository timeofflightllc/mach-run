import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { deleteAccountForUser, loadDeleteOptions } from "./delete-account.server";

export const getDeleteOptions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadDeleteOptions(context.userId));

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { password?: string }) => ({
    password: String(input?.password ?? ""),
  }))
  .handler(async ({ context, data }) => {
    await deleteAccountForUser(context.userId, { password: data.password || undefined });
    return { ok: true as const };
  });
