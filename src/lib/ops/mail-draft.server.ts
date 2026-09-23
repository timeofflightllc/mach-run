import { getSql } from "@/lib/db";

const DRAFT_ID = "desk";

export type DeskMailDraft = {
  subject: string;
  body: string;
  footer: string;
};

async function ensureDraftTable(): Promise<boolean> {
  try {
    const sql = await getSql();
    await sql.query(`
      create table if not exists mach_desk_mail_draft (
        id text primary key,
        subject text not null,
        body text not null,
        footer text not null,
        updated_at timestamptz not null default now()
      )
    `);
    return true;
  } catch {
    return false;
  }
}

/** Null when the table is missing, the query fails, or no draft is stored. Never throws. */
export async function readDeskMailDraft(): Promise<DeskMailDraft | null> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ subject: string | null; body: string | null; footer: string | null }>(
      `select subject, body, footer from mach_desk_mail_draft where id = $1 limit 1`,
      [DRAFT_ID],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      subject: row.subject ?? "",
      body: row.body ?? "",
      footer: row.footer ?? "",
    };
  } catch {
    return null;
  }
}

export async function saveDeskMailDraft(
  draft: DeskMailDraft,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const subject = draft.subject.slice(0, 200);
  const body = draft.body;
  const footer = draft.footer;
  if (body.length > 20000 || footer.length > 8000) {
    return { ok: false, reason: "That draft is too long." };
  }
  if (!(await ensureDraftTable())) return { ok: false, reason: "Could not save the draft." };
  try {
    const sql = await getSql();
    await sql.query(
      `insert into mach_desk_mail_draft (id, subject, body, footer, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (id) do update set
         subject = excluded.subject,
         body = excluded.body,
         footer = excluded.footer,
         updated_at = now()`,
      [DRAFT_ID, subject, body, footer],
    );
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not save the draft." };
  }
}
