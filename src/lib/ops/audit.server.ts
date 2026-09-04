import { getSql } from "@/lib/db";

export async function ensureAdminEventsTable(): Promise<boolean> {
  try {
    const sql = await getSql();
    await sql.query(`
      create table if not exists mach_admin_events (
        id text primary key,
        at timestamptz not null default now(),
        actor_user_id text,
        actor_email text,
        target_user_id text,
        target_email text,
        action text not null,
        detail jsonb,
        note text
      )
    `);
    await sql.query(`
      create index if not exists mach_admin_events_at_idx on mach_admin_events (at desc)
    `);
    return true;
  } catch {
    return false;
  }
}

export async function recordAdminEvent(row: {
  actorUserId: string;
  actorEmail: string;
  targetUserId: string;
  targetEmail: string | null;
  action: string;
  detail?: Record<string, unknown>;
  note?: string | null;
}): Promise<string | null> {
  const ok = await ensureAdminEventsTable();
  if (!ok) return "Could not write the desk log.";
  try {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql.query(
      `insert into mach_admin_events
        (id, at, actor_user_id, actor_email, target_user_id, target_email, action, detail, note)
       values ($1, now(), $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        id,
        row.actorUserId,
        row.actorEmail,
        row.targetUserId,
        row.targetEmail,
        row.action,
        JSON.stringify(row.detail ?? {}),
        row.note?.trim() || null,
      ],
    );
    return null;
  } catch {
    return "Could not write the desk log.";
  }
}

type EventRow = {
  id: string;
  at: Date | string | null;
  actor_email: string | null;
  target_user_id: string | null;
  target_email: string | null;
  action: string;
  note: string | null;
};

function mapEvent(row: EventRow) {
  const at =
    row.at == null
      ? null
      : typeof row.at === "string"
        ? row.at
        : row.at.toISOString();
  return {
    id: row.id,
    at,
    actorEmail: row.actor_email,
    targetUserId: row.target_user_id,
    targetEmail: row.target_email,
    action: row.action,
    note: row.note,
  };
}

export async function listAdminEvents(opts: {
  targetUserId?: string;
  limit?: number;
}): Promise<{ events: ReturnType<typeof mapEvent>[]; error: string | null }> {
  const ok = await ensureAdminEventsTable();
  if (!ok) return { events: [], error: "Desk log is unavailable." };
  try {
    const sql = await getSql();
    const limit = Math.min(20, Math.max(1, opts.limit ?? 20));
    const rows = opts.targetUserId
      ? await sql.query<EventRow>(
          `select id, at, actor_email, target_user_id, target_email, action, note
           from mach_admin_events
           where target_user_id = $1
           order by at desc
           limit $2`,
          [opts.targetUserId, limit],
        )
      : await sql.query<EventRow>(
          `select id, at, actor_email, target_user_id, target_email, action, note
           from mach_admin_events
           order by at desc
           limit $1`,
          [limit],
        );
    return { events: rows.map(mapEvent), error: null };
  } catch {
    return { events: [], error: "Desk log is unavailable." };
  }
}

