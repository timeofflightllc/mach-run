import { clonePlan, createDefaultPlan } from "./defaults";
import type { PlanLibrary } from "./profile-store";
import type { Plan } from "./types";

export function planWeight(p: Plan | null | undefined): number {
  if (!p) return 0;
  const inc = (p.incomes ?? []).reduce(
    (s, i) => s + (i.monthlyAmount || i.ssPia || 0),
    0,
  );
  const assets = (p.portfolios ?? []).reduce((s, x) => s + (x.currentValue || 0), 0);
  return inc * 12 + assets;
}

/**
 * Advisor library: the on-screen plan is always the active profile.
 * Never pick a heavier local leftover from a different client — that
 * was copying Client 2 into Test on the first autosave after load.
 *
 * Single-household (no library): keep the heavier of cloud vs local.
 */
export function pickDisplayedPlan(args: {
  local: Plan;
  cloudPlan: Plan | null;
  library: PlanLibrary | null;
}): Plan {
  const lib = args.library;
  if (lib && lib.profiles.length > 0) {
    const row =
      lib.profiles.find((p) => p.id === lib.activeId) ?? lib.profiles[0];
    return clonePlan(row.plan);
  }
  if (args.cloudPlan && planWeight(args.cloudPlan) >= planWeight(args.local)) {
    return clonePlan(args.cloudPlan);
  }
  return args.local;
}

/**
 * What a signed-in account should see.
 * A new account has no cloud plan. It gets a blank household.
 * It never inherits a leftover local plan from a different account.
 * Demo data is loaded only by the hero button, never here.
 */
export function planForSignedInUser(args: {
  local: Plan;
  cloudPlan: Plan | null;
  library: PlanLibrary | null;
  /** True when this browser just switched from another account. */
  switchedAccount: boolean;
}): Plan {
  const lib = args.library;
  if (lib && lib.profiles.length > 0) {
    return pickDisplayedPlan(args);
  }
  if (!args.cloudPlan) return createDefaultPlan();
  if (args.switchedAccount) return clonePlan(args.cloudPlan);
  return pickDisplayedPlan({ ...args, library: null });
}
