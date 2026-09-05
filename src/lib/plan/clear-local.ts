import { clearAllStoredRuns } from "./last-run";
import { useProfileStore } from "./profile-store";
import { usePlanStore } from "./store";

const PLAN_KEY = "mach-plan-v4";
const PROFILE_KEY = "mach-profiles-v1";
const RUN_KEY = "mach-last-run-v1";

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
    window.localStorage.removeItem(RUN_KEY);
  } catch {
    /* quota / private mode */
  }
  try {
    window.dispatchEvent(new Event("mach-reset-baseline"));
  } catch {
    /* no window listeners */
  }
}
