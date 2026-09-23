import { getSql } from "@/lib/db";
import {
  EMAIL_KINDS,
  SAMPLE_TOKENS,
  defaultDraft,
  emailDef,
  testSubject,
  validateEmailDraft,
  type EmailKind,
} from "./email-copy";

export type EmailCopyRow = {
  kind: EmailKind;
  label: string;
  audience: string;
  tokens: string[];
  subject: string;
  body: string;
  custom: boolean;
};

async function ensureEmailCopyTable(): Promise<boolean> {
  try {
    const sql = await getSql();
    await sql.query(`
      create table if not exists mach_email_copy (
        kind text primary key,
        subject text not null,
        body text not null,
        updated_at timestamptz not null default now()
      )
    `);
    return true;
  } catch {
    return false;
  }
}

/** Null when the table is missing, the query fails, or nothing is saved. Never throws. */
export async function readEmailCopy(kind: EmailKind): Promise<{ subject: string; body: string } | null> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ subject: string | null; body: string | null }>(
      `select subject, body from mach_email_copy where kind = $1 limit 1`,
      [kind],
    );
    const row = rows[0];
    const subject = (row?.subject ?? "").trim();
    const body = (row?.body ?? "").trim();
    if (!subject || !body) return null;
    return { subject, body };
  } catch {
    return null;
  }
}

export async function listEmailCopy(): Promise<EmailCopyRow[]> {
  const saved = new Map<string, { subject: string; body: string }>();
  if (await ensureEmailCopyTable()) {
    try {
      const sql = await getSql();
      const rows = await sql.query<{ kind: string; subject: string | null; body: string | null }>(
        `select kind, subject, body from mach_email_copy`,
      );
      for (const row of rows) {
        const subject = (row.subject ?? "").trim();
        const body = (row.body ?? "").trim();
        if (subject && body) saved.set(row.kind, { subject, body });
      }
    } catch {
      /* built-in copy still shows */
    }
  }
  return EMAIL_KINDS.map((kind) => {
    const def = emailDef(kind);
    const row = saved.get(kind);
    const fallback = defaultDraft(kind);
    return {
      kind,
      label: def.label,
      audience: def.audience,
      tokens: [...def.tokens],
      subject: row?.subject ?? fallback.subject,
      body: row?.body ?? fallback.body,
      custom: Boolean(row),
    };
  });
}

export async function saveEmailCopy(
  kind: EmailKind,
  subject: string,
  body: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const problem = validateEmailDraft(kind, subject, body);
  if (problem) return { ok: false, reason: problem };
  if (!(await ensureEmailCopyTable())) return { ok: false, reason: "Mail copy is unavailable." };
  try {
    const sql = await getSql();
    if (!subject.trim() && !body.trim()) {
      await sql.query(`delete from mach_email_copy where kind = $1`, [kind]);
      return { ok: true };
    }
    await sql.query(
      `insert into mach_email_copy (kind, subject, body, updated_at)
       values ($1, $2, $3, now())
       on conflict (kind) do update set
         subject = excluded.subject,
         body = excluded.body,
         updated_at = now()`,
      [kind, subject.trim(), body.trim()],
    );
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not save that email." };
  }
}

export async function sendEmailCopyTest(
  to: string,
  kind: EmailKind,
  draft?: { subject: string; body: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const dest = to.trim();
  if (!dest.includes("@")) return { ok: false, reason: "No admin email on this login." };
  if (!(process.env.RESEND_API_KEY ?? "").trim()) {
    return { ok: false, reason: "Mail is not connected." };
  }
  try {
    const typed = draft && (draft.subject.trim() || draft.body.trim()) ? draft : null;
    if (typed) {
      const problem = validateEmailDraft(kind, typed.subject, typed.body);
      if (problem) return { ok: false, reason: problem };
    }
    const saved = typed ? { subject: typed.subject.trim(), body: typed.body.trim() } : await readEmailCopy(kind);
    const copy = saved ?? defaultDraft(kind);
    const { renderAutomatedEmail } = await import("./email-render");
    const { deliverNotify } = await import("./signup");
    const mail = renderAutomatedEmail(kind, copy, SAMPLE_TOKENS);
    const result = await deliverNotify({
      to: [dest],
      subject: testSubject(mail.subject),
      html: mail.html,
      text: mail.text,
    });
    if (!result.ok) {
      if (result.reason.includes("RESEND_API_KEY")) return { ok: false, reason: "Mail is not connected." };
      return { ok: false, reason: result.reason };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not send the test." };
  }
}
