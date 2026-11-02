import { clearAllStoredRuns } from "./last-run";
import { useProfileStore } from "./profile-store";
import { usePlanStore } from "./store";

const PLAN_KEY = "mach-plan-v4";
const PROFILE_KEY = "mach-profiles-v1";
const RUN_KEY = "mach-last-run-v1";
const SURVIVAL_KEY = "mach-last-survival-v1";
const OWNER_KEY = "mach-current-user";

/**
 * Guest landing after sign-out must be a blank MACH RUN.
 * Cloud data stays on the account; only this browser copy is wiped.
 */
export function clearLocalMachRunWorkspace() {
  try {
    usePlanStore.getState().reset();
    void usePlanStore.persist.clearStorage();
  } catch {
    /* store may not be hydrated */
  }
  try {
    useProfileStore.getState().resetLibrary();
    void useProfileStore.persist.clearStorage();
  } catch {
    /* store may not be hydrated */
  }
  try {
    clearAllStoredRuns();
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PLAN_KEY);
    window.localStorage.removeItem(PROFILE_KEY);
    window.localStorage.removeItem(OWNER_KEY);
    const keys = Object.keys(window.localStorage);
    for (const key of keys) {
      if (key === RUN_KEY || key.startsWith(`${RUN_KEY}:`) || key === SURVIVAL_KEY || key.startsWith(`${SURVIVAL_KEY}:`)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* quota / private mode */
  }
  try {
    window.dispatchEvent(new Event("mach-reset-baseline"));
  } catch {
    /* no window listeners */
  }
}

/**
 * This browser copy belongs to one account. A different account gets a blank
 * workspace before any cloud plan is read, so a new registration cannot
 * inherit the previous account's numbers.
 * Returns true when the previous owner was someone else (or unknown).
 */
export function claimWorkspaceForUser(userId: string): boolean {
  if (typeof window === "undefined") return true;
  let previous: string | null = null;
  try {
    previous = window.localStorage.getItem(OWNER_KEY);
  } catch {
    return true;
  }
  if (previous === userId) return false;
  clearLocalMachRunWorkspace();
  try {
    window.localStorage.setItem(OWNER_KEY, userId);
  } catch {
    /* private mode: the in-memory reset already happened */
  }
  return true;
}
