import type { CheckoutPackage } from "@/lib/billing/limits";

const PACKAGES: readonly CheckoutPackage[] = [
  "individual",
  "unlimited",
  "advisor_lite",
  "advisor",
];

export type CheckoutIntent = {
  package: CheckoutPackage | null;
  interval: "month" | "year" | null;
};

export type LoginSearch = {
  mode: "in" | "up";
  package?: CheckoutPackage;
  interval?: "month" | "year";
};

export type PricingSearch = {
  package?: CheckoutPackage;
  interval?: "month" | "year";
  checkout?: "1";
};

export function parseCheckoutIntent(search: Record<string, unknown>): CheckoutIntent {
  const raw = typeof search.package === "string" ? search.package : "";
  const interval =
    search.interval === "month" || search.interval === "year" ? search.interval : null;
  return {
    package: (PACKAGES as readonly string[]).includes(raw) ? (raw as CheckoutPackage) : null,
    interval,
  };
}

/** Login click from a paid card. Register tab, no checkout yet. */
export function registerForPlanHref(
  pkg: CheckoutPackage,
  interval: "month" | "year",
): string {
  const q = new URLSearchParams({ mode: "up", package: pkg, interval });
  return `/login?${q.toString()}`;
}

/** Where to land after register or sign-in. Null means no plan was chosen. */
export function resumeCheckoutHref(intent: CheckoutIntent): string | null {
  if (!intent.package || !intent.interval) return null;
  const q = new URLSearchParams({
    package: intent.package,
    interval: intent.interval,
    checkout: "1",
  });
  return `/pricing?${q.toString()}`;
}

export function afterAuthHref(search: Record<string, unknown>): string {
  return resumeCheckoutHref(parseCheckoutIntent(search)) ?? "/";
}

export function wantsCheckout(search: Record<string, unknown>): boolean {
  return search.checkout === "1" || search.checkout === 1;
}

export function loginSearch(search: Record<string, unknown>): LoginSearch {
  const intent = parseCheckoutIntent(search);
  return {
    mode: search.mode === "up" ? "up" : "in",
    ...(intent.package ? { package: intent.package } : {}),
    ...(intent.interval ? { interval: intent.interval } : {}),
  };
}

export function pricingSearch(search: Record<string, unknown>): PricingSearch {
  const intent = parseCheckoutIntent(search);
  return {
    ...(intent.package ? { package: intent.package } : {}),
    ...(intent.interval ? { interval: intent.interval } : {}),
    ...(wantsCheckout(search) ? { checkout: "1" as const } : {}),
  };
}

export function verifySearch(search: Record<string, unknown>): Omit<LoginSearch, "mode"> {
  const intent = parseCheckoutIntent(search);
  return {
    ...(intent.package ? { package: intent.package } : {}),
    ...(intent.interval ? { interval: intent.interval } : {}),
  };
}
