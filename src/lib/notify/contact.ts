/**
 * Contact form → Resend. Default inbox is matt@machrun.com.
 * Later: set CONTACT_EMAIL_GENERAL / CONTACT_EMAIL_BUG / CONTACT_EMAIL_FEATURE.
 */

import { wrapEmail } from "./signup";

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
  return env("MACH_NOTIFY_FROM") || "MACH RUN <matt@machrun.com>";
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

export async function sendEnterpriseMail(
  email: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = env("RESEND_API_KEY");
  if (!key) return { ok: false, reason: "Mail is not connected yet." };
  const to = contactInbox("general");
  const clean = email.trim();
  const when = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  });
  const line = `There is an interested party seeking more information about Custom Enterprise Solutions on ${when} CT.`;
  const subject = `Custom Enterprise Solutions — ${clean.slice(0, 80)}`;
  const text = [line, "", `Email: ${clean}`, `When: ${when} CT`].join("\n");
  const html = wrapEmail(
    "Custom Enterprise Solutions",
    `<tr><td style="padding:8px 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#3D4A54;">
          ${escapeHtml(line)}
        </td></tr>
        <tr><td style="padding:0 28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ECE7DC;">
            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1E2A32;">
              Email<br /><strong>${escapeHtml(clean)}</strong><br /><br />
              When<br /><strong>${escapeHtml(when)} CT</strong>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5D6C78;">
          This is an owner alert. The interested party was not copied.
        </td></tr>`,
    line,
  );
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
        reply_to: clean,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) return { ok: false, reason: "Could not send. Try again." };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not reach mail." };
  }
}

export { TOPIC_LABEL };
