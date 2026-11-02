import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { codeFromCookieHeader, normalizeReferralCode } from "./code";

/** One click when a campaign link is opened. A personal link is not counted. */
export async function recordCampaignClick(): Promise<void> {
  const request = getRequest();
  if (!request) return;
  let code: string | null = null;
  try {
    code = normalizeReferralCode(new URL(request.url).searchParams.get("ref"));
  } catch {
    return;
  }
  if (!code) return;
  if (codeFromCookieHeader(request.headers.get("cookie")) === code) return;
  const sql = await getSql();
  await sql.query(
    `create table if not exists mach_referral_clicks (
       code text primary key references mach_referral_codes (code),
       clicks integer not null default 0
     )`,
  );
  const rows = await sql.query<{ kind: string }>(
    `select kind from mach_referral_codes where code = $1 limit 1`,
    [code],
  );
  if (rows[0]?.kind !== "campaign") return;
  await sql.query(
    `insert into mach_referral_clicks (code, clicks) values ($1, 1)
     on conflict (code) do update set clicks = mach_referral_clicks.clicks + 1`,
    [code],
  );
}
