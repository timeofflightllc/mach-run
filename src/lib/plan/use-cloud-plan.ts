import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadMachPlan, saveMachPlan } from "./plan-api";
import { usePlanStore } from "./store";
import { useProfileStore } from "./profile-store";
import type { Plan } from "./types";

function planWeight(p: Plan | null | undefined): number {
  if (!p) return 0;
  const inc = (p.incomes ?? []).reduce(
    (s, i) => s + (i.monthlyAmount || i.ssPia || 0),
    0,
  );
  const assets = (p.portfolios ?? []).reduce((s, x) => s + (x.currentValue || 0), 0);
  return inc * 12 + assets;
}

function payloadToSave(plan: Plan) {
  const lib = useProfileStore.getState();
  if (lib.profiles.length > 1) {
    return lib.asLibrary(plan);
  }
  return plan;
}

export function useCloudPlan() {
  const { user, isPending } = useCurrentUserState();
  const plan = usePlanStore((s) => s.plan);
  const setPlan = usePlanStore((s) => s.setPlan);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "guest">("guest");
  const [cloudReady, setCloudReady] = useState(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (isPending) return;
    if (!userId) {
      setCloudReady(false);
      setStatus("guest");
      return;
    }
    let cancelled = false;
    setCloudReady(false);
    void loadMachPlan()
      .then((saved) => {
        if (cancelled) return;
        const local = usePlanStore.getState().plan;
        const cloudPlan = saved && typeof saved === "object" && "plan" in saved ? saved.plan : saved;
        const library =
          saved && typeof saved === "object" && "library" in saved ? saved.library : null;
        if (library) useProfileStore.getState().hydrateLibrary(library);
        if (cloudPlan && planWeight(cloudPlan) >= planWeight(local)) {
          setPlan(cloudPlan);
        }
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
      void saveMachPlan({ data: payloadToSave(plan) })
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
