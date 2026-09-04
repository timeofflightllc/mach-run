import { getSql } from "@/lib/db";

export type EmailPrefs = {
  required: true;
  optionalOk: boolean;
};

async function ensureEmailPrefsTable(): Promise<boolean> {
  try {
    const sql = await getSql();
    await sql.query(`
      create table if not exists mach_email_prefs (
        user_id text primary key,
        optional_ok boolean not null default true,
        updated_at timestamptz not null default now()
      )
    `);
    return true;
  } catch {
    return false;
  }
}

export async function readEmailPrefs(userId: string): Promise<EmailPrefs> {
  const ok = await ensureEmailPrefsTable();
  if (!ok) return { required: true, optionalOk: true };
  try {
    const sql = await getSql();
    const rows = await sql.query<{ optional_ok: boolean }>(
      `select optional_ok from mach_email_prefs where user_id = $1 limit 1`,
      [userId],
    );
    return { required: true, optionalOk: rows[0]?.optional_ok !== false };
  } catch {
    return { required: true, optionalOk: true };
  }
}

export async function writeOptionalEmails(userId: string, optionalOk: boolean): Promise<EmailPrefs> {
  const ok = await ensureEmailPrefsTable();
  if (!ok) throw new Error("Could not save email preferences.");
  const sql = await getSql();
  await sql.query(
    `insert into mach_email_prefs (user_id, optional_ok, updated_at)
     values ($1, $2, now())
     on conflict (user_id) do update set
       optional_ok = excluded.optional_ok,
       updated_at = now()`,
    [userId, optionalOk],
  );
  return { required: true, optionalOk };
}

/** Gate optional MACH RUN product mail. Required account mail always sends. */
export async function maySendOptionalEmail(userId: string): Promise<boolean> {
  const prefs = await readEmailPrefs(userId);
  return prefs.optionalOk;
}
