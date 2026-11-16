import { createServerFn } from "@tanstack/react-start";

export const submitReview = createServerFn({ method: "POST" })
  .validator((input: { name?: string; stars?: number; review?: string; captcha?: string; company?: string }) => ({
    name: String(input?.name ?? "").trim(),
    stars: Number(input?.stars),
    review: String(input?.review ?? "").trim(),
    captcha: String(input?.captcha ?? ""),
    company: String(input?.company ?? "").trim(),
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; reason: string }> => {
    if (data.company) return { ok: true };
    if (data.name.length < 2 || data.name.length > 80) return { ok: false, reason: "Name looks off." };
    if (!Number.isInteger(data.stars) || data.stars < 1 || data.stars > 5) {
      return { ok: false, reason: "Pick a star rating." };
    }
    if (data.review.length < 10 || data.review.length > 335) {
      return { ok: false, reason: "The review needs 10 to 335 characters." };
    }
    const { verifyTurnstile, turnstileFailureReason, clientIp, tooManyFormSubmits } = await import(
      "@/lib/auth/signup-gate.server"
    );
    const turnstile = await verifyTurnstile(data.captcha);
    if (!turnstile.ok) return { ok: false, reason: turnstileFailureReason(turnstile.code) };
    const { getRequest } = await import("@tanstack/react-start/server");
    const ip = clientIp(getRequest());
    if (await tooManyFormSubmits("review", ip)) {
      return { ok: false, reason: "Too many reviews. Try again in a few minutes." };
    }
    const { sendReviewMail } = await import("./contact");
    return sendReviewMail({ name: data.name, stars: data.stars, review: data.review });
  });
