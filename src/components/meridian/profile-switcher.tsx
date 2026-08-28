import { useEffect, useRef, useState } from "react";
import {
  exportProfileBlob,
  parseProfileBlob,
  useProfileStore,
} from "@/lib/plan/profile-store";
import { usePlanStore } from "@/lib/plan/store";
import type { Entitlement } from "@/lib/billing/limits";

export function canUseProfiles(ent: Entitlement): boolean {
  return Boolean(ent.signedIn && ent.plan === "advisor");
}

export function ProfileSwitcher({ ent }: { ent: Entitlement }) {
  const allowed = canUseProfiles(ent);
  const plan = usePlanStore((s) => s.plan);
  const setPlan = usePlanStore((s) => s.setPlan);
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const [open, setOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.resolve(useProfileStore.persist.rehydrate());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!allowed) return null;
  const active = profiles.find((p) => p.id === activeId);
  const label = active?.name ?? "Profiles";

  function onSwitch(id: string) {
    const next = useProfileStore.getState().switchTo(id, usePlanStore.getState().plan);
    if (next) setPlan(next);
    setOpen(false);
  }

  function onAdd() {
    const next = useProfileStore.getState().addProfile(usePlanStore.getState().plan);
    setPlan(next);
    setOpen(false);
  }

  function onExport() {
    const live = usePlanStore.getState().plan;
    useProfileStore.getState().snapshotCurrent(live);
    const blob = new Blob([exportProfileBlob(label, live)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${label.replace(/[^\w.-]+/g, "_") || "mach-run"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setOpen(false);
  }

  function onImportFile(file: File) {
    void file.text().then((text) => {
      const parsed = parseProfileBlob(text);
      if (!parsed) return;
      const next = useProfileStore
        .getState()
        .importProfile(parsed.name, parsed.plan, usePlanStore.getState().plan);
      setPlan(next);
      setOpen(false);
    });
  }

  return (
    <div ref={root} className="relative z-[80]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 max-w-[10rem] items-center gap-1 truncate rounded-lg px-2 text-sm font-medium text-fg hover:bg-surface sm:max-w-[14rem]"
      >
        <span className="truncate">{label}</span>
        <span className="text-subtle" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 z-[80] mt-1 w-[16rem] rounded-lg bg-elevated py-1 shadow-[0_0_0_1px_var(--color-border)]">
          <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
            MACH RUN profiles
          </p>
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-1 px-1">
              {renameId === p.id ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => {
                    useProfileStore.getState().rename(p.id, nameDraft);
                    setRenameId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      useProfileStore.getState().rename(p.id, nameDraft);
                      setRenameId(null);
                    }
                  }}
                  className="m-1 h-9 w-full rounded bg-bg px-2 text-sm text-fg"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSwitch(p.id)}
                  className={`flex-1 truncate px-2 py-2 text-left text-sm ${
                    p.id === activeId ? "text-fg" : "text-muted hover:text-fg"
                  }`}
                >
                  {p.name}
                </button>
              )}
              <button
                type="button"
                className="px-1 text-xs text-subtle hover:text-fg"
                onClick={() => {
                  setRenameId(p.id);
                  setNameDraft(p.name);
                }}
              >
                Rename
              </button>
            </div>
          ))}
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={onAdd}
            className="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface"
          >
            New profile
          </button>
          <button
            type="button"
            onClick={onExport}
            className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-surface hover:text-fg"
          >
            Export MACH RUN file
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-surface hover:text-fg"
          >
            Import MACH RUN file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
