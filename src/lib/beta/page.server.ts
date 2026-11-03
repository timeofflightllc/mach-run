import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import {
  hatIsBlank,
  hatMissing,
  knownHat,
  parseAnswers,
  sanitizeAnswers,
  type BetaAnswers,
  type BetaPage,
  type BetaSubmitted,
} from "./form";

type Access = { email: string; limit: number };

async function accountEmail(userId: string): Promise<string> {
  const sql = await getSql();
  const rows = await sql.query<{ email: string | null }>(
    `select email from "user" where id = $1 limit 1`,
    [userId],
  );
  return (rows[0]?.email ?? "").trim().toLowerCase();
}

async function loadAccess(userId: string): Promise<Access | null> {
  const email = await accountEmail(userId);
  if (!email) return null;
  const sql = await getSql();
  const rows = await sql.query<{ submission_limit: number }>(
    `select submission_limit from mach_beta_access where email = $1 limit 1`,
    [email],
  );
  const row = rows[0];
  if (!row) return null;
  return { email, limit: Number(row.submission_limit) };
}

async function submittedCount(userId: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from mach_beta_responses where user_id = $1 and status = 'submitted'`,
    [userId],
  );
  return Number(rows[0]?.n ?? 0);
}

function closedMessage(limit: number): string {
  return `You have used all ${limit} debriefs. Ask MACH RUN if you need another pass.`;
}

export async function loadBetaAccountLink(
  userId: string,
): Promise<{ open: false } | { open: true; submittedCount: number; limit: number }> {
  const access = await loadAccess(userId);
  if (!access) return { open: false };
  return { open: true, submittedCount: await submittedCount(userId), limit: access.limit };
}

export async function loadBetaPage(userId: string): Promise<BetaPage> {
  const access = await loadAccess(userId);
  if (!access) return { open: false };
  const sql = await getSql();
  const drafts = await sql.query<{ answers: unknown }>(
    `select answers from mach_beta_responses where user_id = $1 and status = 'draft' limit 1`,
    [userId],
  );
  const rows = await sql.query<{ id: string; submitted_at: string; answers: unknown }>(
    `select id,
            to_char(submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as submitted_at,
            answers
     from mach_beta_responses
     where user_id = $1 and status = 'submitted'
     order by submitted_at desc nulls last`,
    [userId],
  );
  const submitted: BetaSubmitted[] = rows.map((row) => ({
    id: row.id,
    submittedAt: row.submitted_at,
    answers: parseAnswers(row.answers),
  }));
  const draft = drafts[0] ? parseAnswers(drafts[0].answers) : null;
  if (draft) draft.email = access.email;
  const savedHat = knownHat(submitted);
  if (draft && savedHat && hatIsBlank(draft.hat)) draft.hat = savedHat;
  return {
    open: true,
    email: access.email,
    limit: access.limit,
    submittedCount: submitted.length,
    draft,
    knownHat: savedHat,
    submitted,
  };
}

async function writeAnswers(
  userId: string,
  answers: BetaAnswers,
  status: "draft" | "submitted",
  limit = 0,
): Promise<boolean> {
  const sql = await getSql();
  const payload = JSON.stringify(answers);
  const existing = await sql.query<{ id: string }>(
    `select id from mach_beta_responses where user_id = $1 and status = 'draft' limit 1`,
    [userId],
  );
  if (existing[0] && status === "draft") {
    await sql.query(
      `update mach_beta_responses
       set answers = $2::jsonb, updated_at = now()
       where id = $1 and user_id = $3 and status = 'draft'`,
      [existing[0].id, payload, userId],
    );
    return true;
  }
  if (existing[0] && status === "submitted") {
    const rows = await sql.query<{ id: string }>(
      `update mach_beta_responses
       set status = 'submitted', answers = $2::jsonb, updated_at = now(), submitted_at = now()
       where id = $1 and user_id = $3 and status = 'draft'
         and (
           select count(*) from mach_beta_responses
           where user_id = $3 and status = 'submitted'
         ) < $4
       returning id`,
      [existing[0].id, payload, userId, limit],
    );
    return rows.length > 0;
  }
  if (status === "submitted") {
    const rows = await sql.query<{ id: string }>(
      `insert into mach_beta_responses (id, user_id, status, answers, submitted_at)
       select $1, $2, 'submitted', $3::jsonb, now()
       where (
         select count(*) from mach_beta_responses
         where user_id = $2 and status = 'submitted'
       ) < $4
       returning id`,
      [randomUUID(), userId, payload, limit],
    );
    return rows.length > 0;
  }
  try {
    await sql.query(
      `insert into mach_beta_responses (id, user_id, status, answers)
       values ($1, $2, 'draft', $3::jsonb)`,
      [randomUUID(), userId, payload],
    );
    return true;
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code !== "23505") throw err;
    await sql.query(
      `update mach_beta_responses
       set answers = $2::jsonb, updated_at = now()
       where user_id = $1 and status = 'draft'`,
      [userId, payload],
    );
    return true;
  }
}

export async function saveBetaDraft(
  userId: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await loadAccess(userId);
  if (!access) return { ok: false, error: "This debrief is not open for this account." };
  const used = await submittedCount(userId);
  if (used >= access.limit) return { ok: false, error: closedMessage(access.limit) };
  const answers = sanitizeAnswers(input);
  answers.email = access.email;
  await writeAnswers(userId, answers, "draft");
  return { ok: true };
}

export async function submitBeta(
  userId: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await loadAccess(userId);
  if (!access) return { ok: false, error: "This debrief is not open for this account." };
  const used = await submittedCount(userId);
  if (used >= access.limit) return { ok: false, error: closedMessage(access.limit) };
  const answers = sanitizeAnswers(input);
  answers.email = access.email;
  if (hatMissing(answers)) {
    return {
      ok: false,
      error: "A mailing address is required, or check “Please do not send a hat.”",
    };
  }
  const wrote = await writeAnswers(userId, answers, "submitted", access.limit);
  if (!wrote) return { ok: false, error: closedMessage(access.limit) };
  try {
    const pass = await submittedCount(userId);
    const { sendBetaDebriefMail } = await import("../notify/contact");
    await sendBetaDebriefMail({
      name: answers.name.trim() || "—",
      email: access.email,
      pass,
      limit: access.limit,
    });
  } catch {
    /* The debrief is already saved. Do not tell the tester the mail failed. */
  }
  return { ok: true };
}
