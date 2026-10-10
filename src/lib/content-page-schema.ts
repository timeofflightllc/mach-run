const SITE = "https://machrun.com";

type JsonLd = Record<string, unknown>;

/** First and last source commit. Not a build clock. */
const CONTENT_DATES: Record<string, { published: string; modified: string }> = {
  "/about": { published: "2026-09-07", modified: "2026-10-10" },
  "/method": { published: "2026-08-27", modified: "2026-10-10" },
  "/faq": { published: "2026-08-27", modified: "2026-10-10" },
  "/contact": { published: "2026-09-07", modified: "2026-10-10" },
  "/announcements": { published: "2026-09-07", modified: "2026-10-10" },
  "/learn": { published: "2026-10-10", modified: "2026-10-10" },
  "/legal": { published: "2026-08-27", modified: "2026-10-10" },
  "/privacy": { published: "2026-08-27", modified: "2026-10-10" },
};

/** One block per content page. headline is the document title passed in. */
export function contentPageSchema(title: string, path: string): JsonLd | null {
  const dates = CONTENT_DATES[path];
  if (!dates) return null;
  const url = `${SITE}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    url,
    mainEntityOfPage: url,
    image: `${SITE}/brand/mach-run-logo.jpg?v=23`,
    author: { "@type": "Organization", name: "MACH RUN", url: SITE },
    datePublished: dates.published,
    dateModified: dates.modified,
  };
}
