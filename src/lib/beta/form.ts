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
    title: "Charts, Ledgers & Monte Carlo",
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

export type BetaAnswers = {
  name: string;
  email: string;
  testedOn: string;
  device: string;
  plan: "" | "free" | "paid";
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
  return {
    family: { notes: "", continued: false },
    assets: { notes: "", continued: false },
    income: { notes: "", continued: false },
    contributions: { notes: "", continued: false },
    takeoff: { notes: "", continued: false },
    charts: { notes: "", continued: false },
    overall: { notes: "", continued: false },
  };
}

export function emptyAnswers(testedOn = ""): BetaAnswers {
  return {
    name: "",
    email: "",
    testedOn,
    device: "",
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
  const plan = raw.plan === "free" || raw.plan === "paid" ? raw.plan : "";
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
    sections[section.key] = {
      notes: clip(row.notes, NOTES_MAX),
      continued: row.continued === true,
    };
  }
  const hatIn = raw.hat && typeof raw.hat === "object" ? (raw.hat as Record<string, unknown>) : {};
  return {
    name: clip(raw.name, SHORT_MAX),
    email: "",
    testedOn: clip(raw.testedOn, 10),
    device: clip(raw.device, SHORT_MAX),
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
