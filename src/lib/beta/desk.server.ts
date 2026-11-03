import { getSql } from "@/lib/db";
import type { BetaAccount, BetaDeskDetail, BetaDeskRow, BetaInvite } from "./desk";
import { betaCsv, type BetaExportRow } from "./export";
import { parseAnswers } from "./form";

const EMAIL_MAX = 200;

export function normalizeBetaEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function parseBetaLimit(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const limit = Number(text);
  if (!Number.isInteger(limit) || limit > 100) return null;
  return limit;
}

type Stored = {
  id: string;
  name: string | null;
  email: string | null;
  pass_n: number;
  submitted_at: string;
  answers: unknown;
};

const SUBMITTED_SQL = `
  select s.id,
         s.answers->>'name' as name,
         s.answers->>'email' as email,
         s.pass_n,
         to_char(s.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as submitted_at,
         s.answers
  from (
    select r.id,
           r.answers,
           r.submitted_at,
           row_number() over (partition by r.user_id order by r.submitted_at asc, r.id asc) as pass_n
    from mach_beta_responses r
    where r.status = 'submitted'
  ) s
`;

function asRow(row: Stored): BetaExportRow {
  const answers = parseAnswers(row.answers);
  return {
    name: answers.name || row.name || "",
    email: answers.email || row.email || "",
    pass: Number(row.pass_n),
    submittedAt: row.submitted_at,
    answers,
  };
}

export async function betaDesk(): Promise<{ invites: BetaInvite[]; rows: BetaDeskRow[]; accounts: BetaAccount[] }> {
  const sql = await getSql();
  const invites = await sql.query<{ email: string; submitted: number; submission_limit: number }>(
    `select a.email,
            a.submission_limit,
            coalesce((
              select count(*)::int
              from mach_beta_responses r
              join "user" u on u.id = r.user_id
              where lower(u.email) = a.email and r.status = 'submitted'
            ), 0) as submitted
     from mach_beta_access a
     order by a.granted_at desc`,
  );
  const rows = await sql.query<Stored>(`${SUBMITTED_SQL} order by s.submitted_at desc`);
  const accounts = await sql.query<{ email: string; name: string | null }>(
    `select lower(u.email) as email, coalesce(u.name, '') as name
     from "user" u
     where u.email is not null
       and btrim(u.email) <> ''
       and not exists (
         select 1 from mach_beta_access a where a.email = lower(u.email)
       )
     order by lower(coalesce(nullif(btrim(u.name), ''), u.email))`,
  );
  return {
    invites: invites.map((row) => ({
      email: row.email,
      submitted: Number(row.submitted),
      limit: Number(row.submission_limit),
    })),
    rows: rows.map((row) => {
      const item = asRow(row);
      return {
        id: row.id,
        name: item.name,
        email: item.email,
        pass: item.pass,
        submittedAt: item.submittedAt,
      };
    }),
    accounts: accounts
      .filter((row) => row.email)
      .map((row) => ({ email: row.email, name: (row.name ?? "").trim() })),
  };
}

export async function grantBetaEmail(
  email: string,
  grantedBy: string,
): Promise<{ name: string } | null> {
  const sql = await getSql();
  const users = await sql.query<{ email: string; name: string | null }>(
    `select lower(email) as email, name from "user" where lower(email) = $1 limit 1`,
    [email],
  );
  const user = users[0];
  if (!user?.email) return null;
  await sql.query(
    `insert into mach_beta_access (email, granted_by, submission_limit) values ($1, $2, 3)`,
    [user.email, grantedBy],
  );
  return { name: (user.name ?? "").trim() };
}

export async function setBetaLimit(email: string, limit: number): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query<{ email: string }>(
    `update mach_beta_access set submission_limit = $2 where email = $1 returning email`,
    [email, limit],
  );
  return rows.length > 0;
}

export async function revokeBetaEmail(email: string): Promise<void> {
  const sql = await getSql();
  await sql.query(`delete from mach_beta_access where email = $1`, [email]);
}

export async function betaDeskOne(id: string): Promise<BetaDeskDetail | null> {
  const sql = await getSql();
  const rows = await sql.query<Stored>(`${SUBMITTED_SQL} where s.id = $1`, [id]);
  const row = rows[0];
  if (!row) return null;
  const item = asRow(row);
  return { id: row.id, ...item };
}

export async function betaDeskCsv(): Promise<string> {
  const sql = await getSql();
  const rows = await sql.query<Stored>(`${SUBMITTED_SQL} order by s.submitted_at desc`);
  return betaCsv(rows.map(asRow));
}
