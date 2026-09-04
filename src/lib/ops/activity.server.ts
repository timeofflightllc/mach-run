import { getSql } from "@/lib/db";
import {
  EMPTY_ACTIVITY,
  type MachActivityAction,
  type MachActivityEvent,
  type MachActivityShape,
  type MachActivitySummary,
} from "./activity";

async function ensureActivityTable(): Promise<boolean> {
  try {
    const sql = await getSql();
    await sql.query(`
      create table if not exists mach_user_activity (
        id text primary key,
        user_id text not null,
        at timestamptz not null default now(),
        action text not null,
        detail jsonb
      )
    `);
    await sql.query(`
      create index if not exists mach_user_activity_user_at_idx
        on mach_user_activity (user_id, at desc)
    `);
    return true;
  } catch {
    return false;
  }
}

function asShape(detail: Record<string, unknown> | null | undefined): string {
  if (!detail) return "";
  return [
    detail.accounts,
    detail.incomes,
    detail.contributions,
    detail.spending,
    detail.liabilities,
    detail.profiles,
  ].join("|");
}

export async function recordUserActivity(input: {
  userId: string;
  action: MachActivityAction;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const ok = await ensureActivityTable();
  if (!ok) return;
  try {
    const sql = await getSql();
    if (input.action === "plan_save" && input.detail) {
      const last = await sql.query<{ action: string; detail: unknown }>(
        `select action, detail from mach_user_activity
         where user_id = $1 and action in ('plan_save', 'calculate')
         order by at desc limit 1`,
        [input.userId],
      );
      const prev =
        last[0]?.detail && typeof last[0].detail === "object"
          ? (last[0].detail as Record<string, unknown>)
          : null;
      if (prev && asShape(prev) === asShape(input.detail)) return;
    }
    await sql.query(
      `insert into mach_user_activity (id, user_id, at, action, detail)
       values ($1, $2, now(), $3, $4::jsonb)`,
      [
        crypto.randomUUID(),
        input.userId,
        input.action,
        JSON.stringify(input.detail ?? {}),
      ],
    );
  } catch {
    /* activity is best-effort — never block Calculate */
  }
}

export async function loadUserActivity(userId: string): Promise<MachActivitySummary> {
  const ok = await ensureActivityTable();
  if (!ok) return { ...EMPTY_ACTIVITY };
  try {
    const sql = await getSql();
    const counts = await sql.query<{ action: string; n: string | number }>(
      `select action, count(*)::int as n from mach_user_activity
       where user_id = $1 and action in ('calculate', 'pdf', 'backup_download')
       group by action`,
      [userId],
    );
    const tally: Record<string, number> = {};
    for (const row of counts) tally[row.action] = Number(row.n) || 0;
    const rows = await sql.query<{
      id: string;
      at: Date | string | null;
      action: string;
      detail: unknown;
    }>(
      `select id, at, action, detail from mach_user_activity
       where user_id = $1
       order by at desc
       limit 80`,
      [userId],
    );
    const events: MachActivityEvent[] = rows.map((row) => ({
      id: row.id,
      at:
        row.at == null
          ? null
          : typeof row.at === "string"
            ? row.at
            : row.at.toISOString(),
      action: row.action,
      detail:
        row.detail && typeof row.detail === "object"
          ? (row.detail as Record<string, unknown>)
          : {},
    }));
    return {
      calculateCount: tally.calculate ?? 0,
      pdfCount: tally.pdf ?? 0,
      backupCount: tally.backup_download ?? 0,
      events,
    };
  } catch {
    return { ...EMPTY_ACTIVITY };
  }
}

export function shapeFromUnknown(raw: unknown): MachActivityShape {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const plan =
    obj.kind === "library" && Array.isArray(obj.profiles)
      ? ((obj.profiles as { plan?: unknown }[])[0]?.plan ?? {})
      : obj.plan && typeof obj.plan === "object"
        ? obj.plan
        : raw;
  const p = plan && typeof plan === "object" ? (plan as Record<string, unknown>) : {};
  const profiles =
    obj.kind === "library" && Array.isArray(obj.profiles) ? obj.profiles.length : 1;
  return {
    accounts: Array.isArray(p.portfolios) ? p.portfolios.length : 0,
    incomes: Array.isArray(p.incomes) ? p.incomes.length : 0,
    contributions: Array.isArray(p.contributions) ? p.contributions.length : 0,
    spending: Array.isArray(p.spending) ? p.spending.length : 0,
    liabilities: Array.isArray(p.liabilities) ? p.liabilities.length : 0,
    profiles,
  };
}
