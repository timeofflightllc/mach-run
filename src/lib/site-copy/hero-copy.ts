import type { SiteCopy } from "./types";

/** Desk-editable homepage. Each field is one line on the page. */
export type HeroCopy = {
  headline: string;
  text: string;
  pitch: string;
  startButton: string;
  noCard: string;
  ownButton: string;
  ownNote: string;
  demoButton: string;
  demoNote: string;
  replaceWarn: string;
  replaceButton: string;
  cancelButton: string;
  problemKicker: string;
  problemTitle: string;
  problemBody: string;
  frustrationKicker: string;
  frustrationTitle: string;
  frustrationBody: string;
  solutionKicker: string;
  solutionTitle: string;
  solutionBody: string;
  militaryEyebrow: string;
  militaryTitle: string;
  militaryBody: string;
  sampleLabel: string;
  sampleAmount: string;
  sampleNote: string;
  milLabel: string;
  milAmount: string;
  milValue: string;
  milKicker: string;
  milNote: string;
  milExtra: string;
  vaLabel: string;
  vaAmount: string;
  vaValue: string;
  vaKicker: string;
  vaNote: string;
  vaExtra: string;
  tspLabel: string;
  tspAmount: string;
  tspValue: string;
  tspKicker: string;
  tspNote: string;
  sampleMonth: string;
  sampleFoot: string;
  processKicker: string;
  processPrompt: string;
  observeTitle: string;
  observeBody: string;
  observeLine: string;
  orientTitle: string;
  orientBody: string;
  orientLine: string;
  decideTitle: string;
  decideBody: string;
  decideLine: string;
  actTitle: string;
  actBody: string;
  actLine: string;
  outcomeKicker: string;
  outcomeTitle: string;
  outcomeBody: string;
  haleTitle: string;
  haleBody: string;
  scenarioBaseTitle: string;
  scenarioBaseBody: string;
  scenarioSaveTitle: string;
  scenarioSaveBody: string;
  scenarioLaterTitle: string;
  scenarioLaterBody: string;
  blufLabel: string;
  blufBaseHeadline: string;
  blufBaseBody: string;
  blufSaveHeadline: string;
  blufSaveBody: string;
  blufLaterHeadline: string;
  blufLaterBody: string;
  haleDisclaimer: string;
  citation: string;
  citationSource: string;
  inviteKicker: string;
  inviteTitle: string;
  inviteBody: string;
  founderTitle: string;
  founderBody: string;
  founderLink: string;
  cautionLabel: string;
  cautionBody: string;
  cautionLink: string;
  clearDemo: string;
  startLabel: string;
  emptyTitle: string;
  emptyLine: string;
  emptyBody: string;
};

export const HERO_SECTIONS: {
  title: string;
  fields: { key: keyof HeroCopy; label: string; rows?: number }[];
}[] = [
  {
    title: "Top of the page",
    fields: [
      { key: "headline", label: "Headline", rows: 3 },
      { key: "text", label: "Line under the headline", rows: 4 },
      { key: "pitch", label: "Short pitch", rows: 2 },
      { key: "startButton", label: "Six-questions button" },
      { key: "noCard", label: "Under the six-questions button" },
      { key: "ownButton", label: "Start a MACH RUN button", rows: 2 },
      { key: "ownNote", label: "Under Start a MACH RUN", rows: 2 },
      { key: "demoButton", label: "Hale demo button" },
      { key: "demoNote", label: "Under the Hale demo button", rows: 2 },
      { key: "replaceWarn", label: "Replace-demo warning", rows: 2 },
      { key: "replaceButton", label: "Replace-demo button" },
      { key: "cancelButton", label: "Cancel" },
    ],
  },
  {
    title: "1 · The problem",
    fields: [
      { key: "problemKicker", label: "Section label" },
      { key: "problemTitle", label: "Title", rows: 2 },
      { key: "problemBody", label: "Body", rows: 3 },
    ],
  },
  {
    title: "2 · The frustration",
    fields: [
      { key: "frustrationKicker", label: "Section label" },
      { key: "frustrationTitle", label: "Title", rows: 2 },
      { key: "frustrationBody", label: "Body", rows: 3 },
    ],
  },
  {
    title: "3 · The solution",
    fields: [
      { key: "solutionKicker", label: "Section label" },
      { key: "solutionTitle", label: "Title", rows: 2 },
      { key: "solutionBody", label: "Body", rows: 3 },
    ],
  },
  {
    title: "Military strip",
    fields: [
      { key: "militaryEyebrow", label: "Green line" },
      { key: "militaryTitle", label: "Title", rows: 2 },
      { key: "militaryBody", label: "Body. A new line is a line break.", rows: 3 },
    ],
  },
  {
    title: "Sample blend",
    fields: [
      { key: "sampleLabel", label: "Card label" },
      { key: "sampleAmount", label: "Big number" },
      { key: "sampleNote", label: "Line under the number", rows: 2 },
      { key: "milLabel", label: "Military card name" },
      { key: "milAmount", label: "Military monthly amount" },
      { key: "milValue", label: "Military present value" },
      { key: "milKicker", label: "Military hover label" },
      { key: "milNote", label: "Military hover line", rows: 2 },
      { key: "milExtra", label: "Military small print", rows: 3 },
      { key: "vaLabel", label: "VA card name" },
      { key: "vaAmount", label: "VA monthly amount" },
      { key: "vaValue", label: "VA present value" },
      { key: "vaKicker", label: "VA hover label" },
      { key: "vaNote", label: "VA hover line", rows: 2 },
      { key: "vaExtra", label: "VA small print", rows: 3 },
      { key: "tspLabel", label: "TSP card name" },
      { key: "tspAmount", label: "TSP monthly amount" },
      { key: "tspValue", label: "TSP balance" },
      { key: "tspKicker", label: "TSP hover label" },
      { key: "tspNote", label: "TSP hover line", rows: 2 },
      { key: "sampleMonth", label: "Under each monthly amount" },
      { key: "sampleFoot", label: "Line under the three cards", rows: 2 },
    ],
  },
  {
    title: "4 · The process",
    fields: [
      { key: "processKicker", label: "Section label" },
      { key: "processPrompt", label: "Line before a step is selected", rows: 2 },
      { key: "observeTitle", label: "Observe title" },
      { key: "observeBody", label: "Observe body", rows: 2 },
      { key: "observeLine", label: "Observe hover line", rows: 2 },
      { key: "orientTitle", label: "Orient title" },
      { key: "orientBody", label: "Orient body", rows: 2 },
      { key: "orientLine", label: "Orient hover line", rows: 2 },
      { key: "decideTitle", label: "Decide title" },
      { key: "decideBody", label: "Decide body", rows: 2 },
      { key: "decideLine", label: "Decide hover line", rows: 3 },
      { key: "actTitle", label: "Act title" },
      { key: "actBody", label: "Act body", rows: 2 },
      { key: "actLine", label: "Act hover line", rows: 2 },
    ],
  },
  {
    title: "5 · The outcome",
    fields: [
      { key: "outcomeKicker", label: "Section label" },
      { key: "outcomeTitle", label: "Title", rows: 2 },
      { key: "outcomeBody", label: "Body", rows: 3 },
    ],
  },
  {
    title: "Hale family demo",
    fields: [
      { key: "haleTitle", label: "Title" },
      { key: "haleBody", label: "Story", rows: 6 },
      { key: "scenarioBaseTitle", label: "Original plan title" },
      { key: "scenarioBaseBody", label: "Original plan", rows: 2 },
      { key: "scenarioSaveTitle", label: "Higher savings title" },
      { key: "scenarioSaveBody", label: "Higher savings", rows: 2 },
      { key: "scenarioLaterTitle", label: "Later retirement title" },
      { key: "scenarioLaterBody", label: "Later retirement", rows: 2 },
      { key: "blufLabel", label: "BLUF label" },
      { key: "blufBaseHeadline", label: "Original BLUF", rows: 2 },
      { key: "blufBaseBody", label: "Original BLUF detail", rows: 3 },
      { key: "blufSaveHeadline", label: "Higher savings BLUF", rows: 2 },
      { key: "blufSaveBody", label: "Higher savings BLUF detail", rows: 3 },
      { key: "blufLaterHeadline", label: "Later retirement BLUF", rows: 2 },
      { key: "blufLaterBody", label: "Later retirement BLUF detail", rows: 2 },
      { key: "haleDisclaimer", label: "Disclaimer under the BLUF", rows: 2 },
      { key: "citation", label: "Planning citation", rows: 2 },
      { key: "citationSource", label: "Citation source" },
    ],
  },
  {
    title: "6 · The invitation",
    fields: [
      { key: "inviteKicker", label: "Section label" },
      { key: "inviteTitle", label: "Title", rows: 2 },
      { key: "inviteBody", label: "Body", rows: 2 },
    ],
  },
  {
    title: "Founder",
    fields: [
      { key: "founderTitle", label: "Title", rows: 2 },
      { key: "founderBody", label: "Story", rows: 6 },
      { key: "founderLink", label: "Link to About" },
    ],
  },
  {
    title: "Before the calculator",
    fields: [
      { key: "startLabel", label: "Gold label before anyone types" },
      { key: "cautionLabel", label: "Gold label after someone types" },
      { key: "cautionBody", label: "Not-saved warning", rows: 2 },
      { key: "cautionLink", label: "Create-account link" },
      { key: "clearDemo", label: "Clear demo button", rows: 2 },
      { key: "emptyTitle", label: "Empty Act title" },
      { key: "emptyLine", label: "Empty Act line" },
      { key: "emptyBody", label: "Empty Act detail", rows: 2 },
    ],
  },
];

export const DEFAULT_HERO_COPY: HeroCopy = {
  headline: "Military pay, retired pay, VA, and TSP. One page.",
  text: "Plan for pay increases at a promotion, the yearly NDAA, and planned COLA. Change the savings rate and contributions, and watch that date and FIRE number move.\nFree to start — 2 incomes, 2 accounts, 2 contributions.  $4 a month gets you more.",
  pitch: "Six questions. One account. About a minute. See what it pays you each month.",
  startButton: "Start with just six questions",
  noCard: "No credit card needed.",
  ownButton: "I have my numbers. Start a MACH RUN.",
  ownNote: "Opens a blank MACH RUN, you type your household.",
  demoButton: "Use Pre-Filled Hale Demo",
  demoNote: "Opens the Hale demo. You can change any number, or clear the demo.",
  replaceWarn: "This replaces the household already entered. That cannot be undone from here.",
  replaceButton: "Replace with the demo",
  cancelButton: "Cancel",
  problemKicker: "1 · The problem",
  problemTitle: "Retirement is complicated.",
  problemBody:
    "Military retired pay, VA compensation, TSP, Social Security, spouse income, and expenses all operate on different timelines.",
  frustrationKicker: "2 · The frustration",
  frustrationTitle:
    "Most calculators only show pieces of the puzzle, and do not allow for unlimited iterations.",
  frustrationBody:
    "Spreadsheets take real work to keep current. Most popular software only tracks investments. A promotion, a COLA, and retired pay rarely make it into the picture.",
  solutionKicker: "3 · The solution",
  solutionTitle: "One household picture, unlimited iterations.",
  solutionBody:
    "MACH RUN brings the entire household financial picture together — a promotion, a new job, a spouse's paycheck, TSP, military retired pay, VA, and the nest-egg goal — in one place.",
  militaryEyebrow: "For military and veteran households",
  militaryTitle: "Promotions, TSP, retired pay, and VA on one strip",
  militaryBody:
    "Pay steps up at promotion, then retired pay and VA take over, all on the same strip.\nMACH RUN blends that with the rest of the household and shows what the mix can pay in retirement.",
  sampleLabel: "Sample blend",
  sampleAmount: "$6,500 a month",
  sampleNote: "$78,000 in the first year of this example. Your MACH RUN uses the numbers you type.",
  milLabel: "Military retired pay",
  milAmount: "$3,200",
  milValue: "$1,280,125",
  milKicker: "Present value of a federal annuity",
  milNote: "Military retired pay at age 50, paid through age 95. Discounted at 4% with a 2.5% COLA.",
  milExtra:
    "MACH RUN can also estimate what your military retired pay and VA are worth today — the present value of a federal annuity that would pay the same checks.",
  vaLabel: "VA",
  vaAmount: "$1,800",
  vaValue: "$720,070",
  vaKicker: "Present value of a federal annuity",
  vaNote: "VA at age 50, paid through age 95. Discounted at 4% with a 2.5% COLA.",
  vaExtra:
    "MACH RUN can also estimate what your VA compensation is worth today — the present value of a federal annuity that would pay the same checks.",
  tspLabel: "TSP withdrawal",
  tspAmount: "$1,500",
  tspValue: "$442,800",
  tspKicker: "TSP at required withdrawal",
  tspNote:
    "Estimated Traditional TSP balance at age 75, assuming $1,500 a month withdrawal. Roth has other rules.",
  sampleMonth: "a month",
  sampleFoot:
    "Military retired pay and VA show the present value of a federal annuity at age 50. TSP shows the balance at the required-withdrawal age, 75.",
  processKicker: "4 · The process",
  processPrompt: "Mouse over a step to see The Process.",
  observeTitle: "Observe",
  observeBody: "Family, accounts, and the household as it stands.",
  observeLine: "Jordan is 29, an O-3 over 8. The TSP and Roth accounts are about $44,500.",
  orientTitle: "Orient",
  orientBody: "Current and future income and spending — where the dollars come from, and where they go.",
  orientLine:
    "Pay steps from O-3 to O-4, then to O-5 at 16 years. Military retired pay at 41 is about $4,643. Spending is $8,600 a month.",
  decideTitle: "Decide",
  decideBody: "Contributions and the nest-egg goal, one change at a time.",
  decideLine:
    "The goal is $1.8 million at 60. Five percent to the TSP, then $200 a month to the 401(k), does not reach it. MACH RUN shows $800 more a month, or retiring 5 years later covers the gap.",
  actTitle: "Act",
  actBody: "Run it. Read the result and act. Start the loop again at Observe.",
  actLine:
    "At 60 they have about $1.57 million. Short of $1.8 million. Save the $800, or retire at 65, and the goal is met.",
  outcomeKicker: "5 · The outcome",
  outcomeTitle: "See the trajectory, then test a change.",
  outcomeBody:
    "Understand where retirement is headed, see a shortfall if there is one, and try a change that could improve the position. A test across 1,000 futures is on Individual Unlimited.",
  haleTitle: "The Hale Family Demo",
  haleBody:
    "Jordan Hale is 29 and an Air Force captain, O-3 with 8 years in. Riley Hale is 28 and teaches school. They have three children. Jordan's basic pay is $8,126 a month, plus BAH and BAS. Riley earns $4,200. He pins on O-5 at 16 years and leaves the military in June 2038, at 20 years and age 41, with about $265,000 in the TSP and Roth accounts. Retired pay is about $4,643 a month, 40% of his O-5 high-3. A second career follows. They plan to retire at 60, in June 2057. The nest-egg goal is $1.8 million in today's dollars. On this savings rate they are short of it.",
  scenarioBaseTitle: "Original plan",
  scenarioBaseBody: "About $1.57 million at age 60, short of the $1.8 million goal.",
  scenarioSaveTitle: "Higher savings rate",
  scenarioSaveBody:
    "Save about $800 more a month, starting now. Same retirement age, and the goal is met with room to spare.",
  scenarioLaterTitle: "Delay retirement 5 years",
  scenarioLaterBody: "Same savings rate. Five more working years, and the goal is met.",
  blufLabel: "BLUF (Bottom Line Up Front)",
  blufBaseHeadline: "At 60 the Hales have about $1.57 million, short of the $1.8 million goal.",
  blufBaseBody:
    "The TSP and Roth accounts are about $265,000 when Jordan leaves as an O-5 at 41. Retired pay is about $4,643 a month. Growth from there to 60 is modest on this savings rate.",
  blufSaveHeadline: "Saving about $800 more a month, starting now, leaves about $2.1 million at 60.",
  blufSaveBody:
    "Same retirement date, June 2057. The $800 comes out of spending. It goes into the Roth TSP while he is in uniform, then into the second-career 401(k). New TSP contributions stop at military retirement. The balance keeps compounding. In today's dollars it adds about $530,000.",
  blufLaterHeadline: "Retiring at 65 instead of 60 meets the $1.8 million goal.",
  blufLaterBody: "Same savings rate. Five more working years. About $1.9 million in today's dollars.",
  haleDisclaimer: "Sample, from the pre-filled Hale demo. Not your plan.",
  citation:
    "Households that plan for retirement end up with roughly three times the wealth of those that don't.",
  citationSource: "Lusardi & Mitchell, NBER Working Paper 17078, 2011",
  inviteKicker: "6 · The invitation",
  inviteTitle: "Start with your own numbers, or open the Hale plan.",
  inviteBody: "Six questions is free and does not ask for a credit card.",
  founderTitle: "Built by a fighter pilot who needed it.",
  founderBody:
    'Matthew "Cain" Olde flew F-15s for the U.S. Air Force and retired into the same problem every military household has: active duty, guard/reserve, or retired pay, VA, TSP, a spouse\'s paycheck, and Social Security all land in different places, and nothing shows them together. His father was a USAF fighter pilot who became a Certified Financial Planner, so he grew up with a love of fighter jets and personal finances. MACH RUN is the tool Matt wished existed, built after he hung up the G-suit.',
  founderLink: "Read the full story →",
  cautionLabel: "Master Caution",
  cautionBody: "Your MACH RUN information is not saved until you create an account.",
  cautionLink: "Create a free account in 30 seconds.",
  clearDemo: "Clear demonstration information from MACH RUN",
  startLabel: "Get Started Below",
  emptyTitle: "No MACH RUN yet.",
  emptyLine: "You need to kick the tires and light the fires!",
  emptyBody: "Finish Observe, Orient, and Decide, then come to Act and execute the MACH RUN.",
};

const STALE_HEADLINES = new Set([
  "Years to your FIRE number, with TSP, military retired pay, and VA.",
  "One place to see your whole household's retirement - income, TSP, military retired pay, VA, and your nest-egg goal.",
  "One place to see your whole household's retirement. Pay steps up with a promotion and a COLA, plus TSP, military retired pay, VA, and your nest-egg goal.",
  "One place to see your entire household's retirement picture. Pay rises with a promotion and a COLA. TSP, military retired pay, VA, and the nest-egg goal are on the same page.",
  "One place to see your entire household's finances on one page. Custom income stages for promotion and a COLA. TSP, military retired pay, VA, and the nest-egg goal.",
  "See your entire household's retirement on one page, from active duty, spouse pay and TSP contributions to VA benefits, retirement date and the nest-egg goal.",
  "Your household retirement, on one page.",
]);
const STALE_TEXT = [
  "See your whole household's retirement in one place - income, investments, and your nest-egg goal, with unlimited what-if runs. Free to start. $4 a month unlocks incredible features.",
  "Change the savings rate and watch that date move. Free to start. $4 a month.",
  "Change the savings rate and contributions, and watch that date and FIRE number move. Free to start. $4 a month gets you more.",
  "Plan for pay increases at a promotion and with a planned COLA. Change the savings rate and contributions, and watch that date and FIRE number move. Free to start. $4 a month gets you more.",
  "Plan for pay increases at a promotion, yearly NDAA's, and planned COLA. Change the savings rate and contributions, and watch that date and FIRE number move. Free to start. $4 a month gets you more.",
  "Plan for pay increases at a promotion, yearly NDAA's, and planned COLA. Change the savings rate and contributions, and watch that date and FIRE number move.\nFree to start — 2 incomes, 2 accounts, 2 contributions.  $4 a month gets you more.",
];

function isStaleHeadline(value: string): boolean {
  const key = value.trim().replace(/\s+[—–-]{1,2}\s+/g, ", ").replace(/\s+/g, " ");
  for (const stale of STALE_HEADLINES) {
    const other = stale.trim().replace(/\s+[—–-]{1,2}\s+/g, ", ").replace(/\s+/g, " ");
    if (key === other) return true;
  }
  return false;
}

const HERO_KEYS = Object.keys(DEFAULT_HERO_COPY) as (keyof HeroCopy)[];

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
  const next: HeroCopy = { ...DEFAULT_HERO_COPY };
  const headline =
    typeof src.headline === "string" && src.headline.trim() && !isStaleHeadline(src.headline)
      ? src.headline
      : DEFAULT_HERO_COPY.headline;
  const textRaw = typeof src.text === "string" ? src.text : "";
  const refreshed = textRaw
    .replaceAll(
      "Free to start. $4 a month gets you more.",
      "Free to start — 2 incomes, 2 accounts, 2 contributions.  $4 a month gets you more.",
    )
    .replace(/move\.\s+Free to start/g, "move.\nFree to start");
  const chosen =
    refreshed.trim() && !STALE_TEXT.includes(refreshed.trim())
      ? refreshed
      : DEFAULT_HERO_COPY.text;
  const text = chosen.replaceAll("yearly NDAA's", "the yearly NDAA");
  next.headline = headline;
  next.text = text;
  for (const key of HERO_KEYS) {
    if (key === "headline" || key === "text") continue;
    const value = src[key];
    if (typeof value === "string") next[key] = value;
  }
  return next;
}

export function heroFromSiteCopy(site: SiteCopy): HeroCopy {
  const page = site.pages.find((row) => row.slug === "hero");
  if (!page) return { ...DEFAULT_HERO_COPY };
  return parseHeroCopy(page.body);
}
