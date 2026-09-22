import type { FooterCopy, SiteCopy } from "./types";

export const DEFAULT_FOOTER_COPY: FooterCopy = {
  measureTitle: "Measure",
  measureBody: "Observe your financial starting point…",
  allocateTitle: "Allocate",
  allocateBody: "Orient where your dollars go…",
  compoundTitle: "Compound",
  compoundBody: "Decide to let time do the heavy lifting…",
  harvestTitle: "Harvest",
  harvestBody: "Act on your efforts — enjoy the fruit of your labor.",
  privacyBlurb:
    "Your MACH Run data is encrypted in transit (HTTPS) and encrypted at rest on the server. We do not sell it.",
  oodaAiLine:
    "* MACH OODA AI analysis and OODA AI questions are for entertainment purposes only. They are not financial, tax, legal, or investment advice.",
  projections:
    "Projections are hypothetical illustrations based on the numbers and rates you type in. They are not guarantees of future results. Past performance does not guarantee future returns. Markets, inflation, taxes, longevity, health costs, and policy can all go differently than modeled. Account rules, contribution limits, and benefit formulas change.",
  benefits:
    "Social Security, military retirement, VA compensation, and similar figures are estimates, not official determinations. Confirm amounts with the Social Security Administration, DFAS, VA, your plan administrator, and a qualified advisor before you act. You are solely responsible for your financial decisions.",
  boyd:
    "Observe, Orient, Decide, Act (OODA) comes from the late, great U.S. Air Force Col. John Boyd (Ret.). His Energy-Maneuverability theory and the OODA Loop changed the world. Any mention of OODA or the OODA Loop on this site refers to Boyd’s publicly circulated work — not to any private organization that later trademarked, copyrighted, or packaged his ideas.",
};

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function mergeFooterCopy(raw: unknown): FooterCopy {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_FOOTER_COPY;
  return {
    measureTitle: str(src.measureTitle, d.measureTitle),
    measureBody: str(src.measureBody, d.measureBody),
    allocateTitle: str(src.allocateTitle, d.allocateTitle),
    allocateBody: str(src.allocateBody, d.allocateBody),
    compoundTitle: str(src.compoundTitle, d.compoundTitle),
    compoundBody: str(src.compoundBody, d.compoundBody),
    harvestTitle: str(src.harvestTitle, d.harvestTitle),
    harvestBody: str(src.harvestBody, d.harvestBody),
    privacyBlurb: str(src.privacyBlurb, d.privacyBlurb),
    oodaAiLine: str(src.oodaAiLine, d.oodaAiLine),
    projections: str(src.projections, d.projections),
    benefits: str(src.benefits, d.benefits),
    boyd: str(src.boyd, d.boyd),
  };
}

export function parseFooterCopy(body: string | null | undefined): FooterCopy {
  const text = (body ?? "").trim();
  if (!text) return DEFAULT_FOOTER_COPY;
  try {
    return mergeFooterCopy(JSON.parse(text));
  } catch {
    return DEFAULT_FOOTER_COPY;
  }
}

export function serializeFooterCopy(copy: FooterCopy): string {
  return JSON.stringify(copy, null, 2);
}

export function footerFromSiteCopy(copy: SiteCopy | null | undefined): FooterCopy {
  const page = copy?.pages.find((p) => p.slug === "footer");
  return parseFooterCopy(page?.body);
}
