/**
 * Contact form → Resend. Default inbox is matt@machrun.com.
 * Later: set CONTACT_EMAIL_GENERAL / CONTACT_EMAIL_BUG / CONTACT_EMAIL_FEATURE.
 */

export type ContactTopic = "general" | "bug" | "feature";

const TOPIC_LABEL: Record<ContactTopic, string> = {
  general: "General question",
  bug: "Bug report",
  feature: "Feature request",
};

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

export function contactInbox(topic: ContactTopic): string {
  if (topic === "bug") return env("CONTACT_EMAIL_BUG") || env("CONTACT_EMAIL") || "matt@machrun.com";
  if (topic === "feature") {
    return env("CONTACT_EMAIL_FEATURE") || env("CONTACT_EMAIL") || "matt@machrun.com";
  }
  return env("CONTACT_EMAIL_GENERAL") || env("CONTACT_EMAIL") || "matt@machrun.com";
}

function fromAddress(): string {
  return env("MACH_NOTIFY_FROM") || "MACH RUN <beth.t@example.com>";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

export async function sendContactMail(input: {
  topic: ContactTopic;
  name: string;
  email: string;
  message: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = env("RESEND_API_KEY");
  if (!key) return { ok: false, reason: "Mail is not connected yet." };

  const topic = TOPIC_LABEL[input.topic];
  const to = contactInbox(input.topic);
  const subject = `[MACH RUN ${topic}] ${input.name.trim().slice(0, 60)}`;
  const text = [
    `Topic: ${topic}`,
    `From: ${input.name.trim()} <${input.email.trim()}>`,
    "",
    input.message.trim(),
  ].join("\n");
  const html = `
    <p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
    <p><strong>From:</strong> ${escapeHtml(input.name.trim())} <${escapeHtml(input.email.trim())}></p>
    <pre style="font-family:IBM Plex Sans,sans-serif;white-space:pre-wrap;">${escapeHtml(input.message.trim())}</pre>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [to],
        reply_to: input.email.trim(),
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: `Could not send (${res.status}).` + (detail ? "" : "") };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not reach mail." };
  }
}

export { TOPIC_LABEL };
