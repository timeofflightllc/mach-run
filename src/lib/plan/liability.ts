import { monthBefore, monthStart, validIso } from "./dates.ts";
import {
  mortgagePayoffDate,
  mortgagePaymentDue,
  originalPrincipal,
  remainingMortgage,
} from "./mortgage.ts";
import type { Liability, LiabilityKind, Plan, SpendingPhase } from "./types.ts";

function asMortgage(l: Liability) {
  return {
    originationDate: l.originationDate,
    aprPct: l.aprPct,
    monthlyPi: l.monthlyPi,
    termYears: l.termYears,
    includeInSpending: l.includeInSpending,
    associated: true as const,
  };
}

export function remainingLiability(
  l: Liability | null | undefined,
  asOf: string | Date,
): number {
  if (!l || !(l.monthlyPi > 0) || !(l.termYears > 0)) return 0;
  return remainingMortgage(asMortgage(l), asOf);
}

export function liabilityPaymentDue(
  l: Liability | null | undefined,
  asOf: string | Date,
): number {
  if (!l || !l.includeInSpending) return 0;
  return mortgagePaymentDue(asMortgage(l), asOf);
}

export function originalLiability(l: Liability): number {
  if (!(l.monthlyPi > 0) || !(l.termYears > 0)) return 0;
  return originalPrincipal(asMortgage(l));
}

export function liabilityPayoffDate(l: Liability): string | null {
  return mortgagePayoffDate(asMortgage(l));
}

export function emptyLiability(): Liability {
  return {
    id: "",
    name: "",
    kind: "other",
    balance: 0,
    aprPct: 0,
    monthlyPi: 0,
    originationDate: "",
    termYears: 5,
    includeInSpending: false,
    owner: "primary",
    institutionId: null,
    institutionName: "",
  };
}

const KIND_LABEL: Record<LiabilityKind, string> = {
  car: "Car loan",
  student: "Student loan",
  heloc: "HELOC",
  personal: "Personal loan",
  credit_card: "Credit card",
  other: "Liability",
};

/** One spending line for a liability that is included in spending. Null until the loan can be dated. */
export function liabilitySpendingPhase(plan: Plan, l: Liability): SpendingPhase | null {
  if (!l.includeInSpending || !(l.monthlyPi > 0) || !(l.termYears > 0)) return null;
  if (!validIso(l.originationDate)) return null;
  const payoff = liabilityPayoffDate(l);
  const end = payoff ? monthBefore(payoff) : "";
  if (!end) return null;
  const start = monthStart(l.originationDate);
  const endMonth = monthStart(end);
  if (endMonth < start) return null;
  const existing = plan.spending.find((row) => row.liabilityId === l.id);
  return {
    id: existing?.id ?? `sp-lia-${l.id}`,
    liabilityId: l.id,
    label: l.name.trim() || KIND_LABEL[l.kind] || "Liability",
    monthlyAmount: l.monthlyPi,
    startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`,
    endDate: end,
  };
}

/** Keep one spending line per included liability. Other spending is left alone. Same array if nothing changed. */
export function syncLiabilitySpending(plan: Plan): SpendingPhase[] {
  const wanted = new Map<string, SpendingPhase>();
  for (const l of plan.liabilities ?? []) {
    const phase = liabilitySpendingPhase(plan, l);
    if (phase?.liabilityId) wanted.set(phase.liabilityId, phase);
  }
  let changed = false;
  const seen = new Set<string>();
  const next: SpendingPhase[] = [];
  for (const row of plan.spending) {
    if (!row.liabilityId) {
      next.push(row);
      continue;
    }
    const fresh = wanted.get(row.liabilityId);
    if (!fresh) {
      changed = true;
      continue;
    }
    seen.add(row.liabilityId);
    if (
      row.label === fresh.label &&
      row.monthlyAmount === fresh.monthlyAmount &&
      row.startDate === fresh.startDate &&
      row.endDate === fresh.endDate
    ) {
      next.push(row);
    } else {
      changed = true;
      next.push({ ...row, ...fresh, id: row.id });
    }
  }
  for (const [id, fresh] of wanted) {
    if (seen.has(id)) continue;
    changed = true;
    next.push(fresh);
  }
  return changed ? next : plan.spending;
}
