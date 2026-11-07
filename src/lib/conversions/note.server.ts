import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";

const COOKIE = "mach_vid";
const MAX_AGE = 400 * 24 * 60 * 60;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function httpsRequest(): boolean {
  const request = getRequest();
  if (!request) return false;
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

function remember(id: string) {
  setCookie(COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: MAX_AGE,
    secure: httpsRequest(),
  });
}

/** Count one visitor event. The id comes from the cookie, never from the body. */
export async function noteVisitorEvent(event: string): Promise<void> {
  if (
    event !== "visit" &&
    event !== "quiz_finished" &&
    event !== "retired_pay" &&
    event !== "demo"
  ) {
    return;
  }

  let id = getCookie(COOKIE) ?? "";
  if (!UUID.test(id)) {
    id = crypto.randomUUID();
    remember(id);
  }

  const sql = await getSql();
  if (event === "visit") {
    await sql.query(
      `insert into mach_visitors (id) values ($1)
       on conflict (id) do update
       set last_seen_at = now()
       where (mach_visitors.last_seen_at at time zone 'utc')::date
           < (now() at time zone 'utc')::date`,
      [id],
    );
    return;
  }

  const column =
    event === "quiz_finished"
      ? "quiz_finished_at"
      : event === "retired_pay"
        ? "retired_pay_at"
        : "demo_at";
  await sql.query(
    `insert into mach_visitors (id, ${column}) values ($1, now())
     on conflict (id) do update
     set ${column} = now()
     where mach_visitors.${column} is null`,
    [id],
  );
}

/** Link this browser to an account. A row already linked to someone else stays there. */
export async function attachVisitorUser(userId: string): Promise<void> {
  const id = getCookie(COOKIE) ?? "";
  const account = userId.trim();
  if (!UUID.test(id) || !account) return;
  const sql = await getSql();
  await sql.query(
    `update mach_visitors
     set user_id = $1
     where id = $2 and user_id is null`,
    [account, id],
  );
}
