export const BETA_SECTIONS = [
  {
    key: "family",
    phase: "Observe",
    phaseNote:
      "Measure your financial starting point. This phase covers Family & Assumptions and Assets & Liabilities.",
    title: "Family & Assumptions",
    prompts: [
      "Was it clear what information to enter (names, birthdays, retirement goal date, nest-egg goal, longevity, return rate, COLA)?",
      "Were the default rates (7% return / 2.5% COLA) understandable?",
      "Any fields that were confusing, missing, or hard to find?",
      "Bugs, errors, or unexpected behavior?",
      "Suggestions for improvement:",
    ],
  },
  {
    key: "assets",
    phase: "",
    phaseNote: "",
    title: "Assets & Liabilities",
    prompts: [
      "How easy was it to add accounts (TSP, IRA, taxable, etc.)?",
      "Were account types clear (including military-specific ones)?",
      "Any issues with balances, ownership, or account settings?",
      "Bugs, errors, or unexpected behavior?",
      "Suggestions for improvement:",
    ],
  },
  {
    key: "income",
    phase: "Orient",
    phaseNote: "Allocate where your dollars go. This phase covers Income & Spending.",
    title: "Income & Spending",
    prompts: [
      "How clear was the process for adding income sources (paychecks, military retired pay, VA, Social Security, spouse income, etc.)?",
      "Were the differences between earned vs. guaranteed income easy to understand?",
      "How was the spending entry experience?",
      "Any issues with dates, COLA overrides, or income stages?",
      "Bugs, errors, or unexpected behavior?",
      "Suggestions for improvement:",
    ],
  },
  {
    key: "goals",
    phase: "Decide",
    phaseNote: "Set the target before the contributions. This is the retirement date, the longevity age, and the goal itself.",
    title: "Goals",
    prompts: [
      "Was it clear that Goals is where you set what you are aiming for, before contributions?",
      "Did the choice between a nest-egg goal and a monthly retirement income goal make sense?",
      "Was it clear what Still working versus Already retired does to the retirement date?",
      "Was the longevity age easy to understand, including that a blank goal is not scored?",
      "Was the as-of date easy to find and change?",
      "Bugs, errors, or unexpected behavior?",
      "Suggestions for improvement:",
    ],
  },
  {
    key: "contributions",
    phase: "Decide",
    phaseNote: "Compound by deciding contributions and goals for the accounts.",
    title: "Contributions",
    prompts: [
      "Was it clear how to set up contributions and which accounts they go to?",
      "Did the leftover / sweep behavior make sense (leftover after income − tax − spending)?",
      "Any confusion around employer match, IRS caps, or contribution limits?",
      "Bugs, errors, or unexpected behavior?",
      "Suggestions for improvement:",
    ],
  },
  {
    key: "takeoff",
    phase: "Act",
    phaseNote:
      "Harvest the results. Run the calculation and review the analysis, charts, ledger, and simulations.",
    title: "Takeoff & Analysis",
    prompts: [
      "Was the Execute / Calculate / Takeoff action clear?",
      "How useful and understandable was the MACH OODA Financial Analysis?",
      "Did the results match what you expected from the numbers you entered?",
      "Any issues with the Today $ vs Future $ toggle?",
      "Bugs, errors, or unexpected behavior?",
      "Suggestions for improvement:",
    ],
  },
  {
    key: "charts",
    phase: "",
    phaseNote: "",
    title: "Charts and Ledgers",
    prompts: [
      "Were the charts and graphs clear and useful?",
      "How was the ledger experience?",
      "If you had access to Monte Carlo / Plan Survival or Mach Rewind, how useful were they?",
      "Any missing charts, confusing labels, or display issues?",
      "Bugs, errors, or unexpected behavior?",
      "Suggestions for improvement:",
    ],
  },
  {
    key: "overall",
    phase: "Overall",
    phaseNote: "General experience.",
    title: "General experience",
    prompts: [
      "What was the strongest part of MACH RUN?",
      "What was the most confusing or frustrating part?",
      "How clear was the first-run path (six questions vs. jumping into Observe)? Did the sample run help?",
      "Did the results feel realistic for the numbers you entered?",
      "What would make you come back and run this again next month?",
      "Did the OODA structure make sense as you moved through the app?",
      "Would you recommend this to a friend or fellow military household? Why or why not?",
      "Any other bugs, missing features, or ideas we should know about?",
    ],
  },
] as const;

export type BetaSectionKey = (typeof BETA_SECTIONS)[number]["key"];

export type BetaSectionAnswer = {
  notes: string;
  continued: boolean;
  replies: string[];
};

export type BetaHat = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  notes: string;
  decline: boolean;
};

export const BETA_PLANS = [
  { id: "free", label: "Free" },
  { id: "individual", label: "Paid - Individual" },
  { id: "unlimited", label: "Paid - Individual Unlimited" },
  { id: "advisor_lite", label: "Paid - Advisor Lite" },
  { id: "advisor", label: "Paid - Advisor Heavy" },
] as const;

export type BetaPlan = "" | (typeof BETA_PLANS)[number]["id"] | "paid";

export const BETA_DEVICE_KINDS = [
  { id: "mobile", label: "Mobile" },
  { id: "desktop", label: "Desktop" },
] as const;

export type BetaDeviceKind = "" | (typeof BETA_DEVICE_KINDS)[number]["id"];

export const BETA_OS = {
  mobile: [
    { id: "ios", label: "iOS / iPadOS" },
    { id: "android", label: "Android" },
    { id: "other", label: "Other" },
  ],
  desktop: [
    { id: "macos", label: "macOS" },
    { id: "windows", label: "Windows" },
    { id: "chromeos", label: "ChromeOS" },
    { id: "linux", label: "Linux" },
    { id: "other", label: "Other" },
  ],
} as const;

export const BETA_BROWSERS = {
  mobile: [
    { id: "safari", label: "Safari" },
    { id: "chrome", label: "Chrome" },
    { id: "firefox", label: "Firefox" },
    { id: "samsung", label: "Samsung Internet" },
    { id: "edge", label: "Edge" },
    { id: "duckduckgo", label: "DuckDuckGo" },
    { id: "brave", label: "Brave" },
    { id: "opera", label: "Opera" },
    { id: "other", label: "Other" },
  ],
  desktop: [
    { id: "chrome", label: "Chrome" },
    { id: "safari", label: "Safari" },
    { id: "firefox", label: "Firefox" },
    { id: "edge", label: "Edge" },
    { id: "brave", label: "Brave" },
    { id: "arc", label: "Arc" },
    { id: "opera", label: "Opera" },
    { id: "other", label: "Other" },
  ],
} as const;

export function betaPlanLabel(plan: string): string {
  const match = BETA_PLANS.find((row) => row.id === plan);
  if (match) return match.label;
  if (plan === "paid") return "Paid";
  return "";
}

function optionLabel(rows: readonly { id: string; label: string }[], id: string): string {
  return rows.find((row) => row.id === id)?.label ?? "";
}

export function betaDeviceLabel(kind: string): string {
  return optionLabel(BETA_DEVICE_KINDS, kind);
}

export function betaOsLabel(kind: string, os: string): string {
  if (kind !== "mobile" && kind !== "desktop") return "";
  return optionLabel(BETA_OS[kind], os);
}

export function betaBrowserLabel(kind: string, browser: string): string {
  if (kind !== "mobile" && kind !== "desktop") return "";
  return optionLabel(BETA_BROWSERS[kind], browser);
}

export function betaDeviceLine(kind: string, os: string, browser: string): string {
  return [betaDeviceLabel(kind), betaOsLabel(kind, os), betaBrowserLabel(kind, browser)].filter(Boolean).join(" / ");
}

export type BetaAnswers = {
  name: string;
  email: string;
  testedOn: string;
  device: string;
  deviceKind: BetaDeviceKind;
  os: string;
  browser: string;
  plan: BetaPlan;
  sections: Record<BetaSectionKey, BetaSectionAnswer>;
  hat: BetaHat;
};

export type BetaSubmitted = {
  id: string;
  submittedAt: string;
  answers: BetaAnswers;
};

export type BetaPage =
  | { open: false }
  | {
      open: true;
      email: string;
      limit: number;
      submittedCount: number;
      submitted: BetaSubmitted[];
      draft: BetaAnswers | null;
      knownHat: BetaHat | null;
    };

const NOTES_MAX = 20_000;
const SHORT_MAX = 200;
const HAT_NOTES_MAX = 2_000;

function clip(value: unknown, max: number): string {
  return String(value ?? "").slice(0, max);
}

function emptySections(): Record<BetaSectionKey, BetaSectionAnswer> {
  const sections = {} as Record<BetaSectionKey, BetaSectionAnswer>;
  for (const section of BETA_SECTIONS) {
    sections[section.key] = {
      notes: "",
      continued: false,
      replies: section.prompts.map(() => ""),
    };
  }
  return sections;
}

export function emptyAnswers(testedOn = ""): BetaAnswers {
  return {
    name: "",
    email: "",
    testedOn,
    device: "",
    deviceKind: "",
    os: "",
    browser: "",
    plan: "",
    sections: emptySections(),
    hat: {
      fullName: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      zip: "",
      country: "",
      notes: "",
      decline: false,
    },
  };
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function sanitizeAnswers(input: unknown): BetaAnswers {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const planIds = new Set<string>(BETA_PLANS.map((row) => row.id));
  const rawPlan = typeof raw.plan === "string" ? raw.plan : "";
  const plan: BetaPlan = planIds.has(rawPlan) || rawPlan === "paid" ? (rawPlan as BetaPlan) : "";
  const sectionsIn =
    raw.sections && typeof raw.sections === "object"
      ? (raw.sections as Record<string, unknown>)
      : {};
  const sections = emptySections();
  for (const section of BETA_SECTIONS) {
    const row =
      sectionsIn[section.key] && typeof sectionsIn[section.key] === "object"
        ? (sectionsIn[section.key] as Record<string, unknown>)
        : {};
    const repliesIn = Array.isArray(row.replies) ? row.replies : [];
    sections[section.key] = {
      notes: clip(row.notes, NOTES_MAX),
      continued: row.continued === true,
      replies: section.prompts.map((_, index) => clip(repliesIn[index], NOTES_MAX)),
    };
  }
  const hatIn = raw.hat && typeof raw.hat === "object" ? (raw.hat as Record<string, unknown>) : {};
  const deviceKind: BetaDeviceKind = raw.deviceKind === "mobile" || raw.deviceKind === "desktop" ? raw.deviceKind : "";
  const os = betaOsLabel(deviceKind, typeof raw.os === "string" ? raw.os : "") ? String(raw.os) : "";
  const browser = betaBrowserLabel(deviceKind, typeof raw.browser === "string" ? raw.browser : "")
    ? String(raw.browser)
    : "";
  const legacyDevice = clip(raw.device, SHORT_MAX);
  return {
    name: clip(raw.name, SHORT_MAX),
    email: "",
    testedOn: clip(raw.testedOn, 10),
    deviceKind,
    os,
    browser,
    device: deviceKind ? betaDeviceLine(deviceKind, os, browser) : legacyDevice,
    plan,
    sections,
    hat: {
      fullName: clip(hatIn.fullName, SHORT_MAX),
      line1: clip(hatIn.line1, SHORT_MAX),
      line2: clip(hatIn.line2, SHORT_MAX),
      city: clip(hatIn.city, SHORT_MAX),
      state: clip(hatIn.state, 40),
      zip: clip(hatIn.zip, 20),
      country: clip(hatIn.country, SHORT_MAX),
      notes: clip(hatIn.notes, HAT_NOTES_MAX),
      decline: hatIn.decline === true,
    },
  };
}

export function parseAnswers(value: unknown): BetaAnswers {
  if (typeof value === "string") {
    try {
      return sanitizeAnswers(JSON.parse(value));
    } catch {
      return emptyAnswers();
    }
  }
  return sanitizeAnswers(value);
}

/** A mailing address we can reuse. A declined hat does not count. */
export function hatOnFile(hat: BetaHat): boolean {
  if (hat.decline) return false;
  return Boolean(hat.fullName.trim() && hat.line1.trim() && hat.city.trim() && hat.state.trim() && hat.zip.trim());
}

export function knownHat(rows: { answers: BetaAnswers }[]): BetaHat | null {
  const hat = rows[0]?.answers.hat;
  if (!hat || !hatOnFile(hat)) return null;
  return { ...hat };
}

export function hatIsBlank(hat: BetaHat): boolean {
  if (hat.decline) return false;
  return !hat.fullName && !hat.line1 && !hat.line2 && !hat.city && !hat.state && !hat.zip && !hat.country && !hat.notes;
}
export function hatMissing(answers: BetaAnswers): boolean {
  if (answers.hat.decline) return false;
  const hat = answers.hat;
  return !hat.fullName.trim() || !hat.line1.trim() || !hat.city.trim() || !hat.state.trim() || !hat.zip.trim();
}
