import { createFileRoute } from "@tanstack/react-router";
import { sendContactMail, type ContactTopic } from "@/lib/notify/contact";

const TOPICS = new Set<ContactTopic>(["general", "bug", "feature"]);

function asTopic(value: unknown): ContactTopic | null {
  return typeof value === "string" && TOPICS.has(value as ContactTopic)
    ? (value as ContactTopic)
    : null;
}

export const Route = createFileRoute("/api/contact")({
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
        const topic = asTopic(body.topic);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim() : "";
        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (!topic) {
          return Response.json({ ok: false, reason: "Pick a topic." }, { status: 400 });
        }
        if (name.length < 2 || name.length > 80) {
          return Response.json({ ok: false, reason: "Name looks off." }, { status: 400 });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
          return Response.json({ ok: false, reason: "Email looks off." }, { status: 400 });
        }
        if (message.length < 10 || message.length > 4000) {
          return Response.json(
            { ok: false, reason: "Say a bit more — 10 to 4,000 characters." },
            { status: 400 },
          );
        }
        const result = await sendContactMail({ topic, name, email, message });
        if (!result.ok) {
          return Response.json({ ok: false, reason: result.reason }, { status: 502 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
