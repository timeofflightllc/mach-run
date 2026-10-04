import { paidFromStatus } from "./limits.ts";

export const DESK_TRIAL_MIN_DAYS = 1;
export const DESK_TRIAL_MAX_DAYS = 730;

export type DeskTrialUnit = "days" | "months";

export type DeskTrialLength =
  | { ok: true; days: number }
  | { ok: false; error: string };

/** Months are 30 days. Stripe accepts trial_period_days only, from 1 through 730. */
export function deskTrialDays(length: number, unit: DeskTrialUnit): DeskTrialLength {
  if (!Number.isInteger(length)) {
    return { ok: false, error: "Trial length must be a whole number of days or months." };
  }
  const days = unit === "months" ? length * 30 : length;
  if (days < DESK_TRIAL_MIN_DAYS || days > DESK_TRIAL_MAX_DAYS) {
    const span =
      unit === "months"
        ? `${length} months is ${days} days.`
        : `${days} days is outside the allowed range.`;
    return {
      ok: false,
      error: `${span} Stripe allows ${DESK_TRIAL_MIN_DAYS} to ${DESK_TRIAL_MAX_DAYS} days.`,
    };
  }
  return { ok: true, days };
}

export function deskTrialIdempotencyKey(userId: string, trialDays: number, now = new Date()): string {
  return `desk-unlimited-trial-${userId}-${now.toISOString().slice(0, 10)}-${trialDays}`;
}

export function deskTrialSubscriptionParams(input: {
  customerId: string;
  priceId: string;
  userId: string;
  trialDays: number;
}): {
  customer: string;
  items: Array<{ price: string }>;
  trial_period_days: number;
  trial_settings: { end_behavior: { missing_payment_method: "cancel" } };
  metadata: { userId: string; package: "unlimited"; deskTrial: string };
} {
  return {
    customer: input.customerId,
    items: [{ price: input.priceId }],
    trial_period_days: input.trialDays,
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    metadata: {
      userId: input.userId,
      package: "unlimited",
      deskTrial: String(input.trialDays),
    },
  };
}

/** Null when the desk may start a trial. */
export function deskTrialBlocked(input: {
  hasEmail: boolean;
  advisorGrant: boolean;
  stripeSubscriptionId: string | null;
  status: string | null;
}): string | null {
  if (!input.hasEmail) return "This account has no email. A trial needs an email.";
  if (input.advisorGrant) {
    return "This seat is an advisor grant. Do not start a desk trial on it.";
  }
  if (input.stripeSubscriptionId && paidFromStatus(input.status)) {
    return "This person already has a live Stripe subscription. Use Set package instead.";
  }
  return null;
}

export function formatDeskTrialEnd(iso: string | null | undefined): string {
  if (!iso) return "the date on the account";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
