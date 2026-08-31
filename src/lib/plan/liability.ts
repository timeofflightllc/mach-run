import {
  mortgagePayoffDate,
  mortgagePaymentDue,
  originalPrincipal,
  remainingMortgage,
} from "./mortgage.ts";
import type { Liability } from "./types.ts";

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
  };
}
