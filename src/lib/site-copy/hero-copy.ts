import type { SiteCopy } from "./types";

/** Desk-editable homepage hero. Buttons stay in code. */
export type HeroCopy = {
  headline: string;
  text: string;
};

export const DEFAULT_HERO_COPY: HeroCopy = {
  headline:
    "One place to see your whole household's retirement - income, TSP, military retired pay, VA, and your nest-egg goal.",
  text: "Change the savings rate and watch that date move. Free to start. $4 a month.",
};

const STALE_HEADLINE = "Years to your FIRE number, with TSP, military retired pay, and VA.";
const STALE_TEXT =
  "See your whole household's retirement in one place - income, investments, and your nest-egg goal, with unlimited what-if runs. Free to start. $4 a month unlocks incredible features.";

export function serializeHeroCopy(copy: HeroCopy): string {
  return JSON.stringify(copy);
}

export function parseHeroCopy(raw: string): HeroCopy {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_HERO_COPY };
  }
  const src = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const headline =
    typeof src.headline === "string" && src.headline.trim() !== STALE_HEADLINE
      ? src.headline
      : DEFAULT_HERO_COPY.headline;
  const text =
    typeof src.text === "string" && src.text.trim() !== STALE_TEXT
      ? src.text
      : DEFAULT_HERO_COPY.text;
  return { headline, text };
}

export function heroFromSiteCopy(site: SiteCopy): HeroCopy {
  const page = site.pages.find((row) => row.slug === "hero");
  if (!page) return { ...DEFAULT_HERO_COPY };
  return parseHeroCopy(page.body);
}
