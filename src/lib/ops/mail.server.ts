import { recordAdminEvent } from "./audit.server";
import type { OpsActor } from "./gate.server";
import {
  MAIL_CONFIRM,
  MAIL_SEND_MAX,
  mergeMail,
  peopleFromRoster,
  withMailFooter,
  type MailMergePerson,
} from "./mail";
import { loadOpsRoster } from "./roster.server";
import type { OpsRosterQuery } from "./roster";

function env(key: string): string {
  return (process.env[key] ?? "").trim();
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

function wrapDeskMail(subject: string, body: string, footer: string): { html: string; text: string } {
  const text = withMailFooter(body, footer);
  const htmlBody = escapeHtml(text).replace(/\n/g, "<br />");
  const logo = "https://machrun.com/brand/mach-run-logo.jpg?v=21";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#F3F0E8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F0E8;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#FFFcf6;border:1px solid #D5D0C6;">
        <tr><td align="center" style="padding:28px 28px 20px;">
          <img src="${logo}" width="480" alt="MACH RUN" style="display:block;width:480px;max-width:100%;height:auto;border:0;" />
        </td></tr>
        <tr><td style="padding:0 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1E2A32;">
          ${htmlBody}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { html, text };
}

async function sendResend(to: string, subject: string, html: string, text: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = env("RESEND_API_KEY");
  if (!key) return { ok: false, reason: "RESEND_API_KEY is not set." };
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
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: `Resend ${res.status}: ${detail.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Could not reach Resend." };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type DeskMailResult =
  | {
      ok: true;
      sent: number;
      skipped: number;
      failed: number;
      error?: undefined;
    }
  | {
      ok: false;
      sent: number;
      skipped: number;
      failed: number;
      error: string;
    };

export async function sendDeskMail(
  actor: OpsActor,
  input: {
    confirm: string;
    subject: string;
    body: string;
    query: OpsRosterQuery;
    onlyUserId?: string;
    footer?: string;
  },
): Promise<DeskMailResult> {
  if (input.confirm.trim() !== MAIL_CONFIRM) {
    return { ok: false, sent: 0, skipped: 0, failed: 0, error: "Type SEND to send." };
  }
  const subjectTpl = input.subject.trim();
  const bodyTpl = input.body.trim();
  const footerTpl = input.footer ?? "";
  if (!subjectTpl || !bodyTpl) {
    return { ok: false, sent: 0, skipped: 0, failed: 0, error: "Subject and body are required." };
  }
  if (subjectTpl.length > 200) {
    return { ok: false, sent: 0, skipped: 0, failed: 0, error: "Subject is too long." };
  }
  if (bodyTpl.length > 20_000) {
    return { ok: false, sent: 0, skipped: 0, failed: 0, error: "Body is too long." };
  }
  if (footerTpl.length > 4_000) {
    return { ok: false, sent: 0, skipped: 0, failed: 0, error: "Footer is too long." };
  }
  if (!env("RESEND_API_KEY")) {
    return { ok: false, sent: 0, skipped: 0, failed: 0, error: "RESEND_API_KEY is not set." };
  }

  const roster = await loadOpsRoster({ ...input.query, offset: 0 });
  if (!roster.allowed) {
    return { ok: false, sent: 0, skipped: 0, failed: 0, error: "Not allowed." };
  }
  let people = peopleFromRoster(roster.rows);
  const skippedBlank = Math.min(roster.rows.length, MAIL_SEND_MAX) - people.length;
  if (input.onlyUserId) {
    people = people.filter((p) => p.id === input.onlyUserId);
    if (!people.length) {
      return { ok: false, sent: 0, skipped: skippedBlank, failed: 0, error: "That person has no email on file." };
    }
  }
  if (!people.length) {
    return { ok: false, sent: 0, skipped: skippedBlank, failed: 0, error: "No emails in this filter." };
  }

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < people.length; i += 1) {
    const person: MailMergePerson = people[i]!;
    const subject = mergeMail(subjectTpl, person);
    const { html, text } = wrapDeskMail(
      subject,
      mergeMail(bodyTpl, person),
      mergeMail(footerTpl, person),
    );
    const result = await sendResend(person.email, subject, html, text);
    if (result.ok) sent += 1;
    else failed += 1;
    if (i + 1 < people.length) await sleep(80);
  }

  await recordAdminEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    targetUserId: input.onlyUserId || people[0]?.id || "",
    targetEmail: input.onlyUserId ? people[0]?.email ?? null : null,
    action: "mail_send",
    detail: {
      count: sent,
      skipped: skippedBlank,
      failed,
      subject: subjectTpl.slice(0, 200),
      filter: input.onlyUserId ? "one" : "roster",
    },
    note: `${sent} sent · ${skippedBlank} skipped · ${failed} failed · ${subjectTpl.slice(0, 80)}`,
  });

  if (failed && !sent) {
    return { ok: false, sent, skipped: skippedBlank, failed, error: "Resend rejected every message." };
  }
  return { ok: true, sent, skipped: skippedBlank, failed };
}
