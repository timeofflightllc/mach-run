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
