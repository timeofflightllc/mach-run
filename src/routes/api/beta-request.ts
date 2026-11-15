import { createFileRoute } from "@tanstack/react-router";
import { sendBetaRequestMail } from "@/lib/notify/contact";
import { clientIp, tooManyFormSubmits, turnstileFailureReason, verifyTurnstile } from "@/lib/auth/signup-gate.server";

export const Route = createFileRoute("/api/beta-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false, reason: "Bad request." }, { status: 400 });
        }
        if (typeof body.company === "string" && body.company.trim()) {
          return Response.json({ ok: true });
        }
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim() : "";
        const note = typeof body.note === "string" ? body.note.trim() : "";
        const captcha = typeof body.captcha === "string" ? body.captcha : "";
        const turnstile = await verifyTurnstile(captcha);
        if (!turnstile.ok) {
          return Response.json({ ok: false, reason: turnstileFailureReason(turnstile.code) }, { status: 400 });
        }
        const ip = clientIp(request);
        if (await tooManyFormSubmits("beta", ip)) {
          return Response.json(
            { ok: false, reason: "Too many messages. Try again in a few minutes." },
            { status: 429 },
          );
        }
        if (name.length < 2 || name.length > 80) {
          return Response.json({ ok: false, reason: "Name looks off." }, { status: 400 });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
          return Response.json({ ok: false, reason: "Email looks off." }, { status: 400 });
        }
        if (note.length < 10 || note.length > 4000) {
          return Response.json(
            { ok: false, reason: "Say a bit more — 10 to 4,000 characters." },
            { status: 400 },
          );
        }
        const result = await sendBetaRequestMail({ name, email, note });
        if (!result.ok) {
          return Response.json({ ok: false, reason: result.reason }, { status: 502 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
