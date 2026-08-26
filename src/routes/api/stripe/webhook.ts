import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const secret = process.env.STRIPE_WEBHOOK_SECRET;
          const key = process.env.STRIPE_SECRET_KEY;
          if (!secret || !key) {
            return new Response(JSON.stringify({ received: false, skipped: true }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          const payload = await request.text();
          const sig = request.headers.get("stripe-signature");
          if (!sig) return new Response("missing signature", { status: 400 });
          const { applyStripeEvent, getStripe } = await import(
            "@/lib/billing/stripe.server"
          );
          const stripe = await getStripe();
          let event;
          try {
            event = stripe.webhooks.constructEvent(payload, sig, secret);
          } catch {
            return new Response("invalid signature", { status: 400 });
          }
          await applyStripeEvent(event);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch {
          return new Response(JSON.stringify({ received: false }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
