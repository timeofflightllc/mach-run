import { getSql } from "@/lib/db";
import { isPublicIp } from "./risk";

export type RiskSignals = {
  emailVerified: boolean | null;
  calculateCount: number;
  loginCount: number;
  pdfCount: number;
  backupCount: number;
  planPresent: boolean;
  lastIps: string[];
  userAgents: string[];
  sharedIpUsers: number;
};

const EMPTY_SIGNALS: RiskSignals = {
  emailVerified: null,
  calculateCount: 0,
  loginCount: 0,
  pdfCount: 0,
  backupCount: 0,
  planPresent: false,
  lastIps: [],
  userAgents: [],
  sharedIpUsers: 0,
};

export async function loadRiskSignalsByUser(): Promise<Map<string, RiskSignals>> {
  const out = new Map<string, RiskSignals>();
  const ensure = (id: string): RiskSignals => {
    let row = out.get(id);
    if (!row) {
      row = { ...EMPTY_SIGNALS, lastIps: [], userAgents: [] };
      out.set(id, row);
    }
    return row;
  };

  try {
    const sql = await getSql();
    try {
      const users = await sql.query<{ id: string; emailVerified: boolean | null }>(
        `select id, "emailVerified" as "emailVerified" from "user"`,
      );
      for (const row of users) {
        ensure(row.id).emailVerified = row.emailVerified == null ? null : Boolean(row.emailVerified);
      }
    } catch {
      /* emailVerified optional */
    }

    try {
      const acts = await sql.query<{ user_id: string; action: string; n: number | string }>(
        `select user_id, action, count(*)::int as n
           from mach_user_activity
          where action in ('calculate', 'login', 'pdf', 'backup_download')
          group by user_id, action`,
      );
      for (const row of acts) {
        const sig = ensure(row.user_id);
        const n = Number(row.n) || 0;
        if (row.action === "calculate") sig.calculateCount = n;
        if (row.action === "login") sig.loginCount = n;
        if (row.action === "pdf") sig.pdfCount = n;
        if (row.action === "backup_download") sig.backupCount = n;
      }
    } catch {
      /* activity optional */
    }

    try {
      const plans = await sql.query<{ user_id: string }>(
        `select user_id from mach_plans`,
      );
      for (const row of plans) ensure(row.user_id).planPresent = true;
    } catch {
      /* plans optional */
    }

    try {
      const sessions = await sql.query<{
        userId: string;
        ipAddress: string | null;
        userAgent: string | null;
      }>(
        `select "userId" as "userId", "ipAddress" as "ipAddress", "userAgent" as "userAgent"
           from "session"
          order by "updatedAt" desc`,
      );
      const ipUsers = new Map<string, Set<string>>();
      for (const row of sessions) {
        const sig = ensure(row.userId);
        const ip = (row.ipAddress ?? "").trim();
        if (ip && isPublicIp(ip) && !sig.lastIps.includes(ip) && sig.lastIps.length < 8) {
          sig.lastIps.push(ip);
        }
        const ua = (row.userAgent ?? "").trim();
        if (ua && !sig.userAgents.includes(ua) && sig.userAgents.length < 6) {
          sig.userAgents.push(ua);
        }
        if (ip && isPublicIp(ip)) {
          const set = ipUsers.get(ip) ?? new Set<string>();
          set.add(row.userId);
          ipUsers.set(ip, set);
        }
      }
      for (const [, sig] of out) {
        let maxOthers = 0;
        for (const ip of sig.lastIps) {
          const n = (ipUsers.get(ip)?.size ?? 1) - 1;
          if (n > maxOthers) maxOthers = n;
        }
        sig.sharedIpUsers = maxOthers;
      }
    } catch {
      /* session optional */
    }
  } catch {
    return out;
  }
  return out;
}
