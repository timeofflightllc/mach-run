import { createServerFn } from "@tanstack/react-start";

export const requestEnterprise = createServerFn({ method: "POST" })
  .validator((input: { email?: string; captcha?: string }) => ({
    email: String(input?.email ?? "").trim(),
    captcha: String(input?.captcha ?? ""),
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; reason: string }> => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 120) {
      return { ok: false, reason: "Email looks off." };
    }
    const { verifyTurnstile, turnstileFailureReason } = await import("@/lib/auth/signup-gate.server");
    const turnstile = await verifyTurnstile(data.captcha);
    if (!turnstile.ok) return { ok: false, reason: turnstileFailureReason(turnstile.code) };
    const { sendEnterpriseMail } = await import("./contact");
    return sendEnterpriseMail(data.email);
  });
