import type { Plan } from "./types";

/**
 * One signature for the whole plan.
 * Today $ / Future $ is a view toggle (`assumptions.dollars`) and is not an edit.
 */
export function planInputSignature(plan: Plan): string {
  const assumptions = { ...plan.assumptions };
  delete assumptions.dollars;
  return JSON.stringify({ ...plan, assumptions });
}
