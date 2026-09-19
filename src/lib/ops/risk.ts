export type RiskGrade = "A" | "B" | "C" | "D" | "F";

export type RiskInput = {
  email: string | null;
  emailVerified: boolean | null;
  name: string | null;
  createdAt: string | null;
  authHint: string;
  paid: boolean;
  isComp: boolean;
  calculateCount: number;
  loginCount: number;
  pdfCount: number;
  backupCount: number;
  planPresent: boolean;
  lastIps: string[];
  userAgents: string[];
  /** Other MACH RUN users who share at least one of this person's IPs. */
  sharedIpUsers: number;
  now?: number;
};

export type RiskResult = {
  grade: RiskGrade;
  score: number;
  label: string;
  reasons: string[];
};

export const RISK_GRADE_CLASS: Record<RiskGrade, string> = {
  A: "text-[#5ecf6a]",
  B: "text-[#5aa8ee]",
  C: "text-[#e6c86e]",
  D: "text-[#e08a4a]",
  F: "text-[#e07070]",
};

export const EMPTY_RISK: RiskResult = {
  grade: "C",
  score: 40,
  label: "Not enough signal",
  reasons: ["Not enough history to grade."],
};

const DISPOSABLE_DOMAINS = new Set(
  [
    "mailinator.com",
    "guerrillamail.com",
    "guerrillamail.net",
    "sharklasers.com",
    "grr.la",
    "10minutemail.com",
    "tempmail.com",
    "temp-mail.org",
    "trashmail.com",
    "yopmail.com",
    "getnada.com",
    "discard.email",
    "mailnesia.com",
    "maildrop.cc",
    "fakeinbox.com",
    "throwawaymail.com",
    "moakt.com",
    "emailondeck.com",
    "inboxkitten.com",
    "tempail.com",
  ].map((d) => d.toLowerCase()),
);

const TRUSTED_DOMAINS = new Set(
  [
    "gmail.com",
    "googlemail.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "msn.com",
    "yahoo.com",
    "ymail.com",
    "proton.me",
    "protonmail.com",
    "aol.com",
    "comcast.net",
    "att.net",
    "verizon.net",
    "sbcglobal.net",
  ].map((d) => d.toLowerCase()),
);

const BOT_UA =
  /bot\b|crawler|spider|scrapy|curl\/|wget|python-requests|httpclient|go-http|headless|phantom|selenium|puppeteer|playwright|axios\/|node-fetch|libwww/i;

export function gradeFromScore(score: number): RiskGrade {
  const n = Math.max(0, Math.min(100, Math.round(score)));
  if (n <= 19) return "A";
  if (n <= 39) return "B";
  if (n <= 59) return "C";
  if (n <= 79) return "D";
  return "F";
}

export function labelForGrade(grade: RiskGrade): string {
  if (grade === "A") return "Looks like a real household";
  if (grade === "B") return "Probably fine";
  if (grade === "C") return "Not enough signal — keep an eye on it";
  if (grade === "D") return "Spam / bot pattern";
  return "Likely automated or hostile";
}

export function isPublicIp(ip: string): boolean {
  const t = ip.trim();
  if (!t) return false;
  if (t === "127.0.0.1" || t === "::1" || t === "0.0.0.0") return false;
  if (/^10\./.test(t)) return false;
  if (/^192\.168\./.test(t)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(t)) return false;
  if (/^fc/i.test(t) || /^fd/i.test(t) || /^fe80:/i.test(t)) return false;
  return true;
}

export function looksGeneratedLocal(local: string): boolean {
  const s = local.replace(/[.+_-]/g, "");
  if (s.length < 10) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(local)) return true;
  if (s.length >= 16 && /^[0-9a-f]+$/i.test(s) && (s.match(/\d/g)?.length ?? 0) >= 4) return true;
  const letters = s.replace(/[^a-z]/gi, "");
  const vowels = letters.replace(/[^aeiou]/gi, "").length;
  if (letters.length >= 14 && vowels / Math.max(1, letters.length) < 0.15) return true;
  if (/^[a-z]*\d{6,}[a-z0-9]*$/i.test(s) && s.length >= 12) return true;
  if (/^[a-z0-9]{22,}$/i.test(s)) return true;
  return false;
}

function oauthHint(authHint: string): boolean {
  const h = authHint.toLowerCase();
  return h.includes("apple") || h.includes("google") || h.includes("x") || h.includes("twitter");
}

export function scoreBotRisk(input: RiskInput): RiskResult {
  const reasons: string[] = [];
  let score = 38;
  const now = input.now ?? Date.now();
  const created = input.createdAt ? new Date(input.createdAt).getTime() : NaN;
  const ageHours = Number.isFinite(created) ? (now - created) / 3_600_000 : null;
  const email = (input.email ?? "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  const local = at > 0 ? email.slice(0, at) : "";
  const domain = at > 0 ? email.slice(at + 1) : "";
  const calculates = Math.max(0, input.calculateCount || 0);
  const logins = Math.max(0, input.loginCount || 0);
  const usage =
    calculates +
    Math.max(0, input.pdfCount || 0) +
    Math.max(0, input.backupCount || 0) +
    (input.planPresent ? 1 : 0);

  if (input.paid) {
    score -= 28;
    reasons.push("Paid or trialing seat.");
  }
  if (input.isComp) {
    score -= 18;
    reasons.push("Comp seat from the desk.");
  }
  if (oauthHint(input.authHint)) {
    score -= 14;
    reasons.push("Signed in with Apple, Google, or X.");
  }
  if (input.emailVerified) {
    score -= 10;
    reasons.push("Email is verified.");
  }
  if (TRUSTED_DOMAINS.has(domain) || domain.endsWith(".mil") || domain.endsWith(".gov")) {
    score -= 8;
    reasons.push("Ordinary consumer or .mil/.gov mailbox.");
  }
  if (calculates >= 1) {
    score -= 22;
    reasons.push("Has at least one MACH Run.");
  } else if (input.planPresent) {
    score -= 10;
    reasons.push("Saved a plan, no Calculate yet.");
  }
  if (calculates >= 3) {
    score -= 6;
    reasons.push("Several MACH Runs.");
  }
  if (ageHours != null && ageHours > 24 * 14 && usage > 0) {
    score -= 8;
    reasons.push("Account older than two weeks with real use.");
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    score += 42;
    reasons.push("Disposable / throwaway email domain.");
  }
  if (looksGeneratedLocal(local)) {
    score += 16;
    reasons.push("Mailbox name looks generated.");
  }
  if (!email) {
    score += 12;
    reasons.push("No email on the account.");
  }
  if (input.emailVerified === false && !oauthHint(input.authHint)) {
    score += 14;
    reasons.push("Unverified email/password login.");
  }
  const name = (input.name ?? "").trim();
  if (!name) {
    score += 6;
    reasons.push("No display name.");
  }
  const botUa = (input.userAgents ?? []).some((ua) => BOT_UA.test(ua));
  if (botUa) {
    score += 36;
    reasons.push("A session user-agent looks automated.");
  }
  const publicIps = (input.lastIps ?? []).filter(isPublicIp);
  if (input.sharedIpUsers >= 5) {
    score += 32;
    reasons.push(`Same public IP as ${input.sharedIpUsers} other users.`);
  } else if (input.sharedIpUsers >= 3) {
    score += 20;
    reasons.push(`Same public IP as ${input.sharedIpUsers} other users.`);
  } else if (input.sharedIpUsers >= 2) {
    score += 8;
    reasons.push(`Same public IP as ${input.sharedIpUsers} other users.`);
  }
  if (logins >= 12 && calculates === 0 && !input.planPresent) {
    score += 22;
    reasons.push("Many sign-ins, zero MACH Runs or saved plan.");
  }
  if (ageHours != null && ageHours > 72 && usage === 0 && logins <= 1) {
    score += 6;
    reasons.push("Days old with almost no use.");
  }
  if (ageHours != null && ageHours < 2 && input.emailVerified === false && !oauthHint(input.authHint)) {
    score += 10;
    reasons.push("Brand-new unverified email account.");
  }
  if (publicIps.length === 0 && ageHours != null && ageHours > 24 && logins === 0) {
    score += 4;
    reasons.push("No public IP on file.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = gradeFromScore(score);
  const unique = [...new Set(reasons)];
  if (unique.length === 0) unique.push("Default unknown until they use the product.");
  return {
    grade,
    score,
    label: labelForGrade(grade),
    reasons: unique.slice(0, 8),
  };
}
