import type { SiteCopy } from "./types";

/** Starter lines. Real Boyd remarks. The desk can replace every one of them. */
export const DEFAULT_BOYD_QUOTES = [
  "People, ideas, and hardware — in that order.",
  "Terrain doesn't fight wars. Machines don't fight wars. People do. And they use their minds.",
  "If your boss demands loyalty, give him integrity. But if he demands integrity, then give him loyalty.",
  "You gotta challenge all assumptions. If you don't, what is doctrine on day one becomes dogma forever after.",
];

export function parseBoydQuotes(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Empty body means the desk cleared the list. Do not invent a stand-in. */
export function boydQuotesFromSiteCopy(site: SiteCopy): string[] {
  const page = site.pages.find((row) => row.slug === "boyd");
  if (!page) return DEFAULT_BOYD_QUOTES;
  return parseBoydQuotes(page.body);
}
