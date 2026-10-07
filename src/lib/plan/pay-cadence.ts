export type PayCadence = "week" | "biweek" | "month";

const PAYS_PER_YEAR: Record<PayCadence, number> = {
  week: 52,
  biweek: 26,
  month: 12,
};

function roundCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function isPayCadence(value: unknown): value is PayCadence {
  return value === "week" || value === "biweek" || value === "month";
}

/** Monthly dollars the engine stores, from the paycheck they typed. */
export function monthlyFromPay(amount: number, cadence: PayCadence): number {
  const pays = PAYS_PER_YEAR[cadence];
  return roundCents((roundCents(amount) * pays) / 12);
}

/** Paycheck to show when the stored figure is monthly. */
export function paycheckFromMonthly(monthly: number, cadence: PayCadence): number {
  const pays = PAYS_PER_YEAR[cadence];
  return roundCents((roundCents(monthly) * 12) / pays);
}

/** Annual total, same rounding as the year box (month × 12). */
export function annualFromPay(amount: number, cadence: PayCadence): number {
  const monthly = monthlyFromPay(amount, cadence);
  return roundCents(roundCents(monthly) * 12);
}
