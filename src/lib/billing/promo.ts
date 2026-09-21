import {
  EAGLE_PROMO_CODE,
  INVERTED_PROMO_CODE,
  MARVIN_PROMO_CODE,
  MARVIN_PROMO_DAYS,
  TRIAL_PROMO_CODE,
  TRIAL_PROMO_DAYS,
  normalizePromoCode,
  promoAppliesToPackage,
  trialDaysForCode,
  type CheckoutPackage,
} from "./limits";

export const CHECKOUT_PACKAGES: CheckoutPackage[] = [
  "individual",
  "unlimited",
  "advisor_lite",
  "advisor",
];

export const PACKAGE_LABEL: Record<CheckoutPackage, string> = {
  individual: "Individual",
  unlimited: "Individual Unlimited",
  advisor_lite: "Advisor Lite",
  advisor: "Advisor Unlimited",
};

export type PromoKind = "trial_days" | "percent_off";

export type PromoRecord = {
  code: string;
  kind: PromoKind;
  trialDays: number | null;
  percentOff: number | null;
  packages: CheckoutPackage[];
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  builtin: boolean;
  note: string;
  stripeCouponId: string | null;
  used: number;
  activeUsers: number;
  activeEmails: string[];
};

export type PromoFail = "unknown" | "inactive" | "not_started" | "expired" | "wrong_package";

export type PromoEval =
  | { ok: true; promo: PromoRecord }
  | { ok: false; reason: PromoFail; message: string };

const FAIL_MESSAGE: Record<PromoFail, string> = {
  unknown: "That code isn't valid.",
  inactive: "That code is turned off.",
  not_started: "That code is not active yet.",
  expired: "That code has ended.",
  wrong_package: "That code is not for this package.",
};

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function builtinPackages(code: string): CheckoutPackage[] {
  return CHECKOUT_PACKAGES.filter((pkg) => promoAppliesToPackage(code, pkg));
}

export function builtinPromo(code: string): PromoRecord | null {
  const id = normalizePromoCode(code);
  const days = trialDaysForCode(id);
  if (!id || days == null) return null;
  return {
    code: id,
    kind: "trial_days",
    trialDays: days,
    percentOff: null,
    packages: builtinPackages(id),
    startsAt: null,
    endsAt: null,
    active: true,
    builtin: true,
    note:
      id === TRIAL_PROMO_CODE
        ? `${TRIAL_PROMO_DAYS} days on any paid package.`
        : `${MARVIN_PROMO_DAYS} days of Individual Unlimited (${MARVIN_PROMO_CODE} / ${INVERTED_PROMO_CODE} / ${EAGLE_PROMO_CODE}).`,
    stripeCouponId: null,
    used: 0,
    activeUsers: 0,
    activeEmails: [],
  };
}

export function builtinPromoList(): PromoRecord[] {
  const seen = new Set<string>();
  const out: PromoRecord[] = [];
  for (const code of [TRIAL_PROMO_CODE, MARVIN_PROMO_CODE, INVERTED_PROMO_CODE, EAGLE_PROMO_CODE]) {
    if (seen.has(code)) continue;
    seen.add(code);
    const row = builtinPromo(code);
    if (row) out.push(row);
  }
  return out;
}

export function evaluatePromo(
  promo: PromoRecord | null,
  pkg: CheckoutPackage | null,
  now = new Date(),
): PromoEval {
  if (!promo) return { ok: false, reason: "unknown", message: FAIL_MESSAGE.unknown };
  if (!promo.active) return { ok: false, reason: "inactive", message: FAIL_MESSAGE.inactive };
  const today = utcDay(now);
  if (promo.startsAt && today < promo.startsAt) {
    return { ok: false, reason: "not_started", message: FAIL_MESSAGE.not_started };
  }
  if (promo.endsAt && today > promo.endsAt) {
    return { ok: false, reason: "expired", message: FAIL_MESSAGE.expired };
  }
  if (pkg && !promo.packages.includes(pkg)) {
    return { ok: false, reason: "wrong_package", message: FAIL_MESSAGE.wrong_package };
  }
  return { ok: true, promo };
}

export function sanitizePromoCode(raw: string): string {
  return normalizePromoCode(raw).replace(/[^A-Z0-9-]/g, "");
}

export function promoCodeOk(code: string): boolean {
  return /^[A-Z0-9-]{3,24}$/.test(code);
}

export function packagesFromFlags(flags: {
  individual?: boolean;
  unlimited?: boolean;
  advisor_lite?: boolean;
  advisor?: boolean;
}): CheckoutPackage[] {
  return CHECKOUT_PACKAGES.filter((pkg) => Boolean(flags[pkg]));
}

export function describePromo(promo: PromoRecord): string {
  const who =
    promo.packages.length === CHECKOUT_PACKAGES.length
      ? "all paid packages"
      : promo.packages.map((p) => PACKAGE_LABEL[p]).join(", ") || "no packages";
  if (promo.kind === "percent_off") {
    return `${promo.percentOff ?? 0}% off first invoice · ${who}`;
  }
  return `${promo.trialDays ?? 0} days free · ${who}`;
}
