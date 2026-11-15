import { getSql } from "@/lib/db";
import type { PointBoard } from "./board";

export type { PointBoard };

const EMPTY: PointBoard = { betaInvited: false, betaSubmitted: 0, hasPlan: false };

/** What this account has already done. Missing tables leave the board blank, not broken. */
export async function loadPointBoard(userId: string): Promise<PointBoard> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ submitted: number; invited: boolean; has_plan: boolean }>(
      `select
         (select count(*)::int from mach_beta_responses where user_id = $1 and status = 'submitted') as submitted,
         exists (
           select 1 from mach_beta_access a
           join "user" u on lower(u.email) = lower(a.email)
           where u.id = $1
         ) as invited,
         exists (select 1 from mach_plans where user_id = $1) as has_plan`,
      [userId],
    );
    const row = rows[0];
    return {
      betaSubmitted: Number(row?.submitted ?? 0),
      betaInvited: Boolean(row?.invited),
      hasPlan: Boolean(row?.has_plan),
    };
  } catch {
    return EMPTY;
  }
}
