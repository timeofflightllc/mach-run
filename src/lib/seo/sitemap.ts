import type { SitePageSlug } from "@/lib/site-copy/types";

/** Public pages. sourceLastmod is the last commit of that route, not a build clock. */
export const SITEMAP_PAGES: {
  path: string;
  sourceLastmod: string;
  slugs: readonly SitePageSlug[];
}[] = [
  { path: "/", sourceLastmod: "2026-10-10T08:20:17+00:00", slugs: ["hero", "footer", "planner", "boyd"] },
  { path: "/pricing", sourceLastmod: "2026-10-10T16:31:31+00:00", slugs: ["pricing", "footer"] },
  { path: "/about", sourceLastmod: "2026-10-10T16:31:31+00:00", slugs: ["about", "footer"] },
  { path: "/learn", sourceLastmod: "2026-10-10T16:31:31+00:00", slugs: ["footer"] },
  { path: "/method", sourceLastmod: "2026-10-10T16:31:31+00:00", slugs: ["method", "footer"] },
  { path: "/faq", sourceLastmod: "2026-10-10T16:31:31+00:00", slugs: ["faq", "footer"] },
  { path: "/contact", sourceLastmod: "2026-10-10T16:31:31+00:00", slugs: ["contact", "footer"] },
  { path: "/announcements", sourceLastmod: "2026-10-10T16:31:31+00:00", slugs: ["announcements", "footer"] },
  { path: "/legal", sourceLastmod: "2026-10-10T16:31:31+00:00", slugs: ["legal", "footer"] },
  { path: "/privacy", sourceLastmod: "2026-10-10T16:31:31+00:00", slugs: ["privacy", "footer"] },
];

export const INDEXNOW_KEY = "dd056b52eef5874ae8a4d0f7c7acb0fa";
export const INDEXNOW_HOST = "machrun.com";

const SITE = `https://${INDEXNOW_HOST}`;

export function pathsForSlug(slug: string): string[] {
  return SITEMAP_PAGES.filter((page) => (page.slugs as readonly string[]).includes(slug)).map(
    (page) => page.path,
  );
}

export function absoluteUrl(path: string): string {
  return path === "/" ? `${SITE}/` : `${SITE}${path}`;
}

/** Latest real date. Empty or unparseable values are ignored. Never invents "now". */
export function latestDay(dates: string[]): string {
  let best = Number.NEGATIVE_INFINITY;
  for (const date of dates) {
    const ms = Date.parse(date);
    if (Number.isFinite(ms) && ms > best) best = ms;
  }
  if (!Number.isFinite(best)) return "";
  return new Date(best).toISOString().slice(0, 10);
}

export function buildSitemapXml(recordDates: Record<string, string[]> = {}): string {
  const urls = SITEMAP_PAGES.map((page) => {
    const lastmod = latestDay([page.sourceLastmod, ...(recordDates[page.path] ?? [])]);
    return `  <url><loc>${absoluteUrl(page.path)}</loc><lastmod>${lastmod}</lastmod></url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export async function pingIndexNow(paths: string[]): Promise<void> {
  const urlList = [...new Set(paths.filter(Boolean))].map(absoluteUrl);
  if (!urlList.length) return;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    /* A failed ping must not block the save or the build. */
  }
}
