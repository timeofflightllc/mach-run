export const SITE_PAGE_SLUGS = ["about", "contact", "privacy", "announcements"] as const;
export type SitePageSlug = (typeof SITE_PAGE_SLUGS)[number];

export type SitePage = {
  slug: SitePageSlug;
  title: string;
  kicker: string;
  body: string;
};

export type SiteAnnouncement = {
  id: string;
  at: string;
  title: string;
  blurb: string;
  sortOrder: number;
};

export type SiteCopy = {
  pages: SitePage[];
  announcements: SiteAnnouncement[];
};
