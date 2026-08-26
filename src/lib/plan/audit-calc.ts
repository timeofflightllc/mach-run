/**
 * Independent checker — not the MACH engine.
 * Textbook ordinary-annuity math: the balance grows, then the cash flow hits.
 * Used only to audit simulate().
 */

export function monthlyRateFromAnnual(annual: number): number {
  return (1 + annual) ** (1 / 12) - 1;
}

/** FV after `months` periods of grow-then-deposit. */
export function fvGrowThenDeposit(
  pv: number,
  monthlyR: number,
  months: number,
  pmt: number,
): number {
  if (months <= 0) return pv;
  if (Math.abs(monthlyR) < 1e-15) return pv + pmt * months;
  const growth = (1 + monthlyR) ** months;
  return pv * growth + pmt * ((growth - 1) / monthlyR);
}

/** Grow-then-withdraw a constant amount. Stops at zero. */
export function runDrawdown(
  pv: number,
  monthlyR: number,
  months: number,
  withdraw: number,
): { end: number; depletedMonth: number | null } {
  let bal = pv;
  let depletedMonth: number | null = null;
  for (let i = 0; i < months; i++) {
    bal *= 1 + monthlyR;
    bal -= withdraw;
    if (bal < 1 && depletedMonth == null) depletedMonth = i;
    if (bal < 0) bal = 0;
  }
  return { end: bal, depletedMonth };
}
