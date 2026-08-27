export const FREE_ACCOUNT_LIMIT = 2;
export const FREE_CONTRIBUTION_LIMIT = 2;
export const FREE_INCOME_LIMIT = 2;
export const MACH_MONTHLY_USD = 4;
export const MACH_YEARLY_USD = 40;

export type Entitlement = {
  signedIn: boolean;
  paid: boolean;
  plan: "free" | "mach";
  interval: "month" | "year" | null;
  accountLimit: number | null;
  contributionLimit: number | null;
  incomeLimit: number | null;
  stripeConfigured: boolean;
  status: string | null;
  periodEnd: string | null;
};

export const GUEST_ENTITLEMENT: Entitlement = {
  signedIn: false,
  paid: false,
  plan: "free",
  interval: null,
  accountLimit: FREE_ACCOUNT_LIMIT,
  contributionLimit: FREE_CONTRIBUTION_LIMIT,
  incomeLimit: FREE_INCOME_LIMIT,
  stripeConfigured: false,
  status: null,
  periodEnd: null,
};

export function paidFromStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
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