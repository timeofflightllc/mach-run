import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import {
  FREE_ACCOUNT_LIMIT,
  FREE_CONTRIBUTION_LIMIT,
  FREE_INCOME_LIMIT,
  clampPlan,
} from "@/lib/billing/limits";
import { pickDisplayedPlan } from "./cloud-hydrate";
import { clearLocalMachRunWorkspace } from "./clear-local";
import { loadMachPlan, saveMachPlan } from "./plan-api";
import { usePlanStore } from "./store";
import { useProfileStore } from "./profile-store";
import type { Plan } from "./types";

function payloadToSave(plan: Plan, profileId?: string) {
  const lib = useProfileStore.getState();
  if (lib.profiles.length > 1) {
    return lib.asLibraryFor(plan, profileId ?? lib.activeId);
  }
  return plan;
}

/** Always pair the live household with the profile on screen. Never mix. */
function payloadFromLiveStores() {
  const live = usePlanStore.getState().plan;
  const { activeId } = useProfileStore.getState();
  return payloadToSave(live, activeId);
}

export function useCloudPlan() {
  const { user, isPending } = useCurrentUserState();
  const ent = useEntitlement();
  const plan = usePlanStore((s) => s.plan);
  const setPlan = usePlanStore((s) => s.setPlan);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "guest">("guest");
  const [cloudReady, setCloudReady] = useState(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!ent.signedIn || ent.paid) return;
    const current = usePlanStore.getState().plan;
    const view = clampPlan(current, FREE_ACCOUNT_LIMIT, FREE_CONTRIBUTION_LIMIT, FREE_INCOME_LIMIT);
    if (
      view.portfolios.length === current.portfolios.length &&
      view.contributions.length === current.contributions.length &&
      (view.incomes?.length ?? 0) === (current.incomes?.length ?? 0)
    ) {
      return;
    }
    setPlan(view);
  }, [ent.signedIn, ent.paid, plan, setPlan]);

  useEffect(() => {
    if (isPending) return;
    if (!userId) {
      clearLocalMachRunWorkspace();
      setCloudReady(false);
      setStatus("guest");
      return;
    }
    let cancelled = false;
    setCloudReady(false);
    void Promise.all([
      Promise.resolve(usePlanStore.persist.rehydrate()),
      Promise.resolve(useProfileStore.persist.rehydrate()),
    ])
      .then(() => loadMachPlan())
      .then((saved) => {
        if (cancelled) return;
        const local = usePlanStore.getState().plan;
        const cloudPlan =
          saved && typeof saved === "object" && "plan" in saved ? saved.plan : saved;
        const library =
          saved && typeof saved === "object" && "library" in saved ? saved.library : null;
        if (library) useProfileStore.getState().hydrateLibrary(library);
        else if (!useProfileStore.getState().profiles.length) {
          useProfileStore.getState().hydrateFromPlan(local);
        }
        setPlan(
          pickDisplayedPlan({
            local,
            cloudPlan: cloudPlan ?? null,
            library,
          }),
        );
        setCloudReady(true);
        setStatus("saved");
      })
      .catch(() => {
        if (cancelled) return;
        setCloudReady(true);
        setStatus("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, isPending, setPlan]);

  useEffect(() => {
    if (!userId || !cloudReady) return;
    setStatus("saving");
    const t = window.setTimeout(() => {
      void saveMachPlan({ data: payloadFromLiveStores() })
        .then(() => setStatus("saved"))
        .catch(() => setStatus("idle"));
    }, 700);
    return () => window.clearTimeout(t);
  }, [plan, userId, cloudReady]);

  async function saveNow(next?: Plan) {
    if (!userId) return;
    setStatus("saving");
    try {
      const live = next ?? usePlanStore.getState().plan;
      await saveMachPlan({ data: payloadToSave(live) });
      setStatus("saved");
    } catch {
      setStatus("idle");
    }
  }

  return { status, saveNow, signedIn: Boolean(userId) };
}
