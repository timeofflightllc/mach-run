import { randomInt } from "node:crypto";
import { getSql } from "@/lib/db";
import { rewardsTermsAccepted } from "./acceptance.server";
import { insertInstagramGrant } from "./instagram-delivery.ts";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newInstagramRewardCode(): string {
  let code = "";
  for (let i = 0; i < 10; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

function isUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && String((current as { code?: unknown }).code) === "23505") return true;
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}

/** The code for a member who has already joined. Anyone else gets nothing, and no row. */
export async function instagramRewardCode(userId: string): Promise<string | null> {
  if (!(await rewardsTermsAccepted(userId))) return null;
  const sql = await getSql();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await sql.query<{ code: string }>(
      `select code from mach_reward_instagram_codes where user_id = $1`,
      [userId],
    );
    if (existing[0]?.code) return existing[0].code;
    try {
      const inserted = await sql.query<{ code: string }>(
        `insert into mach_reward_instagram_codes (user_id, code)
         values ($1, $2)
         on conflict (user_id) do nothing
         returning code`,
        [userId, newInstagramRewardCode()],
      );
      if (inserted[0]?.code) return inserted[0].code;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  const last = await sql.query<{ code: string }>(
    `select code from mach_reward_instagram_codes where user_id = $1`,
    [userId],
  );
  return last[0]?.code ?? null;
}

/** One Instagram grant per member. A second delivery does not add a second row. */
export async function grantInstagramCode(code: string): Promise<void> {
  await insertInstagramGrant(await getSql(), code);
}
