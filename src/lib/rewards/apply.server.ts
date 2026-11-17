import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { rewardApplyAllowed, rewardAppliedLine, REWARD_NEEDS_PLAN } from "./apply";
import { rewardBalance, rewardStanding } from "./balance.server";
import type { RewardStanding } from "./standing";

export type ApplyRewardResult =
  | ({ ok: true; line: string } & RewardStanding)
  | { ok: false; error: string };

/**
 * Spend points onto the next Stripe invoice. The redemption row is written
 * first. If Stripe refuses it, that row is deleted and the balance stays.
 */
export async function applyRewardPoints(userId: string, points: number): Promise<ApplyRewardResult> {
  if (!Number.isInteger(points) || points <= 0) {
    return { ok: false, error: "Choose how many points to apply." };
  }
  const { rewardsTermsAccepted } = await import("./acceptance.server");
  if (!(await rewardsTermsAccepted(userId))) {
    return { ok: false, error: "Agree to the Mach Rewards terms before applying points." };
  }
  const sql = await getSql();
  const customers = await sql.query<{ stripe_customer_id: string | null }>(
    `select stripe_customer_id from mach_subscriptions where user_id = $1 limit 1`,
    [userId],
  );
  const customerId = customers[0]?.stripe_customer_id?.trim() || "";
  if (!customerId) return { ok: false, error: REWARD_NEEDS_PLAN };

  const balance = await rewardBalance(userId);
  if (!rewardApplyAllowed(balance, points)) {
    return { ok: false, error: "That amount is not available." };
  }

  const id = randomUUID();
  const cents = points * 10;
  const claimed = await sql.query<{ id: string }>(
    `insert into mach_reward_redemptions (id, user_id, points, cents)
     select $1, $2, $3, $4
     where (
       coalesce((select sum(points) from mach_reward_grants where user_id = $2), 0)
       - coalesce((select sum(points) from mach_reward_redemptions where user_id = $2), 0)
     ) >= $3
     returning id`,
    [id, userId, points, cents],
  );
  if (!claimed[0]) return { ok: false, error: "That amount is not available." };

  try {
    const { getStripe } = await import("@/lib/billing/stripe.server");
    const stripe = await getStripe();
    await stripe.customers.createBalanceTransaction(
      customerId,
      {
        amount: -cents,
        currency: "usd",
        description: "Mach Rewards",
      },
      { idempotencyKey: id },
    );
  } catch (err) {
    await sql.query(`delete from mach_reward_redemptions where id = $1 and user_id = $2`, [id, userId]);
    console.warn("[rewards] apply was reversed:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Those points were not applied. Your balance is unchanged." };
  }

  return { ok: true, ...(await rewardStanding(userId)), line: rewardAppliedLine(points) };
}
