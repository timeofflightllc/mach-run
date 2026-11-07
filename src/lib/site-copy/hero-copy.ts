import type { SiteCopy } from "./types";

/** Desk-editable homepage hero. Buttons stay in code. */
export type HeroCopy = {
  headline: string;
  text: string;
};

export const DEFAULT_HERO_COPY: HeroCopy = {
  headline:
    "See your entire household's retirement on one page, from active duty, spouse pay and TSP contributions to VA benefits, retirement date and the nest-egg goal.",
  text: "Plan for pay increases at a promotion, yearly NDAA's, and planned COLA. Change the savings rate and contributions, and watch that date and FIRE number move.\nFree to start — 2 incomes, 2 accounts, 2 contributions.  $4 a month gets you more.",
};

const STALE_HEADLINES = new Set([
  "Years to your FIRE number, with TSP, military retired pay, and VA.",
  "One place to see your whole household's retirement - income, TSP, military retired pay, VA, and your nest-egg goal.",
  "One place to see your whole household's retirement. Pay steps up with a promotion and a COLA, plus TSP, military retired pay, VA, and your nest-egg goal.",
  "One place to see your entire household's retirement picture. Pay rises with a promotion and a COLA. TSP, military retired pay, VA, and the nest-egg goal are on the same page.",
  "One place to see your entire household's finances on one page. Custom income stages for promotion and a COLA. TSP, military retired pay, VA, and the nest-egg goal.",
]);
const STALE_TEXT = [
  "See your whole household's retirement in one place - income, investments, and your nest-egg goal, with unlimited what-if runs. Free to start. $4 a month unlocks incredible features.",
  "Change the savings rate and watch that date move. Free to start. $4 a month.",
  "Change the savings rate and contributions, and watch that date and FIRE number move. Free to start. $4 a month gets you more.",
  "Plan for pay increases at a promotion and with a planned COLA. Change the savings rate and contributions, and watch that date and FIRE number move. Free to start. $4 a month gets you more.",
  "Plan for pay increases at a promotion, yearly NDAA's, and planned COLA. Change the savings rate and contributions, and watch that date and FIRE number move. Free to start. $4 a month gets you more.",
];

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
    typeof src.headline === "string" && !STALE_HEADLINES.has(src.headline.trim())
      ? src.headline
      : DEFAULT_HERO_COPY.headline;
  const textRaw = typeof src.text === "string" ? src.text : "";
  const refreshed = textRaw
    .replaceAll(
      "Free to start. $4 a month gets you more.",
      "Free to start — 2 incomes, 2 accounts, 2 contributions.  $4 a month gets you more.",
    )
    .replace(/move\.\s+Free to start/g, "move.\nFree to start");
  const text =
    refreshed.trim() && !STALE_TEXT.includes(refreshed.trim())
      ? refreshed
      : DEFAULT_HERO_COPY.text;
  return { headline, text };
}

export function heroFromSiteCopy(site: SiteCopy): HeroCopy {
  const page = site.pages.find((row) => row.slug === "hero");
  if (!page) return { ...DEFAULT_HERO_COPY };
  return parseHeroCopy(page.body);
}
