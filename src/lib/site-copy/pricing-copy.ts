import type { PricingCardCopy, PricingCopy } from "./types";

export const DEFAULT_PRICING_COPY: PricingCopy = {
  heroH1: "Pick a lane:\nPersonal or Professional.",
  heroSub: "Monthly or yearly. Two months free on yearly.",
  personalP1: "Individual is a cup of coffee a month for the full cash-flow MACH RUN.",
  personalP2: "Individual Unlimited adds Net Worth and Liabilities.",
  personalP3: "Professional financial advisors have even more capability built in.",
  advisorP1: "Advisor Lite is five named client profiles. Seven-day trial, then $69/month.",
  advisorP2: "Advisor Unlimited is the same engine with unlimited profiles.",
  couponLabel: "Do you have a coupon code?",
  intervalNoteMonth: "Monthly or yearly — yearly is two months free.",
  intervalNoteYear: "Yearly: two months on us.",
  intervalNoteAdvisorMonth: "Advisor Lite includes a 7-day free trial (card on file).",
  freeAdvisorBullet: "Same free start. Paid advisor packages sit next to it.",
  advisorLiteTagYear: "7-day trial, 2 months free",
  advisorUnlimitedTagYear: "Two months free on yearly.",
  free: {
    tag: "Register in 30 seconds",
    bullets: [
      "One household.",
      "Limit 2 accounts · 2 contributions · 2 incomes",
      "Limited OODA analysis, a paragraph or two",
      "Net Worth stays locked until Individual Unlimited",
    ],
  },
  individual: {
    tag: "Less than that cup of bad coffee you hate",
    bullets: [
      "One household, unlimited accounts",
      "Unlimited contributions and incomes",
      "Full MACH OODA Financial Analysis",
      "OODA AI on this MACH RUN",
      "Net Worth stays locked — unlock on Unlimited",
    ],
  },
  unlimited: {
    tag: "The household balance sheet on top of Individual",
    bullets: [
      "Everything in Individual, plus:",
      "Live Net Worth radar — assets vs liabilities",
      "Liabilities (car, student, HELOC, other)",
      "Encrypted MACH RUN backup download",
      "Pay yearly, two months on us",
    ],
  },
  advisorLite: {
    tag: "7-day trial, then $69/month",
    bullets: [
      "Everything in Individual Unlimited, plus:",
      "5 named profiles (client IDs)",
      "Dropdown to switch Client profiles",
      "Export / import encrypted MACH RUN file",
      "For financial professionals, or nerds",
    ],
  },
  advisorUnlimited: {
    tag: "$169/month for an unlimited book.",
    bullets: [
      "Everything in Advisor Lite, plus:",
      "Unlimited named profiles",
      "Same encrypted export / import file",
      "For a full book of clients",
    ],
  },
};

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function bullets(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((line) => (typeof line === "string" ? line.trim() : "")).filter(Boolean);
}

function card(value: unknown, fallback: PricingCardCopy): PricingCardCopy {
  if (!value || typeof value !== "object") return fallback;
  const row = value as Record<string, unknown>;
  return {
    tag: str(row.tag, fallback.tag),
    bullets: bullets(row.bullets, fallback.bullets),
  };
}

export function mergePricingCopy(raw: unknown): PricingCopy {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_PRICING_COPY;
  return {
    heroH1: str(src.heroH1, d.heroH1),
    heroSub: str(src.heroSub, d.heroSub),
    personalP1: str(src.personalP1, d.personalP1),
    personalP2: str(src.personalP2, d.personalP2),
    personalP3: str(src.personalP3, d.personalP3),
    advisorP1: str(src.advisorP1, d.advisorP1),
    advisorP2: str(src.advisorP2, d.advisorP2),
    couponLabel: str(src.couponLabel, d.couponLabel),
    intervalNoteMonth: str(src.intervalNoteMonth, d.intervalNoteMonth),
    intervalNoteYear: str(src.intervalNoteYear, d.intervalNoteYear),
    intervalNoteAdvisorMonth: str(src.intervalNoteAdvisorMonth, d.intervalNoteAdvisorMonth),
    freeAdvisorBullet: str(src.freeAdvisorBullet, d.freeAdvisorBullet),
    advisorLiteTagYear: str(src.advisorLiteTagYear, d.advisorLiteTagYear),
    advisorUnlimitedTagYear: str(src.advisorUnlimitedTagYear, d.advisorUnlimitedTagYear),
    free: card(src.free, d.free),
    individual: card(src.individual, d.individual),
    unlimited: card(src.unlimited, d.unlimited),
    advisorLite: card(src.advisorLite, d.advisorLite),
    advisorUnlimited: card(src.advisorUnlimited, d.advisorUnlimited),
  };
}

export function parsePricingCopy(body: string | null | undefined): PricingCopy {
  const text = (body ?? "").trim();
  if (!text) return DEFAULT_PRICING_COPY;
  try {
    return mergePricingCopy(JSON.parse(text));
  } catch {
    return DEFAULT_PRICING_COPY;
  }
}

export function serializePricingCopy(copy: PricingCopy): string {
  return JSON.stringify(copy, null, 2);
}

export function bulletsToText(lines: string[]): string {
  return lines.join("\n");
}

export function bulletsFromText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
