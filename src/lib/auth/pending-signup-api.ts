import { createServerFn } from "@tanstack/react-start";

function cleanEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

export const startPendingSignup = createServerFn({ method: "POST" })
  .validator((input: {
    email?: string;
    password?: string;
    name?: string;
    captcha?: string;
    honeypot?: string;
  }) => ({
    email: cleanEmail(input?.email),
    password: String(input?.password ?? ""),
    name: String(input?.name ?? "").trim(),
    captcha: String(input?.captcha ?? ""),
    honeypot: String(input?.honeypot ?? ""),
  }))
  .handler(async ({ data }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    assertSameSiteRequest();
    const { startPendingSignup: start } = await import("./pending-signup.server");
    return start(data);
  });

export const completePendingSignup = createServerFn({ method: "POST" })
  .validator((input: { email?: string; code?: string }) => ({
    email: cleanEmail(input?.email),
    code: String(input?.code ?? ""),
  }))
  .handler(async ({ data }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    assertSameSiteRequest();
    const { completePendingSignup: complete } = await import("./pending-signup.server");
    return complete(data);
  });

export const resendPendingSignup = createServerFn({ method: "POST" })
  .validator((input: { email?: string }) => ({
    email: cleanEmail(input?.email),
  }))
  .handler(async ({ data }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    assertSameSiteRequest();
    const { resendPendingSignup: resend } = await import("./pending-signup.server");
    return resend(data.email);
  });
