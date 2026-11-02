import { getSql } from "@/lib/db";
import { addCalendarMonths, checkoutWasPaid, priceInterval, renewalWasPulledBack } from "./checkout";

type InviteRow = {
  status: string;
  kind: string;
  bonus_until: Date | string | null;
};

function priceLists(): { year: string[]; month: string[] } {
  const year = [
    process.env.STRIPE_PRICE_YEARLY,
    process.env.STRIPE_PRICE_UNLIMITED_YEARLY,
    process.env.STRIPE_PRICE_ADVISOR_YEARLY,
    process.env.STRIPE_PRICE_ADVISOR_UNLIMITED_YEARLY,
  ].filter((id): id is string => Boolean(id));
  const month = [
    process.env.STRIPE_PRICE_MONTHLY,
    process.env.STRIPE_PRICE_UNLIMITED_MONTHLY,
    process.env.STRIPE_PRICE_ADVISOR_MONTHLY,
    process.env.STRIPE_PRICE_ADVISOR_UNLIMITED_MONTHLY,
  ].filter((id): id is string => Boolean(id));
  return { year, month };
}

/** The personal invite is still open. A campaign code and a used invite are not. */
export async function personalInviteOpen(userId: string): Promise<boolean> {
  try {
    const sql = await getSql();
    const rows = await sql.query<InviteRow>(
      `select s.status, c.kind, s.bonus_until
       from mach_referral_signups s
       join mach_referral_codes c on c.code = s.code
       where s.new_user_id = $1
       limit 1`,
      [userId],
    );
    const row = rows[0];
    return row?.kind === "personal" && row.status === "signed-up";
  } catch {
    return false;
  }
}

/**
 * First checkout only. Monthly closes the invite. A paid yearly personal
 * invite moves the renewal two calendar months out. A campaign code does neither.
 * Failure leaves the subscription row alone.
 */
export async function settleReferralCheckout(input: {
  userId: string;
  subscriptionId: string | null;
  priceId: string | null;
  periodEnd: Date | null;
  paymentStatus?: string | null;
  subscriptionStatus?: string | null;
}): Promise<void> {
  const interval = priceInterval(input.priceId, priceLists().year, priceLists().month);
  if (!interval || !input.subscriptionId) return;
  const sql = await getSql();
  if (interval === "month") {
    await sql.query(
      `update mach_referral_signups s
       set status = 'chose-monthly'
       from mach_referral_codes c
       where s.code = c.code
         and c.kind = 'personal'
         and s.new_user_id = $1
         and s.status = 'signed-up'`,
      [input.userId],
    );
    return;
  }
  if (!checkoutWasPaid({ paymentStatus: input.paymentStatus, subscriptionStatus: input.subscriptionStatus })) {
    return;
  }
  try {
    const { noteCampaignYearly } = await import("./credit.server");
    await noteCampaignYearly(input.userId);
  } catch (err) {
    console.warn("[referral] campaign count failed:", err instanceof Error ? err.message : err);
  }
  if (!input.periodEnd) return;
  const bonusUntil = addCalendarMonths(input.periodEnd, 2);
  const claimed = await sql.query<{ id: string }>(
    `update mach_referral_signups s
     set status = 'yearly', bonus_until = $2
     from mach_referral_codes c
     where s.code = c.code
       and c.kind = 'personal'
       and s.new_user_id = $1
       and s.status = 'signed-up'
     returning s.id`,
    [input.userId, bonusUntil],
  );
  if (!claimed[0]) return;
  try {
    const { getStripe } = await import("@/lib/billing/stripe.server");
    const stripe = await getStripe();
    await stripe.subscriptions.update(input.subscriptionId, {
      trial_end: Math.floor(bonusUntil.getTime() / 1000),
      proration_behavior: "none",
    });
    await sql.query(
      `update mach_subscriptions
       set current_period_end = $2, updated_at = now()
       where user_id = $1`,
      [input.userId, bonusUntil],
    );
    try {
      const { grantReferralCredit } = await import("./credit.server");
      await grantReferralCredit(claimed[0].id);
    } catch (err) {
      console.warn("[referral] credit was not recorded:", err instanceof Error ? err.message : err);
    }
  } catch (err) {
    await sql.query(
      `update mach_referral_signups
       set status = 'signed-up', bonus_until = null
       where new_user_id = $1 and status = 'yearly' and bonus_until = $2`,
      [input.userId, bonusUntil],
    );
    console.warn("[referral] could not extend the renewal:", err instanceof Error ? err.message : err);
  }
}

/** Put a granted renewal back if a later plan change moved it earlier. */
export async function keepReferralRenewal(input: {
  userId: string;
  subscriptionId: string;
  periodEnd: Date | null;
  status: string;
}): Promise<void> {
  if (input.status === "canceled") return;
  const sql = await getSql();
  const rows = await sql.query<{ bonus_until: Date | string | null }>(
    `select s.bonus_until
     from mach_referral_signups s
     join mach_referral_codes c on c.code = s.code
     where s.new_user_id = $1
       and c.kind = 'personal'
       and s.bonus_until is not null
     limit 1`,
    [input.userId],
  );
  const raw = rows[0]?.bonus_until;
  if (!raw) return;
  const bonusUntil = raw instanceof Date ? raw : new Date(raw);
  if (!renewalWasPulledBack(bonusUntil, input.periodEnd)) return;
  const { getStripe } = await import("@/lib/billing/stripe.server");
  const stripe = await getStripe();
  await stripe.subscriptions.update(input.subscriptionId, {
    trial_end: Math.floor(bonusUntil.getTime() / 1000),
    proration_behavior: "none",
  });
  await sql.query(
    `update mach_subscriptions
     set current_period_end = $2, updated_at = now()
     where user_id = $1`,
    [input.userId, bonusUntil],
  );
}
