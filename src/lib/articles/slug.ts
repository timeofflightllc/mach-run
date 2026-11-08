/** Lowercase letters, numbers, and hyphens. No leading, trailing, or doubled hyphen. */
export const ARTICLE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** First segment of a real site path. An article cannot take one of these. */
export const RESERVED_ARTICLE_SLUGS = new Set([
  "about",
  "account",
  "announcements",
  "api",
  "beta",
  "compare",
  "contact",
  "faq",
  "learn",
  "legal",
  "login",
  "method",
  "military-pension-present-value",
  "pricing",
  "privacy",
  "referrals",
  "retired-pay",
  "start",
  "tools",
  "top-3-desk",
  "verify-email",
]);

export function articleSlugError(slug: string, taken: boolean): string | null {
  if (!ARTICLE_SLUG_RE.test(slug)) return "Use lowercase letters, numbers, and hyphens.";
  if (RESERVED_ARTICLE_SLUGS.has(slug)) return "That slug is already a site path.";
  if (taken) return "That slug is already used.";
  return null;
}

export function articleFieldsError(pageTitle: string, h1: string, body: string): string | null {
  if (!pageTitle.trim() || !h1.trim() || !body.trim()) {
    return "Page title, H1, and body are required.";
  }
  return null;
}

const ARTICLE_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day, or an error. A blank day is an error. */
export function articleDateError(day: string): string | null {
  const match = ARTICLE_DAY_RE.exec(day);
  if (!match) return "Use a real date, YYYY-MM-DD.";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, date));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== date) {
    return "Use a real date, YYYY-MM-DD.";
  }
  return null;
}

/** Noon UTC, so the byline day cannot slip. */
export function articleNoonUtc(day: string): string {
  return `${day}T12:00:00.000Z`;
}

export function todayUtcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The UTC calendar day of a stored timestamp. */
export function articleDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
