export const REFERRAL_COUPON_MESSAGE =
  "This invite adds 2 months to a yearly plan. A coupon cannot be used with it.";

export function referralCouponRefusal(input: {
  personalOpen: boolean;
  interval: "month" | "year";
  promoCode: string;
}): string | null {
  if (!input.personalOpen || input.interval !== "year") return null;
  if (!input.promoCode.trim()) return null;
  return REFERRAL_COUPON_MESSAGE;
}

/** A personal yearly invite is charged in full. No coupon field on that session. */
export function personalYearlyInvite(personalOpen: boolean, interval: "month" | "year"): boolean {
  return personalOpen && interval === "year";
}

export function checkoutWasPaid(input: {
  paymentStatus?: string | null;
  subscriptionStatus?: string | null;
}): boolean {
  if (input.paymentStatus === "paid") return true;
  if (input.paymentStatus === "unpaid" || input.paymentStatus === "no_payment_required") return false;
  return input.subscriptionStatus === "active";
}

export function priceInterval(
  priceId: string | null | undefined,
  yearlyIds: readonly string[],
  monthlyIds: readonly string[],
): "month" | "year" | null {
  if (!priceId) return null;
  if (yearlyIds.includes(priceId)) return "year";
  if (monthlyIds.includes(priceId)) return "month";
  return null;
}

/** Two calendar months past the renewal Stripe already set. */
export function addCalendarMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCMonth(next.getUTCMonth() + months);
  if (next.getUTCDate() !== day) next.setUTCDate(0);
  return next;
}

/** True when a later change moved the renewal earlier than the granted date. */
export function renewalWasPulledBack(bonusUntil: Date, incoming: Date | null, now = new Date()): boolean {
  if (!incoming) return false;
  if (bonusUntil.getTime() <= now.getTime()) return false;
  return incoming.getTime() + 24 * 60 * 60 * 1000 < bonusUntil.getTime();
}
