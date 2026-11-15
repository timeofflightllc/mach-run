/** 50 points is $5. The last choice is whatever is left. */
export const REWARD_APPLY_STEP = 50;

export function rewardApplyChoices(balance: number): number[] {
  if (!Number.isInteger(balance) || balance <= 0) return [];
  if (balance < REWARD_APPLY_STEP) return [balance];
  const choices: number[] = [];
  for (let points = REWARD_APPLY_STEP; points < balance; points += REWARD_APPLY_STEP) {
    choices.push(points);
  }
  choices.push(balance);
  return choices;
}

export function rewardApplyAllowed(balance: number, points: number): boolean {
  return rewardApplyChoices(balance).includes(points);
}

/** 10 points is $1. */
export function rewardDollars(points: number): string {
  const dollars = points / 10;
  if (!Number.isFinite(dollars)) return "$0";
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function rewardAppliedLine(points: number): string {
  return `Applied ${points} points. That is ${rewardDollars(points)} off your next bill.`;
}

export const REWARD_NEEDS_PLAN =
  "A paid plan has to be on this account before points can come off a bill.";
