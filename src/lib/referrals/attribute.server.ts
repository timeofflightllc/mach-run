import { randomUUID } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import {
  canAttributeReferral,
  codeFromCookieHeader,
  newReferralCode,
} from "./code";

export async function referralCodeFromRequest(): Promise<string | null> {
  const request = getRequest();
  return codeFromCookieHeader(request?.headers.get("cookie"));
}

/** One personal code per user. A second call returns the same code. */
export async function ensurePersonalCode(userId: string): Promise<string> {
  const sql = await getSql();
  const existing = await sql.query<{ code: string }>(
    `select code from mach_referral_codes
     where owner_user_id = $1 and kind = 'personal'
     limit 1`,
    [userId],
  );
  if (existing[0]?.code) return existing[0].code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newReferralCode();
    try {
      const inserted = await sql.query<{ code: string }>(
        `insert into mach_referral_codes (code, owner_user_id, kind)
         values ($1, $2, 'personal')
         on conflict (code) do nothing
         returning code`,
        [code, userId],
      );
      if (inserted[0]?.code) return inserted[0].code;
    } catch {
      /* the one-personal index lost a race */
    }
    const again = await sql.query<{ code: string }>(
      `select code from mach_referral_codes
       where owner_user_id = $1 and kind = 'personal'
       limit 1`,
      [userId],
    );
    if (again[0]?.code) return again[0].code;
  }
  throw new Error("Could not create a referral code.");
}

/** A campaign code counts signups and does not pay anyone. */
export async function createCampaignCode(ownerUserId: string, name: string): Promise<string> {
  const label = name.trim();
  if (!label || label.length > 80) throw new Error("Name the campaign.");
  const sql = await getSql();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newReferralCode();
    const inserted = await sql.query<{ code: string }>(
      `insert into mach_referral_codes (code, owner_user_id, kind, name)
       values ($1, $2, 'campaign', $3)
       on conflict (code) do nothing
       returning code`,
      [code, ownerUserId, label],
    );
    if (inserted[0]?.code) return inserted[0].code;
  }
  throw new Error("Could not create a campaign code.");
}

/**
 * Writes one signup row for a brand-new account. The first code wins.
 * An unknown code, a missing owner, or the same user or email writes nothing.
 */
export async function attributeReferralSignup(user: {
  id: string;
  email?: string | null;
}): Promise<void> {
  const code = await referralCodeFromRequest();
  if (!code || !user.id) return;
  const sql = await getSql();
  const owners = await sql.query<{ owner_user_id: string; email: string | null }>(
    `select c.owner_user_id, u.email
     from mach_referral_codes c
     left join "user" u on u.id = c.owner_user_id
     where c.code = $1
     limit 1`,
    [code],
  );
  const owner = owners[0];
  if (!owner) return;
  if (
    !canAttributeReferral({
      ownerId: owner.owner_user_id,
      ownerEmail: owner.email,
      newUserId: user.id,
      newEmail: user.email,
    })
  ) {
    return;
  }
  await sql.query(
    `insert into mach_referral_signups (id, code, new_user_id, new_email, status)
     values ($1, $2, $3, $4, 'signed-up')
     on conflict (new_user_id) do nothing`,
    [randomUUID(), code, user.id, (user.email ?? "").trim().toLowerCase()],
  );
}
