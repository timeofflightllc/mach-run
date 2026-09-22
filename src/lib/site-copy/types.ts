export const SITE_PAGE_SLUGS = [
  "about",
  "contact",
  "privacy",
  "announcements",
  "pricing",
] as const;
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

export type PricingCardCopy = {
  tag: string;
  bullets: string[];
};

/** Desk-editable /pricing strings. Prices and SKU titles stay in code. */
export type PricingCopy = {
  heroH1: string;
  heroSub: string;
  personalP1: string;
  personalP2: string;
  personalP3: string;
  advisorP1: string;
  advisorP2: string;
  couponLabel: string;
  intervalNoteMonth: string;
  intervalNoteYear: string;
  intervalNoteAdvisorMonth: string;
  freeAdvisorBullet: string;
  advisorLiteTagYear: string;
  advisorUnlimitedTagYear: string;
  free: PricingCardCopy;
  individual: PricingCardCopy;
  unlimited: PricingCardCopy;
  advisorLite: PricingCardCopy;
  advisorUnlimited: PricingCardCopy;
};

export type SiteCopy = {
  pages: SitePage[];
  announcements: SiteAnnouncement[];
};
