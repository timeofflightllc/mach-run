/** Bump this when the words change. A stored older version asks again. */
export const REWARDS_TERMS_VERSION = "mach-rewards-2026-11-15b";

export const REWARDS_TERMS = [
  "These terms cover Mach Rewards only. The MACH RUN Terms of Service still apply.",
  "Mach Rewards is a loyalty program. Points are a thank-you, not pay, not property, and not a security. They have no cash value. You cannot sell them, transfer them, or turn them into money. When a referral credit is posted, it is a credit on your MACH RUN bill. It is not cash and not an affiliate commission.",
  "You can earn points only for the actions listed on the Mach Rewards page, and only after you join. A Hale demo does not count. MACH RUN decides whether an action counts. We can refuse or reverse points if an account looks shared, bought, or gamed.",
  "One person, one account. Do not refer yourself.",
  "We can change the point values, pause a card, or end the program. If we end it, unused points end with it. A referral credit already posted to your bill stays posted.",
  "Joining is optional. The calculator works without it. This program is not financial, tax, legal, or investment advice.",
];

/** The Terms of Service section. Short on purpose. The join page uses REWARDS_TERMS. */
export function rewardsTermsLegalBlock(): string {
  return `# Mach Rewards {#mach-rewards}

Mach Rewards is optional. Points are a thank-you, not pay and not cash. You cannot sell them, transfer them, or turn them into money. Applied points are a credit on a MACH RUN bill. Points are earned only for the actions on the Mach Rewards page, and only after you join. One person, one account. Do not refer yourself. MACH RUN can refuse or reverse points that look shared, bought, or gamed, change the values, or end the program. Unused points end with it. A credit already posted to a bill stays posted. The rest of these Terms of Service still apply.`;
}
