/** What counts as a page that failed, and how not to mail the same one twice. */

export type SiteErrorKind = "route" | "error" | "rejection" | "blank";

export type SiteErrorReport = {
  kind: SiteErrorKind;
  message: string;
  stack: string;
  path: string;
  href: string;
};

const KINDS = new Set<SiteErrorKind>(["route", "error", "rejection", "blank"]);

function clip(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function clipBlock(value: unknown, max: number): string {
  return String(value ?? "").replace(/\r/g, "").trim().slice(0, max);
}

export function parseSiteError(body: unknown): SiteErrorReport | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  if (typeof raw.company === "string" && raw.company.trim()) return null;
  const kind = raw.kind;
  if (typeof kind !== "string" || !KINDS.has(kind as SiteErrorKind)) return null;
  const message = clip(raw.message, 500);
  if (!message) return null;
  return {
    kind: kind as SiteErrorKind,
    message,
    stack: clipBlock(raw.stack, 4000),
    path: clip(raw.path, 200) || "/",
    href: clip(raw.href, 300),
  };
}

export function ignoreSiteError(report: SiteErrorReport): boolean {
  const message = report.message;
  const stack = report.stack;
  if (/resizeobserver loop/i.test(message)) return true;
  if (message === "Script error.") return true;
  if (/^AbortError\b/.test(message)) return true;
  if (/aborted a request|signal is aborted|The operation was aborted/i.test(message)) return true;
  if (/^(Failed to fetch|Load failed|Network request failed)$/i.test(message)) return true;
  if (/^NetworkError when attempting to fetch resource\.?$/i.test(message)) return true;
  if (/chrome-extension:|moz-extension:|safari-extension:/i.test(stack)) return true;
  if (report.path === "/api/site-error") return true;
  return false;
}

export function siteErrorKey(report: SiteErrorReport): string {
  return `${report.kind}|${report.path}|${report.message.slice(0, 180)}`;
}

export function shouldSendSiteError(
  seen: Map<string, number>,
  key: string,
  now: number,
  windowMs: number,
): boolean {
  const last = seen.get(key);
  if (last != null && now - last < windowMs) return false;
  seen.set(key, now);
  return true;
}
