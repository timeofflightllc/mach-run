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
  faqBlurb: "",
  paidBlurb: "",
  privacyBlurb: "",
  oodaAiLine: "",
  projections: "",
  benefits: "",
  boyd: "",
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
    faqBlurb: str(src.faqBlurb, d.faqBlurb),
    paidBlurb: str(src.paidBlurb, d.paidBlurb),
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
