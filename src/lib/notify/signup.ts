/**
 * Owner ping + new-user welcome when a MACH RUN account is created.
 * Resend REST — no SDK. Missing keys = no-op so sign-up never fails.
 */

export type SignupNotice = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type NotifyResult =
  | { ok: true; skipped?: undefined }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; reason: string };

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

export function notifyRecipients(): string[] {
  return env("MACH_NOTIFY_EMAIL")
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function notifyConfigured(): boolean {
  return Boolean(env("RESEND_API_KEY") && notifyRecipients().length);
}

export function isNotifyOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  return notifyRecipients().includes(email.trim().toLowerCase());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

function fromAddress(): string {
  return env("MACH_NOTIFY_FROM") || "MACH RUN <beth.t@example.com>";
}

async function sendResend(mail: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<NotifyResult> {
  const key = env("RESEND_API_KEY");
  if (!key) return { ok: false, skipped: true, reason: "RESEND_API_KEY is not set." };
  if (!mail.to.length) return { ok: false, skipped: true, reason: "No recipient." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: `Resend ${res.status}: ${detail.slice(0, 180)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Could not reach Resend.",
    };
  }
}

function wrapEmail(innerTitle: string, innerHtml: string): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#07101f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07101f;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#0a1835;border:1px solid #2a3d63;border-radius:12px;">
        <tr><td style="padding:20px 24px 8px;font-family:Georgia,Times,serif;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#c9d4e8;">
          MACH RUN
        </td></tr>
        <tr><td style="padding:0 24px 16px;font-family:Georgia,Times,serif;font-size:22px;color:#f4f7fb;">
          ${escapeHtml(innerTitle)}
        </td></tr>
        ${innerHtml}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function ownerSignupEmail(notice: SignupNotice): { subject: string; html: string; text: string } {
  const name = (notice.name ?? "").trim() || "—";
  const email = (notice.email ?? "").trim() || "no email on file";
  const when = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  });
  const subject = `New MACH RUN account — ${email}`;
  const text = [
    "New MACH RUN account",
    `Name: ${name}`,
    `Email: ${email}`,
    `User id: ${notice.id}`,
    `When: ${when} CT`,
  ].join("\n");
  const html = wrapEmail(
    "New account",
    `<tr><td style="padding:0 24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#c9d4e8;">
          Someone just registered on machrun.com.
        </td></tr>
        <tr><td style="padding:0 24px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#122448;border-radius:8px;">
            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#e8eef8;">
              <div style="color:#8fa3c4;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Name</div>
              <div style="margin:2px 0 12px;">${escapeHtml(name)}</div>
              <div style="color:#8fa3c4;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Email</div>
              <div style="margin:2px 0 12px;">${escapeHtml(email)}</div>
              <div style="color:#8fa3c4;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">When</div>
              <div style="margin:2px 0 0;">${escapeHtml(when)} CT</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8fa3c4;">
          This is an owner alert. The new user was not copied.
        </td></tr>`,
  );
  return { subject, html, text };
}

export function welcomeSignupEmail(notice: SignupNotice): { subject: string; html: string; text: string } {
  const rawName = (notice.name ?? "").trim();
  const first = rawName.split(/\s+/)[0] || "";
  const hello = first ? `Hi ${first},` : "Hi,";
  const subject = "Welcome to MACH RUN";
  const text = [
    hello,
    "",
    "Your account is ready. Sign in at https://machrun.com and:",
    "1. Open Family, then Accounts.",
    "2. Hit Calculate. That is a MACH RUN.",
    "",
    "Free saves your plan with limits. A cup of coffee a month removes them.",
    "",
    "MACH RUN is for entertainment and education only. It is not financial advice.",
    "",
    "— MACH RUN",
    "https://machrun.com",
  ].join("\n");
  const html = wrapEmail(
    "Welcome aboard",
    `<tr><td style="padding:0 24px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#c9d4e8;">
          ${escapeHtml(hello)}
        </td></tr>
        <tr><td style="padding:0 24px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#c9d4e8;">
          Your account is ready. Sign in at
          <a href="https://machrun.com" style="color:#e8eef8;text-decoration:underline;">machrun.com</a>
          and:
        </td></tr>
        <tr><td style="padding:0 24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#e8eef8;">
          1. Open Family, then Accounts.<br />
          2. Hit Calculate. That is a MACH RUN.
        </td></tr>
        <tr><td style="padding:0 24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#c9d4e8;">
          Free saves your plan with limits. A cup of coffee a month removes them.
        </td></tr>
        <tr><td style="padding:0 24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8fa3c4;">
          MACH RUN is for entertainment and education only. It is not financial advice.
        </td></tr>`,
  );
  return { subject, html, text };
}

export async function notifyOwnerOfSignup(notice: SignupNotice): Promise<NotifyResult> {
  const to = notifyRecipients();
  if (!to.length) return { ok: false, skipped: true, reason: "MACH_NOTIFY_EMAIL is not set." };
  const mail = ownerSignupEmail(notice);
  return sendResend({ to, ...mail });
}

export async function sendWelcomeSignupEmail(notice: SignupNotice): Promise<NotifyResult> {
  const to = (notice.email ?? "").trim();
  if (!to) return { ok: false, skipped: true, reason: "New user has no email." };
  const mail = welcomeSignupEmail(notice);
  return sendResend({ to: [to], ...mail });
}

export async function onAccountCreated(notice: SignupNotice): Promise<void> {
  await Promise.allSettled([notifyOwnerOfSignup(notice), sendWelcomeSignupEmail(notice)]);
}
