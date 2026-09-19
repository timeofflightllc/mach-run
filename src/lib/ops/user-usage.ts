import {
  EMPTY_ACTIVITY,
  type MachActivityEvent,
  type MachActivityShape,
  type MachActivitySummary,
} from "./activity";

export type OpsUserUsage = MachActivitySummary & {
  loginCount: number;
  lastLoginAt: string | null;
  lastCalculateAt: string | null;
  lastPdfAt: string | null;
  lastBackupAt: string | null;
  activeSessions: number;
  lastIps: string[];
  deviceHint: string | null;
  userAgents: string[];
  emailVerified: boolean | null;
  planSavedAt: string | null;
  planPresent: boolean;
  planLocked: boolean;
  shape: MachActivityShape | null;
};

export const EMPTY_USER_USAGE: OpsUserUsage = {
  ...EMPTY_ACTIVITY,
  loginCount: 0,
  lastLoginAt: null,
  lastCalculateAt: null,
  lastPdfAt: null,
  lastBackupAt: null,
  activeSessions: 0,
  lastIps: [],
  deviceHint: null,
  userAgents: [],
  emailVerified: null,
  planSavedAt: null,
  planPresent: false,
  planLocked: false,
  shape: null,
};

/** Newest unique IPs first. Sessions already ordered newest-first. */
export function lastUniqueIps(ips: Array<string | null | undefined>, limit = 4): string[] {
  const out: string[] = [];
  for (const raw of ips) {
    const ip = (raw ?? "").trim();
    if (!ip) continue;
    if (!out.includes(ip)) out.push(ip);
    if (out.length >= limit) break;
  }
  return out;
}

export function deviceHintFromUa(ua: string | null | undefined): string | null {
  const s = (ua ?? "").trim();
  if (!s) return null;
  if (/iPhone|iPad/i.test(s)) return "iPhone / iPad";
  if (/Android/i.test(s)) return "Android";
  if (/Mac OS X|Macintosh/i.test(s)) return "Mac";
  if (/Windows/i.test(s)) return "Windows";
  if (/Linux/i.test(s)) return "Linux";
  return "Other";
}

export function shapeFromLatestEvent(events: MachActivityEvent[]): MachActivityShape | null {
  const hit = events.find(
    (ev) =>
      (ev.action === "calculate" || ev.action === "plan_save") &&
      ev.detail &&
      typeof ev.detail === "object",
  );
  if (!hit) return null;
  const d = hit.detail;
  const n = (key: string) => {
    const v = Number(d[key]);
    return Number.isFinite(v) ? v : 0;
  };
  return {
    accounts: n("accounts"),
    incomes: n("incomes"),
    contributions: n("contributions"),
    spending: n("spending"),
    liabilities: n("liabilities"),
    profiles: n("profiles") || 1,
    familyPeople: n("familyPeople"),
    stages: n("stages"),
    mortgages: n("mortgages"),
  };
}
