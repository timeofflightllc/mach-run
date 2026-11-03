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

export async function sendBetaDebriefMail(input: {
  name: string;
  email: string;
  pass: number;
  limit: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = env("RESEND_API_KEY");
  if (!key) return { ok: false, reason: "Mail is not connected yet." };
  const name = input.name.trim() || "—";
  const email = input.email.trim();
  const when = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  });
  const passLine = `Debrief ${input.pass} of ${input.limit}.`;
  const where = "The answers, including the mailing address, are in Top 3.";
  const subject = "MACH RUN beta debrief submitted.";
  const text = [passLine, "", `Name: ${name}`, `Email: ${email}`, `When: ${when} CT`, "", where].join("\n");
  const html = wrapEmail(
    "Beta debrief submitted",
    `<tr><td style="padding:8px 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#3D4A54;">
          ${escapeHtml(passLine)}
        </td></tr>
        <tr><td style="padding:0 28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ECE7DC;">
            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1E2A32;">
              Name<br /><strong>${escapeHtml(name)}</strong><br /><br />
              Email<br /><strong>${escapeHtml(email)}</strong><br /><br />
              When<br /><strong>${escapeHtml(when)} CT</strong>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#3D4A54;">
          ${escapeHtml(where)}
        </td></tr>
        <tr><td style="padding:0 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5D6C78;">
          This is an owner alert. The tester was not copied.
        </td></tr>`,
    passLine,
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
        to: ["matt@machrun.com"],
        ...(email.includes("@") ? { reply_to: email } : {}),
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) return { ok: false, reason: "Could not send." };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not reach mail." };
  }
}

export async function sendBetaInviteMail(input: {
  name: string;
  email: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = env("RESEND_API_KEY");
  if (!key) return { ok: false, reason: "Mail is not connected yet." };
  const first = input.name.trim().split(/\s+/)[0] || "";
  const hello = first ? `Hi ${first},` : "Hi,";
  const link = "https://machrun.com/beta";
  const subject = "Your MACH RUN beta debrief is enabled";
  const text = [
    hello,
    "",
    "I enabled the beta debrief on your MACH RUN account. Each beta tester has 3 times to run through the form. If you need more, let me know -- I can easily open up more.",
    "",
    "Sign in, then open My Account. The form is under Referrals: Beta Testing Feedback / Debrief Form.",
    `Or go straight there once you are signed in: ${link}`,
    "",
    "Walk the calculator. Write what you clicked, what you expected, and what happened. You can leave a box blank. Save a draft if you need to come back.",
    "",
    "Thank you for testing this with me.",
    "",
    "Cain",
    "MACH RUN",
    "https://machrun.com",
  ].join("\n");
  const html = wrapEmail(
    "Your beta debrief is enabled",
    `<tr><td style="padding:8px 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1E2A32;">
          ${escapeHtml(hello)}
        </td></tr>
        <tr><td style="padding:0 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3D4A54;">
          I enabled the beta debrief on your MACH RUN account. Each beta tester has 3 times to run through the form. If you need more, let me know -- I can easily open up more.
        </td></tr>
        <tr><td style="padding:0 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3D4A54;">
          Sign in, then open My Account. The form is under Referrals: Beta Testing Feedback / Debrief Form.
        </td></tr>
        <tr><td style="padding:4px 28px 20px;">
          <a href="${link}" style="display:inline-block;background:#3a8a58;color:#ffffff;text-decoration:none;padding:12px 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;">Open the debrief</a>
        </td></tr>
        <tr><td style="padding:0 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3D4A54;">
          Walk the calculator. Write what you clicked, what you expected, and what happened. You can leave a box blank. Save a draft if you need to come back.
        </td></tr>
        <tr><td style="padding:0 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1E2A32;">
          Thank you for testing this with me.<br /><br />
          Cain<br />
          MACH RUN
        </td></tr>`,
    "Your MACH RUN beta debrief is enabled. You can run the form 3 times.",
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
        to: [input.email],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) return { ok: false, reason: "Could not send." };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not reach mail." };
  }
}

export { TOPIC_LABEL };
