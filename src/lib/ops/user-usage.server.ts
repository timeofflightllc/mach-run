import { getSql } from "@/lib/db";
import { openPlanPayload } from "@/lib/plan/plan-at-rest";
import { loadUserActivity, shapeFromUnknown } from "./activity.server";
import {
  EMPTY_USER_USAGE,
  deviceHintFromUa,
  lastUniqueIps,
  shapeFromLatestEvent,
  type OpsUserUsage,
} from "./user-usage";

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return value.toISOString();
  } catch {
    return null;
  }
}

function lastAt(events: { action: string; at: string | null }[], action: string): string | null {
  return events.find((ev) => ev.action === action)?.at ?? null;
}

export async function loadOpsUserUsage(userId: string): Promise<OpsUserUsage> {
  const id = userId.trim();
  if (!id) return { ...EMPTY_USER_USAGE };

  const activity = await loadUserActivity(id);
  const usage: OpsUserUsage = {
    ...EMPTY_USER_USAGE,
    ...activity,
    lastCalculateAt: lastAt(activity.events, "calculate"),
    lastPdfAt: lastAt(activity.events, "pdf"),
    lastBackupAt: lastAt(activity.events, "backup_download"),
    lastLoginAt: lastAt(activity.events, "login"),
    shape: shapeFromLatestEvent(activity.events),
  };

  try {
    const sql = await getSql();
    const users = await sql.query<{ emailVerified: boolean | null }>(
      `select "emailVerified" as "emailVerified" from "user" where id = $1 limit 1`,
      [id],
    );
    if (users[0]) usage.emailVerified = Boolean(users[0].emailVerified);
  } catch {
    /* user row optional */
  }

  try {
    const sql = await getSql();
    const sessions = await sql.query<{
      createdAt: Date | string | null;
      updatedAt: Date | string | null;
      ipAddress: string | null;
      userAgent: string | null;
    }>(
      `select "createdAt" as "createdAt", "updatedAt" as "updatedAt",
              "ipAddress" as "ipAddress", "userAgent" as "userAgent"
         from "session"
        where "userId" = $1
        order by "updatedAt" desc nulls last
        limit 40`,
      [id],
    );
    usage.activeSessions = sessions.length;
    const newest = sessions[0];
    if (newest) {
      const stamp = iso(newest.updatedAt) ?? iso(newest.createdAt);
      if (stamp && (!usage.lastLoginAt || stamp > usage.lastLoginAt)) {
        usage.lastLoginAt = stamp;
      }
      usage.deviceHint = deviceHintFromUa(newest.userAgent);
    }
    usage.lastIps = lastUniqueIps(sessions.map((s) => s.ipAddress));
    const uas: string[] = [];
    for (const s of sessions) {
      const ua = (s.userAgent ?? "").trim();
      if (ua && !uas.includes(ua) && uas.length < 6) uas.push(ua);
    }
    usage.userAgents = uas;
  } catch {
    /* session table optional */
  }

  try {
    const sql = await getSql();
    const plans = await sql.query<{ plan_json: unknown; updated_at: Date | string | null }>(
      `select plan_json, updated_at from mach_plans where user_id = $1 limit 1`,
      [id],
    );
    const row = plans[0];
    if (row) {
      usage.planPresent = true;
      usage.planSavedAt = iso(row.updated_at);
      try {
        const opened = await openPlanPayload(row.plan_json);
        usage.shape = shapeFromUnknown(opened);
        usage.planLocked = false;
      } catch {
        usage.planLocked = true;
      }
    }
  } catch {
    /* mach_plans optional */
  }

  return usage;
}
