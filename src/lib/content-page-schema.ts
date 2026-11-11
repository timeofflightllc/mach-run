const SITE = "https://machrun.com";

type JsonLd = Record<string, unknown>;

/** First and last source commit. Not a build clock. */
const CONTENT_DATES: Record<string, { published: string; modified: string }> = {
  "/about": { published: "2026-09-07", modified: "2026-10-10" },
  "/method": { published: "2026-08-27", modified: "2026-10-10" },
  "/faq": { published: "2026-08-27", modified: "2026-10-10" },
  "/compare": { published: "2026-10-11", modified: "2026-10-11" },
  "/contact": { published: "2026-09-07", modified: "2026-10-10" },
  "/announcements": { published: "2026-09-07", modified: "2026-10-10" },
  "/learn": { published: "2026-10-10", modified: "2026-10-24" },
  "/tools": { published: "2026-10-24", modified: "2026-10-24" },
  "/legal": { published: "2026-08-27", modified: "2026-10-24" },
  "/privacy": { published: "2026-08-27", modified: "2026-10-10" },
  "/military-pension-present-value": { published: "2026-11-07", modified: "2026-11-07" },
};

/** One block per content page. headline is the document title passed in. */
const WEBPAGE_PATHS = new Set(["/contact", "/tools", "/learn", "/legal", "/privacy"]);

export function contentPageSchema(title: string, path: string): JsonLd | null {
  const dates = CONTENT_DATES[path];
  if (!dates) return null;
  const url = `${SITE}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": WEBPAGE_PATHS.has(path) ? "WebPage" : "Article",
    headline: title,
    url,
    mainEntityOfPage: url,
    image: `${SITE}/og.jpg?v=26`,
    author: {
      "@type": "Person",
      "@id": `${SITE}/about#matthew-cain-olde`,
      name: "Matthew \"Cain\" Olde",
      url: `${SITE}/about`,
      jobTitle: "Founder, MACH RUN",
      sameAs: ["https://www.linkedin.com/in/cainf-15advanced/"],
      worksFor: { "@type": "Organization", name: "MACH RUN", url: SITE },
    },
    datePublished: dates.published,
    dateModified: dates.modified,
  };
}
