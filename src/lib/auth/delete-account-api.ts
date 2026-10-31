import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { deleteAccountForUser, loadDeleteOptions } from "./delete-account.server";

export const getDeleteOptions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadDeleteOptions(context.userId));

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { password?: string; code?: string; backup?: boolean; passkey?: boolean }) => ({
    password: String(input?.password ?? ""),
    code: String(input?.code ?? "").trim(),
    backup: Boolean(input?.backup),
    passkey: Boolean(input?.passkey),
  }))
  .handler(async ({ context, data }) => {
    await deleteAccountForUser(
      context.userId,
      {
        password: data.password || undefined,
        code: data.code || undefined,
        backup: data.backup,
        passkey: data.passkey,
      },
      context.bearerToken,
    );
    return { ok: true as const };
  });
