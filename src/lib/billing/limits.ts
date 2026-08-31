export const FREE_ACCOUNT_LIMIT = 2;
export const FREE_CONTRIBUTION_LIMIT = 2;
export const FREE_INCOME_LIMIT = 2;
export const MACH_MONTHLY_USD = 4;
export const MACH_YEARLY_USD = 40;
export const UNLIMITED_MONTHLY_USD = 15;
export const UNLIMITED_YEARLY_USD = 130;
export const ADVISOR_MONTHLY_USD = 69;
export const ADVISOR_YEARLY_USD = 690;
export const ADVISOR_UNLIMITED_MONTHLY_USD = 169;
export const ADVISOR_UNLIMITED_YEARLY_USD = 1690;
export const ADVISOR_TRIAL_DAYS = 7;
export const ADVISOR_LITE_PROFILE_LIMIT = 5;
export const TRIAL_PROMO_CODE = "SUPER14";
export const TRIAL_PROMO_DAYS = 14;

export function normalizePromoCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

/** Days of free trial from a MACH RUN code, or null if blank/unknown. */
export function trialDaysForCode(raw: string | null | undefined): number | null {
  const code = normalizePromoCode(raw);
  if (!code) return null;
  if (code === TRIAL_PROMO_CODE) return TRIAL_PROMO_DAYS;
  return null;
}

export type MachPackage = "free" | "individual" | "unlimited" | "advisor_lite" | "advisor";
export type CheckoutPackage = "individual" | "unlimited" | "advisor_lite" | "advisor";

export type Entitlement = {
  signedIn: boolean;
  paid: boolean;
  plan: MachPackage;
  interval: "month" | "year" | null;
  accountLimit: number | null;
  contributionLimit: number | null;
  incomeLimit: number | null;
  profileLimit: number | null;
  stripeConfigured: boolean;
  advisorStripeConfigured: boolean;
  advisorUnlimitedStripeConfigured: boolean;
  status: string | null;
  periodEnd: string | null;
  billed: MachPackage;
  unlimitedStripeConfigured?: boolean;
};

export const GUEST_ENTITLEMENT: Entitlement = {
  signedIn: false,
  paid: false,
  plan: "free",
  interval: null,
  accountLimit: FREE_ACCOUNT_LIMIT,
  contributionLimit: FREE_CONTRIBUTION_LIMIT,
  incomeLimit: FREE_INCOME_LIMIT,
  profileLimit: 0,
  stripeConfigured: false,
  advisorStripeConfigured: false,
  advisorUnlimitedStripeConfigured: false,
  status: null,
  periodEnd: null,
  billed: "free",
};

export function paidFromStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

export function isAdvisorPlan(plan: MachPackage): boolean {
  return plan === "advisor" || plan === "advisor_lite";
}

export function packageLabel(plan: MachPackage): string {
  if (plan === "advisor") return "Advisor Unlimited";
  if (plan === "advisor_lite") return "Advisor Lite";
  if (plan === "unlimited") return "Individual Unlimited";
  if (plan === "individual") return "Individual";
  return "Free";
}

/** Encrypted .machrun backup. Individual $4 and Free do not get this. */
export function canDownloadBackup(plan: MachPackage): boolean {
  return plan === "unlimited" || isAdvisorPlan(plan);
}

/** Net Worth chart + Liabilities list. Individual $4 does not get these. */
export function hasBalanceSheet(plan: MachPackage): boolean {
  return plan === "unlimited" || plan === "advisor" || plan === "advisor_lite";
}

/** null = unlimited profiles. 0 = switcher hidden. */
export function profileLimitFor(plan: MachPackage): number | null {
  if (plan === "advisor") return null;
  if (plan === "advisor_lite") return ADVISOR_LITE_PROFILE_LIMIT;
  return 0;
}

export type PlanChangePath = "checkout" | "already" | "prorate";

/** Paid Stripe sub on a different price → update in place and credit unused time. */
export function planChangePath(
  row: {
    status: string | null;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
    price_id: string | null;
  } | null,
  targetPriceId: string,
): PlanChangePath {
  if (
    !row ||
    !paidFromStatus(row.status) ||
    !row.stripe_subscription_id ||
    !row.stripe_customer_id
  ) {
    return "checkout";
  }
  if (row.price_id && row.price_id === targetPriceId) return "already";
  return "prorate";
}

/** Free users can keep what they already saved; they cannot grow past the cap. */
export function addCap(existingCount: number, paid: boolean, freeCap: number): number {
  if (paid) return Number.POSITIVE_INFINITY;
  return Math.max(freeCap, existingCount);
}

export function clampPlan<
  T extends { portfolios: unknown[]; contributions: unknown[]; incomes?: unknown[] },
>(plan: T, accountCap: number, contributionCap: number, incomeCap: number): T {
  const portfolios = plan.portfolios.slice(0, accountCap);
  const ids = new Set(
    portfolios.map((p) => (p as { id?: string }).id).filter(Boolean) as string[],
  );
  const contributions = plan.contributions
    .filter((c) => ids.has((c as { portfolioId?: string }).portfolioId ?? ""))
    .slice(0, contributionCap);
  const incomes = (plan.incomes ?? []).slice(0, incomeCap);
  return { ...plan, portfolios, contributions, incomes };
}
