import {
  ignoreSiteError,
  shouldSendSiteError,
  siteErrorKey,
  type SiteErrorReport,
} from "./site-error";

const WINDOW_MS = 20 * 60 * 1000;
const BURST_MS = 10 * 60 * 1000;
const BURST_MAX = 8;

const seen = new Map<string, number>();
let burst: number[] = [];

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

const KIND_LABEL: Record<SiteErrorReport["kind"], string> = {
  route: "A page failed to render",
  error: "An uncaught script error",
  rejection: "An unhandled promise rejection",
  blank: "A page stayed blank",
};

export function allowSiteErrorMail(report: SiteErrorReport, now = Date.now()): boolean {
  if (ignoreSiteError(report)) return false;
  burst = burst.filter((at) => now - at < BURST_MS);
  if (burst.length >= BURST_MAX) return false;
  if (!shouldSendSiteError(seen, siteErrorKey(report), now, WINDOW_MS)) return false;
  burst.push(now);
  return true;
}

export async function sendSiteErrorMail(
  report: SiteErrorReport,
  extra: { userAgent: string },
): Promise<{ ok: true; skipped?: false } | { ok: true; skipped: true } | { ok: false; reason: string }> {
  if (!allowSiteErrorMail(report)) return { ok: true, skipped: true };
  const key = env("RESEND_API_KEY");
  if (!key) return { ok: false, reason: "Mail is not connected yet." };

  const when = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  });
  const label = KIND_LABEL[report.kind];
  const subject = `MACH RUN error — ${report.message.slice(0, 80)}`;
  const lines = [
    label + ".",
    "",
    `When: ${when} CT`,
    `Page: ${report.href || report.path}`,
    `Path: ${report.path}`,
    `Kind: ${report.kind}`,
    "",
    report.message,
    "",
    report.stack || "(no stack)",
    "",
    extra.userAgent ? `Browser: ${extra.userAgent.slice(0, 300)}` : "",
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "");
  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1E2A32;">
    <p><strong>${escapeHtml(label)}.</strong></p>
    <p>When: ${escapeHtml(when)} CT<br />
    Page: ${escapeHtml(report.href || report.path)}<br />
    Path: ${escapeHtml(report.path)}</p>
    <p>${escapeHtml(report.message)}</p>
    <pre style="white-space:pre-wrap;font-size:12px;color:#3D4A54;">${escapeHtml(report.stack || "(no stack)")}</pre>
    <p style="font-size:12px;color:#5D6C78;">${escapeHtml(extra.userAgent.slice(0, 300))}</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env("MACH_NOTIFY_FROM") || "MACH RUN <matt@machrun.com>",
        to: ["cain@machrun.com"],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) return { ok: false, reason: "Could not send." };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not reach mail." };
  }
}
