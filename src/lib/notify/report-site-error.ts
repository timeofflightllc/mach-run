import type { SiteErrorKind } from "./site-error";

const sent = new Set<string>();

export function reportSiteError(input: {
  kind: SiteErrorKind;
  message: string;
  stack?: string;
}): void {
  if (typeof window === "undefined") return;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return;
  const message = input.message.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!message) return;
  const path = window.location.pathname || "/";
  const key = `${input.kind}|${path}|${message.slice(0, 180)}`;
  if (sent.has(key)) return;
  sent.add(key);
  const body = JSON.stringify({
    kind: input.kind,
    message,
    stack: (input.stack ?? "").slice(0, 4000),
    path,
    href: window.location.href.slice(0, 300),
  });
  try {
    void fetch("/api/site-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* a failed report must not create another error */
  }
}
