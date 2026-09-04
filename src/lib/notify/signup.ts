/**
 * Owner ping + new-user welcome when a MACH RUN account is created.
 * Resend REST — no SDK. Missing keys = no-op so sign-up never fails.
 */

export type SignupNotice = {
  id: string;
  name?: string | null;
  email?: string | null;
  code?: string | null;
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

function wrapEmail(
  innerTitle: string,
  innerHtml: string,
  preheader = "Your MACH RUN account is ready. Open Family, then Accounts. Hit Calculate.",
  titleAlign: "left" | "center" = "left",
  signupWhy = false,
): string {
  const logo = "https://machrun.com/brand/mach-run-logo.jpg";
  const why = signupWhy
    ? `<tr>
            <td align="center" style="padding:16px 12px 0;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
                <tr>
                  <td style="padding:4px 16px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.55;color:#8fa3c4;text-align:left;">
                    You received this email only because you signed up for
                    <a href="https://machrun.com" style="color:#8fa3c4;text-decoration:underline;">MACHRUN.com</a>.
                    We do not buy, sell, or give away email addresses. We respect your privacy —
                    <a href="https://machrun.com/privacy" style="color:#8fa3c4;text-decoration:underline;">Privacy policy</a>.
                    <a href="https://machrun.com/account#email-preferences" style="color:#8fa3c4;text-decoration:underline;">Unsubscribe</a>
                    opens your account profile, where you can turn off optional mail or cancel the account.
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : "";
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>${escapeHtml(innerTitle)}</title>
  <style type="text/css">
    @media only screen and (max-width: 520px) {
      .mach-tagline { display: none !important; font-size: 0 !important; line-height: 0 !important; max-height: 0 !important; overflow: hidden !important; padding: 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#07101f;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#07101f;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#0a1835;border:1px solid #2a3d63;">
          <tr>
            <td align="center" style="padding:28px 28px 12px;background-color:#0a1835;">
              <img src="${logo}" width="480" alt="MACH RUN" style="display:block;width:480px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr class="mach-tagline">
            <td class="mach-tagline" align="center" style="padding:0 28px 20px;font-family:Georgia,'Times New Roman',Times,serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#c9d4e8;">
              THE SUPERSONIC FINANCIAL CALCULATOR
            </td>
          </tr>
          <tr>
            <td align="${titleAlign}" style="padding:0 28px 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:26px;line-height:1.25;color:#f4f7fb;text-align:${titleAlign};">
              ${escapeHtml(innerTitle)}
            </td>
          </tr>
          ${innerHtml}
        </table>
        ${why}
      </td>
    </tr>
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
    `<tr><td style="padding:8px 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#c9d4e8;">
          Someone just registered on machrun.com.
        </td></tr>
        <tr><td style="padding:0 28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#122448;">
            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#e8eef8;">
              Name<br /><strong>${escapeHtml(name)}</strong><br /><br />
              Email<br /><strong>${escapeHtml(email)}</strong><br /><br />
              When<br /><strong>${escapeHtml(when)} CT</strong>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8fa3c4;">
          This is an owner alert. The new user was not copied.
        </td></tr>`,
  );
  return { subject, html, text };
}

export function welcomeSignupEmail(notice: SignupNotice): { subject: string; html: string; text: string } {
  const rawName = (notice.name ?? "").trim();
  const first = rawName.split(/\s+/)[0] || "";
  const hello = first ? `Hi ${first},` : "Hi,";
  const code = (notice.code ?? "").replace(/\D/g, "").slice(0, 6);
  const verifyUrl = "https://machrun.com/verify-email";
  const subject = code ? "Verify your MACH RUN email" : "Welcome to MACH RUN";
  const text = [
    hello,
    "",
    ...(code
      ? [
          "Your account is almost ready -- just need to make sure you're a human!",
          "",
          `Click "Verify Email" below and enter this code when prompted. The code expires in 24 hours. If it expires, open that same page and request a new one.`,
          "",
          `Your verification code is ${code}.`,
          `Open ${verifyUrl} and enter that code.`,
        ]
      : ["Your account is ready."]),
    "",
    "Then sign in at https://machrun.com and:",
    "1. Open Family, then Accounts.",
    "2. Hit Calculate. That is a MACH RUN.",
    "",
    "Free saves your plan with limits. A cup of coffee a month removes them.",
    "",
    "MACH RUN is for entertainment and education only. It is not financial advice.",
    "",
    SIGNUP_WHY_TEXT,
    "",
    "— MACH RUN",
    "https://machrun.com",
  ].join("\n");
  const codeBlock = code
    ? `<tr><td style="padding:0 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#c9d4e8;">
          Click "Verify Email" below and enter this code when prompted. The code expires in 24 hours. If it expires, open that same page and request a new one.
        </td></tr>
        <tr><td align="center" style="padding:0 28px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#122448;">
            <tr><td style="padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:32px;letter-spacing:0.28em;color:#f4f7fb;">
              ${escapeHtml(code)}
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:0 28px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="#d8dee8" style="background-color:#d8dee8;">
                <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0a1835;text-decoration:none;">Verify Email</a>
              </td>
            </tr>
          </table>
        </td></tr>`
    : `<tr><td align="center" style="padding:4px 28px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="#d8dee8" style="background-color:#d8dee8;">
                <a href="https://machrun.com" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0a1835;text-decoration:none;">Open MACH RUN</a>
              </td>
            </tr>
          </table>
        </td></tr>`;
  const html = wrapEmail(
    code ? "Verify your email to go supersonic." : "Welcome aboard",
    `<tr><td style="padding:8px 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#c9d4e8;">
          ${escapeHtml(hello)}
        </td></tr>
        <tr><td style="padding:0 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#c9d4e8;">
          ${
            code
              ? "Your account is almost ready — just need to make sure you're a human!"
              : "Your account is ready. Sign in and run the first loop:"
          }
        </td></tr>
        ${codeBlock}
        <tr><td style="padding:0 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#c9d4e8;">
          Then open Family, then Accounts. Hit Calculate. That is a MACH RUN.
        </td></tr>
        <tr><td style="padding:0 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#c9d4e8;">
          Free saves your plan with limits. A cup of coffee a month removes them.
        </td></tr>
        <tr><td style="padding:0 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8fa3c4;">
          MACH RUN is for entertainment and education only. It is not financial advice.<br />
          <a href="https://machrun.com" style="color:#8fa3c4;text-decoration:underline;">machrun.com</a>
        </td></tr>`,
    undefined,
    "left",
    true,
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

const FIRST_FLIGHT_STEPS = [
  {
    n: "1",
    title: "Sign in",
    body: "Open machrun.com.",
  },
  {
    n: "2",
    title: "OBSERVE",
    body: "Family, goals, dates. Then the accounts you have now.",
  },
  {
    n: "3",
    title: "ORIENT",
    body: "Income, then monthly spending.",
  },
  {
    n: "4",
    title: "DECIDE",
    body: "Where investment dollars go.",
  },
  {
    n: "5",
    title: "ACT",
    body: "Hit Calculate. Read the BLUF. Change something. Run it again.",
  },
];

const SIGNUP_WHY_TEXT = [
  "You received this email only because you signed up for MACHRUN.com. We do not buy, sell, or give away email addresses. We respect your privacy — Privacy policy: https://machrun.com/privacy",
  "Unsubscribe opens your account profile, where you can turn off optional mail or cancel the account: https://machrun.com/account#email-preferences",
].join("\n");

export function firstFlightEmail(notice: SignupNotice): { subject: string; html: string; text: string } {
  const rawName = (notice.name ?? "").trim();
  const first = rawName.split(/\s+/)[0] || "";
  const hello = first ? `Hi ${first},` : "Hi,";
  const subject = "MACH RUN — First Flight Checklist";
  const text = [
    hello,
    "",
    "Email verified.",
    "",
    "FIRST FLIGHT CHECKLIST",
    ...FIRST_FLIGHT_STEPS.map((s) => `${s.n}. ${s.title} — ${s.body}`),
    "",
    "Free saves your plan with limits. Pricing unlocks more.",
    "",
    "Kick the tires and light your financial fires.",
    "",
    "https://machrun.com",
    "",
    "MACH RUN is for entertainment and education only. It is not financial advice.",
    "",
    SIGNUP_WHY_TEXT,
    "",
    "— MACH RUN",
    "https://machrun.com",
  ].join("\n");
  const rows = FIRST_FLIGHT_STEPS.map(
    (s) => `<tr>
              <td valign="top" style="width:36px;padding:10px 10px 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#f4f7fb;">${s.n}.</td>
              <td style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#c9d4e8;">
                <strong style="color:#f4f7fb;">${escapeHtml(s.title)}</strong><br />
                ${escapeHtml(s.body)}
              </td>
            </tr>`,
  ).join("");
  const html = wrapEmail(
    "First Flight Checklist",
    `<tr><td style="padding:8px 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#c9d4e8;">
          ${escapeHtml(hello)}
        </td></tr>
        <tr><td style="padding:0 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#c9d4e8;">
          Email verified. Fights On!
        </td></tr>
        <tr><td style="padding:0 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#122448;">
            <tr><td style="padding:8px 16px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rows}
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:12px 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#c9d4e8;">
          Free saves your plan with limits. Pricing unlocks more.
        </td></tr>
        <tr><td align="center" style="padding:8px 28px 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:17px;line-height:1.5;color:#f4f7fb;text-align:center;">
          Kick the tires and light your financial fires.
        </td></tr>
        <tr><td align="center" style="padding:12px 28px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="#d8dee8" style="background-color:#d8dee8;">
                <a href="https://machrun.com" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0a1835;text-decoration:none;">Open MACH RUN</a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8fa3c4;">
          MACH RUN is for entertainment and education only. It is not financial advice.<br />
          <a href="https://machrun.com" style="color:#8fa3c4;text-decoration:underline;">machrun.com</a>
        </td></tr>`,
    "Email verified. Open machrun.com.",
    "center",
    true,
  );
  return { subject, html, text };
}

export async function sendFirstFlightEmail(notice: SignupNotice): Promise<NotifyResult> {
  const to = (notice.email ?? "").trim();
  if (!to) return { ok: false, skipped: true, reason: "Verified user has no email." };
  const mail = firstFlightEmail(notice);
  return sendResend({ to: [to], ...mail });
}

export async function onAccountCreated(notice: SignupNotice): Promise<void> {
  await Promise.allSettled([notifyOwnerOfSignup(notice), sendWelcomeSignupEmail(notice)]);
}
