import { getRequest } from "@tanstack/react-start/server";
import { auth, authConfigured } from "./server";
import type { SessionSnapshot } from "./session-snapshot";

const SNAPSHOT_MS = 1000;

/**
 * Read the signed-in user from the request cookie for the first HTML paint.
 * A valid `session_data` cookie is answered by Better Auth's cookie cache,
 * without a database round trip. No cookie returns null immediately.
 * Auth off, a throw, and a read still running after one second each return
 * null. This never throws and never clears the login cookie.
 */
export async function readSessionSnapshot(): Promise<SessionSnapshot | null> {
  try {
    if (!authConfigured) return null;
    const request = getRequest();
    if (!request) return null;
    const pending = auth.api.getSession({ headers: request.headers }).then(
      (session) => session,
      () => null,
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), SNAPSHOT_MS);
    });
    const session = await Promise.race([pending, timeout]);
    if (timer) clearTimeout(timer);
    const user = session?.user;
    if (!user?.id) return null;
    const plan = await paintedPlan(user.id);
    return {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      plan,
    };
  } catch {
    return null;
  }
}

/** Package for the first paint. Null means unknown, not free. */
async function paintedPlan(userId: string): Promise<import("@/lib/billing/limits").MachPackage | null> {
  try {
    const { ensureSubscriptionsTable } = await import("@/lib/billing/schema.server");
    const { getSql } = await import("@/lib/db");
    const { paidFromStatus } = await import("@/lib/billing/limits");
    const { packageFromPrice } = await import("@/lib/billing/api");
    await ensureSubscriptionsTable();
    const sql = await getSql();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), 400);
    });
    const rows = await Promise.race([
      sql<{ status: string; price_id: string | null; advisor_grant: boolean | null }>`
        select status, price_id, advisor_grant
        from mach_subscriptions
        where user_id = ${userId}
        limit 1
      `,
      timeout,
    ]);
    if (timer) clearTimeout(timer);
    if (!rows) return null;
    const row = rows[0];
    if (!row) return "free";
    const paid = paidFromStatus(row.status);
    if (paid && row.advisor_grant) return "advisor";
    return packageFromPrice(row.price_id, paid);
  } catch {
    return null;
  }
}
