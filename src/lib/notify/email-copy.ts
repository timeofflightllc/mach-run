/** Automated mail the Top 3 desk can edit. No database. No HTML shell. */

export const EMAIL_KINDS = ["verify", "first_flight", "owner_alert"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const VERIFY_URL = "https://machrun.com/verify-email";

export type EmailTokens = {
  first_name: string;
  code: string;
  verify_url: string;
  name: string;
  email: string;
  when: string;
};

export type EmailDraft = { subject: string; body: string; footer?: string | null };

type EmailDef = {
  kind: EmailKind;
  label: string;
  audience: string;
  tokens: (keyof EmailTokens)[];
  subject: string;
  body: string;
  footer: string;
};

/** Plain-text form of the small print under Verify and First Flight today. */
export const SIGNUP_FOOTER = [
  "You received this email only because you signed up for MACHRUN.com. We do not buy, sell, or give away email addresses. We respect your privacy — Privacy policy: https://machrun.com/privacy",
  "Unsubscribe opens your account profile, where you can turn off optional mail or cancel the account: https://machrun.com/account#email-preferences",
].join("\n");

const VERIFY_BODY = [
  "Hi {{first_name}},",
  "",
  "Your MACH RUN account is not created until you enter this code. That keeps junk registrations out.",
  "",
  'Click "Verify Email" below and enter this code when prompted. The code expires in 24 hours. If it expires, open that same page and request a new one.',
  "",
  "{{code}}",
  "",
  "Then open Family, then Accounts. Hit Calculate. That is a MACH RUN.",
  "",
  "Free saves your plan with limits. A cup of coffee a month removes them.",
  "",
  "MACH RUN is for entertainment and education only. It is not financial advice.",
].join("\n");

const FIRST_FLIGHT_BODY = [
  "Hi {{first_name}},",
  "",
  "Email verified. Cleared for takeoff!",
  "",
  "1. Sign in — Open machrun.com.",
  "2. OBSERVE — Family, goals, dates. Then the accounts you have now.",
  "3. ORIENT — Income, then monthly spending.",
  "4. DECIDE — Where investment dollars go.",
  "5. ACT — Hit Calculate. Read the BLUF. Change something. Run it again.",
  "",
  "Free saves your plan with limits. Pricing unlocks more.",
  "",
  "Kick the tires and light your financial fires.",
].join("\n");

const OWNER_BODY = [
  "Someone verified their email and a MACH RUN account was created.",
  "",
  "Name",
  "{{name}}",
  "",
  "Email",
  "{{email}}",
  "",
  "When",
  "{{when}} CT",
  "",
  "This is an owner alert. The new user was not copied.",
].join("\n");

const DEFS: Record<EmailKind, EmailDef> = {
  verify: {
    kind: "verify",
    label: "Verify email",
    audience: "Sent to the new person before the account exists. Includes the 6-digit code.",
    tokens: ["first_name", "code", "verify_url"],
    subject: "Verify your MACH RUN email",
    body: VERIFY_BODY,
    footer: SIGNUP_FOOTER,
  },
  first_flight: {
    kind: "first_flight",
    label: "First Flight Checklist",
    audience: "Sent after the code is accepted.",
    tokens: ["first_name"],
    subject: "MACH RUN — First Flight Checklist",
    body: FIRST_FLIGHT_BODY,
    footer: SIGNUP_FOOTER,
  },
  owner_alert: {
    kind: "owner_alert",
    label: "Owner new-account alert",
    audience: "Sent to MACH_NOTIFY_EMAIL. The new user is not copied.",
    tokens: ["name", "email", "when"],
    subject: "New MACH RUN account — {{email}}",
    body: OWNER_BODY,
    footer: "",
  },
};

export function isEmailKind(value: string): value is EmailKind {
  return (EMAIL_KINDS as readonly string[]).includes(value);
}

export function emailDef(kind: EmailKind): EmailDef {
  return DEFS[kind];
}

export function defaultDraft(kind: EmailKind): EmailDraft {
  const def = DEFS[kind];
  return { subject: def.subject, body: def.body, footer: def.footer };
}

export function defaultFooter(kind: EmailKind): string {
  return DEFS[kind].footer;
}

export function validateEmailDraft(
  kind: EmailKind,
  subject: string,
  body: string,
  footer = "",
): string | null {
  const s = subject.trim();
  const b = body.trim();
  if (!s && !b) return null;
  if (!s || !b) {
    return "Subject and body are both required. Clear both to use the built-in email.";
  }
  if (s.length > 200) return "Subject is too long.";
  if (b.length > 8000) return "Body is too long.";
  if (footer.length > 2000) return "Footer is too long.";
  if (kind === "verify" && !/\{\{\s*code\s*\}\}/i.test(b)) {
    return "The verify email must include {{code}}.";
  }
  return null;
}

export function tokensFromNotice(
  notice: { name?: string | null; email?: string | null; code?: string | null },
  when = liveWhen(),
): EmailTokens {
  const name = (notice.name ?? "").trim();
  return {
    first_name: name.split(/\s+/)[0] || "",
    code: (notice.code ?? "").replace(/\D/g, "").slice(0, 6),
    verify_url: VERIFY_URL,
    name: name || "—",
    email: (notice.email ?? "").trim() || "no email on file",
    when,
  };
}

export const SAMPLE_TOKENS: EmailTokens = {
  first_name: "Alex",
  code: "123456",
  verify_url: VERIFY_URL,
  name: "Alex Flyer",
  email: "alex@example.com",
  when: "Sep 23, 2026, 9:00 AM",
};

export function testSubject(subject: string): string {
  const s = subject.trim();
  if (/^\[TEST\]/i.test(s)) return s;
  return `[TEST] ${s}`;
}

export function fillTokens(template: string, kind: EmailKind, tokens: EmailTokens): string {
  const allowed = new Set<string>(DEFS[kind].tokens);
  const source = template.replace(/Hi \{\{\s*first_name\s*\}\},/g, (line) =>
    tokens.first_name.trim() ? line : "Hi,",
  );
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key: string) => {
    const k = key.toLowerCase();
    if (!allowed.has(k) || !(k in tokens)) return full;
    return tokens[k as keyof EmailTokens] ?? "";
  });
}

function liveWhen(): string {
  return new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  });
}
