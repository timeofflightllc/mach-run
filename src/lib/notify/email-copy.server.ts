import { getSql } from "@/lib/db";
import {
  EMAIL_KINDS,
  SAMPLE_TOKENS,
  defaultDraft,
  defaultFooter,
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
  footer: string;
  custom: boolean;
};

type StoredCopy = { subject: string; body: string; footer: string | null };

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
    await sql.query(`alter table mach_email_copy add column if not exists footer text`);
    return true;
  } catch {
    return false;
  }
}

async function readStored(): Promise<Map<string, StoredCopy> | null> {
  const sql = await getSql();
  try {
    const rows = await sql.query<{
      kind: string;
      subject: string | null;
      body: string | null;
      footer: string | null;
    }>(`select kind, subject, body, footer from mach_email_copy`);
    return rowsToMap(rows);
  } catch {
    try {
      const rows = await sql.query<{ kind: string; subject: string | null; body: string | null }>(
        `select kind, subject, body from mach_email_copy`,
      );
      return rowsToMap(rows.map((row) => ({ ...row, footer: null })));
    } catch {
      return null;
    }
  }
}

function rowsToMap(
  rows: { kind: string; subject: string | null; body: string | null; footer: string | null }[],
): Map<string, StoredCopy> {
  const saved = new Map<string, StoredCopy>();
  for (const row of rows) {
    const subject = (row.subject ?? "").trim();
    const body = (row.body ?? "").trim();
    if (!subject || !body) continue;
    saved.set(row.kind, { subject, body, footer: row.footer });
  }
  return saved;
}

/** Null when the table is missing, the query fails, or nothing is saved. Never throws. */
export async function readEmailCopy(kind: EmailKind): Promise<StoredCopy | null> {
  try {
    const saved = await readStored();
    return saved?.get(kind) ?? null;
  } catch {
    return null;
  }
}

export async function listEmailCopy(): Promise<EmailCopyRow[]> {
  const saved = (await ensureEmailCopyTable()) ? await readStored() : null;
  return EMAIL_KINDS.map((kind) => {
    const def = emailDef(kind);
    const row = saved?.get(kind);
    const fallback = defaultDraft(kind);
    return {
      kind,
      label: def.label,
      audience: def.audience,
      tokens: [...def.tokens],
      subject: row?.subject ?? fallback.subject,
      body: row?.body ?? fallback.body,
      footer: row ? (row.footer ?? defaultFooter(kind)) : defaultFooter(kind),
      custom: Boolean(row),
    };
  });
}

export async function saveEmailCopy(
  kind: EmailKind,
  subject: string,
  body: string,
  footer = "",
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const problem = validateEmailDraft(kind, subject, body, footer);
  if (problem) return { ok: false, reason: problem };
  if (!(await ensureEmailCopyTable())) return { ok: false, reason: "Mail copy is unavailable." };
  try {
    const sql = await getSql();
    if (!subject.trim() && !body.trim()) {
      await sql.query(`delete from mach_email_copy where kind = $1`, [kind]);
      return { ok: true };
    }
    await sql.query(
      `insert into mach_email_copy (kind, subject, body, footer, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (kind) do update set
         subject = excluded.subject,
         body = excluded.body,
         footer = excluded.footer,
         updated_at = now()`,
      [kind, subject.trim(), body.trim(), footer.trim()],
    );
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not save that email." };
  }
}

export async function sendEmailCopyTest(
  to: string,
  kind: EmailKind,
  draft?: { subject: string; body: string; footer?: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const dest = to.trim();
  if (!dest.includes("@")) return { ok: false, reason: "No admin email on this login." };
  if (!(process.env.RESEND_API_KEY ?? "").trim()) {
    return { ok: false, reason: "Mail is not connected." };
  }
  try {
    const typed = draft && (draft.subject.trim() || draft.body.trim()) ? draft : null;
    if (typed) {
      const problem = validateEmailDraft(kind, typed.subject, typed.body, typed.footer ?? "");
      if (problem) return { ok: false, reason: problem };
    }
    const saved = typed
      ? { subject: typed.subject.trim(), body: typed.body.trim(), footer: typed.footer ?? null }
      : await readEmailCopy(kind);
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
