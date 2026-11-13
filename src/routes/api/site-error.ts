import { createFileRoute } from "@tanstack/react-router";
import { parseSiteError } from "@/lib/notify/site-error";
import { sendSiteErrorMail } from "@/lib/notify/site-error.server";

export const Route = createFileRoute("/api/site-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const report = parseSiteError(body);
        if (!report) return Response.json({ ok: true });
        const result = await sendSiteErrorMail(report, {
          userAgent: request.headers.get("user-agent") ?? "",
        });
        if (!result.ok) return Response.json({ ok: false }, { status: 502 });
        return Response.json({ ok: true });
      },
    },
  },
});
