export const COMPARE_COLUMNS = [
  "MACHRUN.com",
  "FIRECalc",
  "MS Excel spreadsheet",
  "Quicken.com",
] as const;

export type CompareMarks = [boolean, boolean, boolean, boolean];

export type CompareRow = {
  feature: string;
  marks: CompareMarks;
};

export type CompareCopy = {
  title: string;
  kicker: string;
  intro: string;
  rows: CompareRow[];
  prices: [string, string, string, string];
  noteStar: string;
  noteFine: string;
  button: string;
};

const DEFAULT_ROWS: CompareRow[] = [
  {
    feature:
      "TSP, military retired pay, and VA as paychecks in one household with unlimited dependents/children",
    marks: [true, false, false, true],
  },
  {
    feature: "Monthly retirement projection from the numbers you type",
    marks: [true, false, false, false],
  },
  {
    feature: "User-defined target retirement date and nest-egg (FIRE number) goal amount",
    marks: [true, true, false, true],
  },
  {
    feature: "Near-instant review of 1,000 possible plan futures w/ MACH RUN's Monte Carlo Plan Survival",
    marks: [true, false, false, false],
  },
  {
    feature: "What-if run without writing the formulas",
    marks: [true, true, false, true],
  },
  {
    feature: "Unlimited iterations to review and tweak your plan",
    marks: [true, true, false, true],
  },
  {
    feature: "Weekly, every two weeks, or a yearly bonus",
    marks: [true, false, false, false],
  },
  {
    feature:
      "Global or individual COLA percentages for salary and wages, military retired pay, VA, pension, Social Security and other incomes",
    marks: [true, false, false, false],
  },
  {
    feature: "Automatic Social Security estimation from covered pay",
    marks: [true, false, false, false],
  },
  {
    feature: "You, a spouse, and another household member",
    marks: [true, false, false, false],
  },
  {
    feature: "Actual Income Retired (A.I.R.), year by year",
    marks: [true, false, false, false],
  },
  {
    feature: "Instantly switch your plan between today's dollars or future dollars",
    marks: [true, false, false, true],
  },
  {
    feature: "Peer analysis, comparison and ranking using U.S. Department of Labor statistics.",
    marks: [true, false, false, false],
  },
  {
    feature: "Integrated OODA AI, conversational AI regarding your plan",
    marks: [true, false, false, false],
  },
  {
    feature: "Free to start",
    marks: [true, true, false, false],
  },
];

export const DEFAULT_COMPARE_COPY: CompareCopy = {
  title: "Compare",
  kicker: "How does MACH RUN compare to other common retirement calculators?",
  intro:
    "MACH RUN is the only column with a monthly projection from the numbers you type, 1,000 futures, and COLA on military retired pay, VA, and Social Security. FIRECalc is free and runs what-ifs. A spreadsheet has only the rows you build, and lacks Monte Carlo and a seamless user interface. Quicken Classic can hold some of the same pay, but is not focused on retirement planning and is not made by veterans for veterans. Please see the table below for a robust comparison of MACH RUN to the other common products.",
  rows: DEFAULT_ROWS,
  prices: ["Free, then $4/mo", "Free", "Cost of the sheet", "$6.99/mo, billed yearly"],
  noteStar:
    "* Monte Carlo 1,000 futures is available on Individual Unlimited and Advisor plans only.",
  noteFine:
    "Quicken means the Lifetime Planner in Quicken Classic. The price is Classic Deluxe, billed yearly. A spreadsheet can be made to do any row if you build it. The check is what is already there. MACH RUN is not affiliated with FIRECalc or Quicken. [The Method](/method) shows how a run is built. [Pricing](/pricing) starts free. Individual is $4 a month.",
  button: "Get Started with MACH RUN - no credit card required",
};

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function marks(value: unknown, fallback: CompareMarks): CompareMarks {
  if (!Array.isArray(value)) return fallback;
  return [0, 1, 2, 3].map((index) =>
    typeof value[index] === "boolean" ? value[index] : fallback[index],
  ) as CompareMarks;
}

function prices(value: unknown, fallback: CompareCopy["prices"]): CompareCopy["prices"] {
  if (!Array.isArray(value)) return fallback;
  return [0, 1, 2, 3].map((index) =>
    typeof value[index] === "string" ? value[index] : fallback[index],
  ) as CompareCopy["prices"];
}

export function mergeCompareCopy(raw: unknown): CompareCopy {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_COMPARE_COPY;
  const rows = Array.isArray(src.rows)
    ? src.rows.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as Record<string, unknown>;
        const feature = typeof item.feature === "string" ? item.feature : "";
        return [{ feature, marks: marks(item.marks, [false, false, false, false]) }];
      })
    : d.rows;
  return {
    title: str(src.title, d.title),
    kicker: str(src.kicker, d.kicker),
    intro: str(src.intro, d.intro),
    rows: rows.length ? rows : d.rows,
    prices: prices(src.prices, d.prices),
    noteStar: typeof src.noteStar === "string" ? src.noteStar : d.noteStar,
    noteFine: typeof src.noteFine === "string" ? src.noteFine : d.noteFine,
    button: str(src.button, d.button),
  };
}

export function parseCompareCopy(body: string | null | undefined): CompareCopy {
  const text = (body ?? "").trim();
  if (!text) return DEFAULT_COMPARE_COPY;
  try {
    return mergeCompareCopy(JSON.parse(text));
  } catch {
    return DEFAULT_COMPARE_COPY;
  }
}

export function serializeCompareCopy(copy: CompareCopy): string {
  return JSON.stringify(copy, null, 2);
}
