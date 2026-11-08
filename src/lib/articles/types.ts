export type ArticleRecord = {
  slug: string;
  pageTitle: string;
  h1: string;
  /** Optional line under the H1. Blank shows nothing. */
  subtitle: string;
  body: string;
  /** ISO timestamp. Set when the row is created. A later edit does not change it. */
  createdAt: string;
};
