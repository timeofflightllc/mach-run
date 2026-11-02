import { getSql } from "@/lib/db";
import { ensurePersonalCode } from "./attribute.server";
import {
  referralDisplayName,
  referralRate,
  referralStatusLabel,
  type ReferralRowStatus,
} from "./summary";

export type ReferralPerson = {
  name: string;
  date: string;
  status: ReferralRowStatus;
};

export type ReferralSummary = {
  code: string;
  signedUp: number;
  yearly: number;
  rate: string;
};

export async function loadReferralSummary(userId: string): Promise<ReferralSummary> {
  const code = await ensurePersonalCode(userId);
  const sql = await getSql();
  const rows = await sql.query<{ signed_up: number; yearly: number }>(
    `select count(*)::int as signed_up,
            count(*) filter (where s.status in ('yearly', 'credit'))::int as yearly
     from mach_referral_signups s
     join mach_referral_codes c on c.code = s.code
     where c.owner_user_id = $1 and c.kind = 'personal'`,
    [userId],
  );
  const signedUp = Number(rows[0]?.signed_up ?? 0);
  const yearly = Number(rows[0]?.yearly ?? 0);
  return { code, signedUp, yearly, rate: referralRate(signedUp, yearly) };
}

export async function loadReferralPeople(userId: string): Promise<ReferralPerson[]> {
  const sql = await getSql();
  const rows = await sql.query<{ name: string | null; date: string; status: string; credit_cents: number | null }>(
    `select u.name,
            to_char(s.created_at at time zone 'UTC', 'YYYY-MM-DD') as date,
            s.status,
            s.credit_cents
     from mach_referral_signups s
     join mach_referral_codes c on c.code = s.code
     left join "user" u on u.id = s.new_user_id
     where c.owner_user_id = $1 and c.kind = 'personal'
     order by s.created_at desc`,
    [userId],
  );
  return rows.map((row) => ({
    name: referralDisplayName(row.name),
    date: row.date,
    status: referralStatusLabel(row.status, row.credit_cents),
  }));
}
