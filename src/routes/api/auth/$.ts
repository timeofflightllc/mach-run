import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: async ({ request }) => {
        const path = new URL(request.url).pathname;
        if (path.includes("/sign-up/email")) {
          const { gateEmailSignup } = await import("@/lib/auth/signup-gate.server");
          const blocked = await gateEmailSignup(request);
          if (blocked) return blocked;
        }
        return auth.handler(request);
      },
    },
  },
});
