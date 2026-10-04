import { clampPlan, FREE_ACCOUNT_LIMIT, FREE_CONTRIBUTION_LIMIT, FREE_INCOME_LIMIT } from "./limits.ts";

export type FreeHoldRow = { id?: string; portfolioId?: string };

export type FreeHoldLists<T extends FreeHoldRow> = {
  portfolios: T[];
  contributions: T[];
  incomes: T[];
};

export type PlanWithFreeHold<T extends FreeHoldRow> = {
  portfolios: T[];
  contributions: T[];
  incomes?: T[];
  freeHold?: FreeHoldLists<T> | null;
};

const ACCOUNT_CAP = FREE_ACCOUNT_LIMIT;
const CONTRIBUTION_CAP = FREE_CONTRIBUTION_LIMIT;
const INCOME_CAP = FREE_INCOME_LIMIT;

function idsOf(rows: FreeHoldRow[]): Set<string> {
  return new Set(rows.map((row) => row.id).filter((id): id is string => Boolean(id)));
}

function partition<T extends FreeHoldRow>(plan: PlanWithFreeHold<T>): {
  visible: FreeHoldLists<T>;
  hidden: FreeHoldLists<T>;
} {
  const existing = plan.freeHold;
  let portfolios = plan.portfolios.slice();
  let hiddenPorts = existing ? existing.portfolios.slice() : [];
  if (!existing) {
    hiddenPorts = portfolios.slice(ACCOUNT_CAP);
    portfolios = portfolios.slice(0, ACCOUNT_CAP);
  } else if (portfolios.length > ACCOUNT_CAP) {
    hiddenPorts = portfolios.slice(ACCOUNT_CAP).concat(hiddenPorts);
    portfolios = portfolios.slice(0, ACCOUNT_CAP);
  }

  let incomes = (plan.incomes ?? []).slice();
  let hiddenIncomes = existing ? existing.incomes.slice() : [];
  if (!existing) {
    hiddenIncomes = incomes.slice(INCOME_CAP);
    incomes = incomes.slice(0, INCOME_CAP);
  } else if (incomes.length > INCOME_CAP) {
    hiddenIncomes = incomes.slice(INCOME_CAP).concat(hiddenIncomes);
    incomes = incomes.slice(0, INCOME_CAP);
  }

  const visiblePortIds = idsOf(portfolios);
  let contributions = plan.contributions.slice();
  let hiddenContributions = existing ? existing.contributions.slice() : [];
  if (!existing) {
    const onVisible = contributions.filter((row) => visiblePortIds.has(row.portfolioId ?? ""));
    const visibleIds = idsOf(onVisible.slice(0, CONTRIBUTION_CAP));
    hiddenContributions = contributions.filter((row) => !row.id || !visibleIds.has(row.id));
    contributions = onVisible.slice(0, CONTRIBUTION_CAP);
  } else if (contributions.length > CONTRIBUTION_CAP) {
    hiddenContributions = contributions.slice(CONTRIBUTION_CAP).concat(hiddenContributions);
    contributions = contributions.slice(0, CONTRIBUTION_CAP);
  }

  return {
    visible: { portfolios, contributions, incomes },
    hidden: {
      portfolios: hiddenPorts,
      contributions: hiddenContributions,
      incomes: hiddenIncomes,
    },
  };
}

function holdOrNull<T extends FreeHoldRow>(
  hidden: FreeHoldLists<T>,
): FreeHoldLists<T> | undefined {
  if (
    hidden.portfolios.length === 0 &&
    hidden.contributions.length === 0 &&
    hidden.incomes.length === 0
  ) {
    return undefined;
  }
  return hidden;
}

function applyWindow<T extends FreeHoldRow>(
  visible: T[],
  hidden: T[],
  incoming: T[],
  cap: number,
  accept?: (row: T) => boolean,
): T[] {
  const visibleIds = idsOf(visible);
  const hiddenIds = idsOf(hidden);
  const kept = incoming.filter((row) => row.id && visibleIds.has(row.id) && !hiddenIds.has(row.id));
  const room = cap - kept.length;
  const added: T[] = [];
  if (room > 0) {
    for (const row of incoming) {
      if (!row.id || visibleIds.has(row.id) || hiddenIds.has(row.id)) continue;
      if (accept && !accept(row)) continue;
      added.push(row);
      if (added.length >= room) break;
    }
  }
  return [...kept, ...added].slice(0, cap);
}

function withoutHold<T extends FreeHoldRow>(plan: PlanWithFreeHold<T>): PlanWithFreeHold<T> {
  const next = { ...plan };
  delete next.freeHold;
  return next;
}

/** What a Free account is allowed to see. The rest stays on the plan, out of this object. */
export function viewForFree<T extends FreeHoldRow>(plan: PlanWithFreeHold<T>): PlanWithFreeHold<T> {
  const { visible } = partition(plan);
  const next = withoutHold(plan);
  next.portfolios = visible.portfolios;
  next.contributions = visible.contributions;
  next.incomes = visible.incomes;
  return next;
}

/** Paid load. Puts the held rows back into the lists the product already uses. */
export function viewForPaid<T extends FreeHoldRow>(plan: PlanWithFreeHold<T>): PlanWithFreeHold<T> {
  const { visible, hidden } = partition(plan);
  const next = withoutHold(plan);
  next.portfolios = [...visible.portfolios, ...hidden.portfolios];
  next.contributions = [...visible.contributions, ...hidden.contributions];
  next.incomes = [...visible.incomes, ...hidden.incomes];
  return next;
}

/**
 * Free saves update only the rows Free can see.
 * Rows past the cap stay on freeHold, including when one of the visible rows is deleted.
 * A paid save that still only knows the visible rows gets the held rows back in the lists.
 * A paid save that includes those rows is the full plan and replaces storage.
 */
export function persistHousehold<T extends FreeHoldRow>(
  stored: PlanWithFreeHold<T> | null,
  incoming: PlanWithFreeHold<T>,
  paid: boolean,
): PlanWithFreeHold<T> {
  if (!stored) {
    return paid ? withoutHold(incoming) : viewForFree(incoming);
  }
  const { visible, hidden } = partition(stored);
  const hiddenIds = new Set<string>([
    ...idsOf(hidden.portfolios),
    ...idsOf(hidden.contributions),
    ...idsOf(hidden.incomes),
  ]);
  const incomingHasHidden = [
    ...incoming.portfolios,
    ...incoming.contributions,
    ...(incoming.incomes ?? []),
  ].some((row) => row.id && hiddenIds.has(row.id));

  if (paid && incomingHasHidden) return withoutHold(incoming);
  if (!paid && incomingHasHidden) {
    const portfolios = applyWindow(
      visible.portfolios,
      hidden.portfolios,
      incoming.portfolios,
      ACCOUNT_CAP,
    );
    const portIds = idsOf(portfolios);
    const contributions = applyWindow(
      visible.contributions,
      hidden.contributions,
      incoming.contributions,
      CONTRIBUTION_CAP,
      (row) => portIds.has(row.portfolioId ?? ""),
    );
    const incomes = applyWindow(
      visible.incomes,
      hidden.incomes,
      incoming.incomes ?? [],
      INCOME_CAP,
    );
    const next = withoutHold(incoming);
    next.portfolios = portfolios;
    next.contributions = contributions;
    next.incomes = incomes;
    const hold = holdOrNull(hidden);
    if (hold) next.freeHold = hold;
    return next;
  }

  const portfolios = applyWindow(
    visible.portfolios,
    hidden.portfolios,
    incoming.portfolios,
    ACCOUNT_CAP,
  );
  const portIds = idsOf(portfolios);
  const contributions = applyWindow(
    visible.contributions,
    hidden.contributions,
    incoming.contributions,
    CONTRIBUTION_CAP,
    (row) => portIds.has(row.portfolioId ?? ""),
  );
  const incomes = applyWindow(
    visible.incomes,
    hidden.incomes,
    incoming.incomes ?? [],
    INCOME_CAP,
  );
  const next = withoutHold({ ...stored, ...incoming });
  if (paid) {
    next.portfolios = [...portfolios, ...hidden.portfolios];
    next.contributions = [...contributions, ...hidden.contributions];
    next.incomes = [...incomes, ...hidden.incomes];
    return next;
  }
  next.portfolios = portfolios;
  next.contributions = contributions;
  next.incomes = incomes;
  const hold = holdOrNull(hidden);
  if (hold) next.freeHold = hold;
  return next;
}

/** Same rows Free is allowed to see. Used when the browser still has the full local copy. */
export function clampToFreeView<T extends { portfolios: unknown[]; contributions: unknown[]; incomes?: unknown[] }>(
  plan: T,
): T {
  return clampPlan(plan, ACCOUNT_CAP, CONTRIBUTION_CAP, INCOME_CAP);
}
