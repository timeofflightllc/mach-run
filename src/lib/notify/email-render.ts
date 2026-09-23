import { wrapEmail } from "./signup.ts";
import { VERIFY_URL, emailDef, fillTokens, type EmailDraft, type EmailKind, type EmailTokens } from "./email-copy.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

function fillHtml(template: string, kind: EmailKind, tokens: EmailTokens): string {
  const allowed = new Set<string>(emailDef(kind).tokens);
  const source = escapeHtml(template).replace(/Hi \{\{\s*first_name\s*\}\},/g, (line) =>
    tokens.first_name.trim() ? line : "Hi,",
  );
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key: string) => {
    const k = key.toLowerCase();
    if (!allowed.has(k) || !(k in tokens)) return full;
    return escapeHtml(tokens[k as keyof EmailTokens] ?? "");
  });
}

function isCodeBlock(block: string): boolean {
  return /^\{\{\s*code\s*\}\}$/i.test(block.trim());
}

function isChecklist(block: string): boolean {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((line) => /^\d+\.\s+\S/.test(line));
}

function paragraph(inner: string): string {
  return `<tr><td style="padding:0 28px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#3D4A54;">
          ${inner}
        </td></tr>`;
}

function codeAndButton(code: string): string {
  const digits = escapeHtml(code || "------");
  return `<tr><td align="center" style="padding:0 28px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#1A2330;">
            <tr><td style="padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:32px;letter-spacing:0.28em;color:#E8EDF1;">
              ${digits}
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:0 28px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="#C45E3A" style="background-color:#C45E3A;">
                <a href="${VERIFY_URL}" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFF8F4;text-decoration:none;">Verify Email</a>
              </td>
            </tr>
          </table>
        </td></tr>`;
}

function checklist(block: string, kind: EmailKind, tokens: EmailTokens): string {
  const rows = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\.\s+(.+)$/);
      if (!match) return "";
      const rest = match[2] ?? "";
      const split = rest.split(/\s+—\s+|\s+-\s+/);
      const title = fillHtml(split[0] ?? rest, kind, tokens);
      const detail = split.length > 1 ? fillHtml(split.slice(1).join(" — "), kind, tokens) : "";
      return `<tr>
              <td valign="top" style="width:36px;padding:10px 10px 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#1E2A32;">${escapeHtml(match[1] ?? "")}.</td>
              <td style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#3D4A54;">
                <strong style="color:#1E2A32;">${title}</strong>${detail ? `<br />${detail}` : ""}
              </td>
            </tr>`;
    })
    .join("");
  return `<tr><td style="padding:0 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ECE7DC;">
            <tr><td style="padding:8px 16px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rows}
              </table>
            </td></tr>
          </table>
        </td></tr>`;
}

function openButton(): string {
  return `<tr><td align="center" style="padding:12px 28px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="#C45E3A" style="background-color:#C45E3A;">
                <a href="https://machrun.com" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFF8F4;text-decoration:none;">Open MACH RUN</a>
              </td>
            </tr>
          </table>
        </td></tr>`;
}

const SHELL: Record<EmailKind, { title: string; align: "left" | "center"; preheader: string; why: boolean; open: boolean }> = {
  verify: {
    title: "Verify your email to go supersonic.",
    align: "left",
    preheader: "Your MACH RUN verification code.",
    why: true,
    open: false,
  },
  first_flight: {
    title: "First Flight Checklist",
    align: "center",
    preheader: "Email verified. Open machrun.com.",
    why: true,
    open: true,
  },
  owner_alert: {
    title: "New account",
    align: "left",
    preheader: "New MACH RUN account.",
    why: false,
    open: false,
  },
};

export function renderAutomatedEmail(
  kind: EmailKind,
  draft: EmailDraft,
  tokens: EmailTokens,
): { subject: string; html: string; text: string } {
  const shell = SHELL[kind];
  const body = draft.body.replace(/\r\n/g, "\n").trim();
  const blocks = body.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const inner = blocks
    .map((block) => {
      if (kind === "verify" && isCodeBlock(block)) return codeAndButton(tokens.code);
      if (isChecklist(block)) return checklist(block, kind, tokens);
      return paragraph(fillHtml(block, kind, tokens).replace(/\n/g, "<br />"));
    })
    .join("");
  const html = wrapEmail(
    shell.title,
    `${inner}${shell.open ? openButton() : ""}`,
    shell.preheader,
    shell.align,
    shell.why,
  );
  const subject = fillTokens(draft.subject, kind, tokens).replace(/\s+/g, " ").trim();
  const text = fillTokens(body, kind, tokens);
  return { subject, html, text };
}
