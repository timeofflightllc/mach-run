import { createFileRoute } from "@tanstack/react-router";
import { timingSafeStringEqual } from "@/lib/rewards/instagram-webhook";

export const Route = createFileRoute("/api/instagram/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("hub.verify_token") ?? "";
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "";
        if (!expected || !challenge || !timingSafeStringEqual(token, expected)) {
          return new Response("forbidden", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
        }
        return new Response(challenge, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
      },
      POST: async ({ request }) => {
        try {
          const raw = await request.text();
          const { deliverInstagramWebhook } = await import("@/lib/rewards/instagram-delivery");
          const { getSql } = await import("@/lib/db");
          return await deliverInstagramWebhook(await getSql(), {
            raw,
            signature: request.headers.get("x-hub-signature-256"),
            secret: process.env.INSTAGRAM_APP_SECRET,
          });
        } catch {
          return new Response(JSON.stringify({ received: false }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
