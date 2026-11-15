import { instagramMessageCodes, instagramSignatureValid } from "./instagram-webhook.ts";

const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;
const INSTAGRAM_POINTS = 20;

type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

function received() {
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** One Instagram grant per member. A second delivery does not add a second row. */
export async function insertInstagramGrant(sql: Sql, code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  if (!CODE.test(normalized)) return;
  const rows = await sql.query<{ user_id: string }>(
    `select user_id from mach_reward_instagram_codes where code = $1`,
    [normalized],
  );
  const userId = rows[0]?.user_id;
  if (!userId) return;
  await sql.query(
    `insert into mach_reward_grants (id, user_id, source, source_id, points)
     values ($1, $2, 'instagram', $2, $3)
     on conflict (source, source_id) do nothing`,
    [`instagram-${userId}`, userId, INSTAGRAM_POINTS],
  );
}

/**
 * The webhook POST. A bad signature, a missing secret, an unknown code, or
 * more than one code returns 200 and does not write a grant.
 */
export async function deliverInstagramWebhook(
  sql: Sql,
  input: { raw: string; signature: string | null; secret: string | undefined },
): Promise<Response> {
  const secret = input.secret ?? "";
  const header = input.signature ?? "";
  if (!secret || !header || !instagramSignatureValid(input.raw, header, secret)) return received();
  let payload: unknown;
  try {
    payload = JSON.parse(input.raw);
  } catch {
    return received();
  }
  const codes = instagramMessageCodes(payload);
  if (codes.length !== 1) return received();
  await insertInstagramGrant(sql, codes[0]);
  return received();
}
