import { contentPageSchema } from "@/lib/content-page-schema";
import {
  ADVISOR_MONTHLY_USD,
  ADVISOR_UNLIMITED_MONTHLY_USD,
  MACH_MONTHLY_USD,
  UNLIMITED_MONTHLY_USD,
} from "@/lib/billing/limits";

export const SITE = "https://machrun.com";

type JsonLd = Record<string, unknown>;

const organization: JsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MACH RUN",
  url: SITE,
  logo: `${SITE}/brand/mach-run-logo.jpg`,
  sameAs: ["https://www.linkedin.com/company/machrun-com/"],
};

function offer(name: string, price: number, path = "/pricing"): JsonLd {
  return {
    "@type": "Offer",
    name,
    price: String(price),
    priceCurrency: "USD",
    url: `${SITE}${path}`,
    availability: "https://schema.org/InStock",
  };
}

/** Public prices. Monthly is the listed rate. Yearly is the same plan, paid once. */
export function productSchema(path: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MACH RUN",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: `${SITE}${path}`,
    description:
      "A household retirement calculator for income, TSP, military retired pay, VA, and a nest-egg goal.",
    offers: [
      offer("Free", 0),
      offer("Individual", MACH_MONTHLY_USD),
      offer("Individual Unlimited", UNLIMITED_MONTHLY_USD),
      offer("Advisor Lite", ADVISOR_MONTHLY_USD),
      offer("Advisor Unlimited", ADVISOR_UNLIMITED_MONTHLY_USD),
    ],
  };
}

export function pageHead({
  title,
  description,
  path,
  noindex = false,
  jsonLd = [],
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  jsonLd?: JsonLd[];
}) {
  const url = `${SITE}${path}`;
  const pageSchema = !noindex && jsonLd.length === 0 ? contentPageSchema(title, path) : null;
  const blocks = pageSchema ? [...jsonLd, pageSchema] : jsonLd;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      ...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...blocks.map((data) => ({ "script:ld+json": data })),
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export const homeJsonLd = [organization, productSchema("/")];
