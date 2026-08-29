import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createDefaultPlan, ensurePlan } from "./defaults";
import { newId } from "./store";
import type { Plan } from "./types";

export type MachProfile = { id: string; name: string; plan: Plan };

export type PlanLibrary = {
  kind: "library";
  activeId: string;
  profiles: MachProfile[];
};

interface ProfileState {
  profiles: MachProfile[];
  activeId: string;
  hydrateFromPlan: (plan: Plan) => void;
  hydrateLibrary: (lib: PlanLibrary) => void;
  snapshotCurrent: (plan: Plan) => void;
  switchTo: (id: string, currentPlan: Plan) => Plan | null;
  addProfile: (currentPlan: Plan, name?: string) => Plan;
  rename: (id: string, name: string) => void;
  remove: (id: string, currentPlan: Plan) => Plan | null;
  importProfile: (name: string, plan: Plan, currentPlan: Plan) => Plan;
  asLibrary: (currentPlan: Plan) => PlanLibrary;
}

function oneHousehold(plan: Plan): Pick<ProfileState, "profiles" | "activeId"> {
  const id = newId("prof");
  return {
    activeId: id,
    profiles: [{ id, name: "Household", plan: ensurePlan(plan) }],
  };
}

export function isPlanLibrary(raw: unknown): raw is PlanLibrary {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as PlanLibrary;
  return o.kind === "library" && Array.isArray(o.profiles) && typeof o.activeId === "string";
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeId: "",
      hydrateFromPlan: (plan) => {
        const s = get();
        if (s.profiles.length) {
          set({
            profiles: s.profiles.map((p) =>
              p.id === s.activeId ? { ...p, plan: ensurePlan(plan) } : p,
            ),
          });
          return;
        }
        set(oneHousehold(plan));
      },
      hydrateLibrary: (lib) => {
        const profiles = lib.profiles.map((p) => ({
          ...p,
          plan: ensurePlan(p.plan),
        }));
        const activeId =
          profiles.some((p) => p.id === lib.activeId) ? lib.activeId : profiles[0]?.id ?? "";
        set({ profiles, activeId });
      },
      snapshotCurrent: (plan) => {
        const { activeId, profiles } = get();
        if (!activeId || !profiles.length) {
          set(oneHousehold(plan));
          return;
        }
        set({
          profiles: profiles.map((p) =>
            p.id === activeId ? { ...p, plan: ensurePlan(plan) } : p,
          ),
        });
      },
      switchTo: (id, currentPlan) => {
        const { profiles, activeId } = get();
        if (id === activeId) {
          get().snapshotCurrent(currentPlan);
          return null;
        }
        const next = profiles.find((p) => p.id === id);
        if (!next) return null;
        const snapped = profiles.map((p) =>
          p.id === activeId ? { ...p, plan: ensurePlan(currentPlan) } : p,
        );
        set({ profiles: snapped, activeId: id });
        return ensurePlan(next.plan);
      },
      addProfile: (currentPlan, name) => {
        get().snapshotCurrent(currentPlan);
        const id = newId("prof");
        const plan = createDefaultPlan();
        const label = (name ?? "").trim() || `Client ${get().profiles.length + 1}`;
        set({
          profiles: [...get().profiles, { id, name: label, plan }],
          activeId: id,
        });
        return plan;
      },
      rename: (id, name) => {
        const n = name.trim() || "Untitled";
        set({
          profiles: get().profiles.map((p) => (p.id === id ? { ...p, name: n } : p)),
        });
      },
      remove: (id, currentPlan) => {
        const { profiles, activeId } = get();
        if (profiles.length <= 1) return null;
        get().snapshotCurrent(currentPlan);
        const nextList = get().profiles.filter((p) => p.id !== id);
        const nextActive = id === activeId ? nextList[0] : nextList.find((p) => p.id === get().activeId);
        if (!nextActive) return null;
        set({ profiles: nextList, activeId: nextActive.id });
        return ensurePlan(nextActive.plan);
      },
      importProfile: (name, plan, currentPlan) => {
        get().snapshotCurrent(currentPlan);
        const id = newId("prof");
        const next = ensurePlan(plan);
        set({
          profiles: [
            ...get().profiles,
            { id, name: name.trim() || "Imported", plan: next },
          ],
          activeId: id,
        });
        return next;
      },
      asLibrary: (currentPlan) => {
        get().snapshotCurrent(currentPlan);
        const { profiles, activeId } = get();
        return { kind: "library", activeId, profiles };
      },
    }),
    {
      name: "mach-profiles-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ profiles: s.profiles, activeId: s.activeId }),
    },
  ),
);

export function exportProfileBlob(name: string, plan: Plan): string {
  return JSON.stringify(
    { type: "mach-run-profile", version: 1, name, plan: ensurePlan(plan) },
    null,
    2,
  );
}

export function parseProfileBlob(raw: string): { name: string; plan: Plan } | null {
  try {
    const data = JSON.parse(raw) as {
      type?: string;
      name?: string;
      plan?: Plan;
    };
    if (!data?.plan || typeof data.plan !== "object") return null;
    return {
      name: typeof data.name === "string" ? data.name : "Imported",
      plan: ensurePlan(data.plan),
    };
  } catch {
    return null;
  }
}
