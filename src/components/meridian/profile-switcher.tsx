import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BackupPasswordModal } from "@/components/meridian/backup-modal";
import { ClientControlPanel } from "@/components/meridian/client-control-panel";
import {
  backupFileName,
  decryptPlanBackup,
  encryptPlanBackup,
  triggerBackupDownload,
} from "@/lib/plan/backup-file";
import { saveMachPlan } from "@/lib/plan/plan-api";
import { MACH_PROFILE_REMOVED, useProfileStore } from "@/lib/plan/profile-store";
import { usePlanStore } from "@/lib/plan/store";
import type { Entitlement } from "@/lib/billing/limits";
import { canDownloadBackup, isAdvisorPlan } from "@/lib/billing/limits";
import { atProfileCap } from "@/lib/billing/use-entitlement";

export function canUseProfiles(ent: Entitlement): boolean {
  return Boolean(ent.signedIn && isAdvisorPlan(ent.plan));
}

export function ProfileSwitcher({ ent }: { ent: Entitlement }) {
  const allowed = canUseProfiles(ent);
  const navigate = useNavigate();
  const setPlan = usePlanStore((s) => s.setPlan);
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const [open, setOpen] = useState(false);
  const [backupMode, setBackupMode] = useState<"download" | "import" | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [exportId, setExportId] = useState<string | null>(null);
  const [deleteAfterExport, setDeleteAfterExport] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
  const capped = atProfileCap(profiles.length, ent);

  function onSwitch(id: string) {
    const next = useProfileStore.getState().switchTo(id, usePlanStore.getState().plan);
    if (next) setPlan(next);
    setOpen(false);
  }

  function onAdd() {
    if (atProfileCap(useProfileStore.getState().profiles.length, ent)) return;
    const next = useProfileStore.getState().addProfile(usePlanStore.getState().plan);
    setPlan(next);
    persistLibrary(next);
    setOpen(false);
  }

  function startExport(id?: string) {
    if (!canDownloadBackup(ent.plan)) {
      setDeleteAfterExport(null);
      void navigate({ to: "/pricing" });
      return;
    }
    setBackupError(null);
    setExportId(id ?? useProfileStore.getState().activeId);
    setBackupMode("download");
    setOpen(false);
  }

  function persistLibrary(plan = usePlanStore.getState().plan) {
    void saveMachPlan({ data: useProfileStore.getState().asLibrary(plan) }).catch(() => {
      /* local store already updated */
    });
  }

  async function commitDelete(id: string) {
    const store = useProfileStore.getState();
    const snapshot = {
      profiles: store.profiles.map((p) => ({ ...p })),
      activeId: store.activeId,
    };
    const currentPlan = usePlanStore.getState().plan;
    const next = store.remove(id, currentPlan);
    if (!next) return;
    setPlan(next);
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const saved = await saveMachPlan({
        data: useProfileStore.getState().asLibrary(next),
      });
      if (!saved || saved.ok !== true) throw new Error("save failed");
      window.dispatchEvent(new CustomEvent(MACH_PROFILE_REMOVED, { detail: { id } }));
      const left = useProfileStore.getState().profiles.length;
      void import("@/lib/ops/activity-api").then(({ pingActivity }) => {
        pingActivity("profile_delete", { profiles: left });
      });
      if (left <= 1) setPanelOpen(false);
    } catch {
      useProfileStore.setState(snapshot);
      const restored = snapshot.profiles.find((p) => p.id === snapshot.activeId);
      if (restored) setPlan(restored.plan);
      setDeleteError("Could not save the library. That client is still here.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function onDeleteClient(id: string, opts?: { backupFirst?: boolean }) {
    if (opts?.backupFirst) {
      setDeleteAfterExport(id);
      startExport(id);
      return;
    }
    void commitDelete(id);
  }

  function startImportPicker() {
    if (!canDownloadBackup(ent.plan)) {
      void navigate({ to: "/pricing" });
      return;
    }
    fileRef.current?.click();
  }

  async function onBackupConfirm(password: string) {
    setBackupBusy(true);
    setBackupError(null);
    try {
      if (backupMode === "download") {
        const live = usePlanStore.getState().plan;
        useProfileStore.getState().snapshotCurrent(live);
        const targetId = exportId ?? useProfileStore.getState().activeId;
        const target =
          useProfileStore.getState().profiles.find((p) => p.id === targetId) ??
          useProfileStore.getState().profiles.find((p) => p.id === useProfileStore.getState().activeId);
        const name = target?.name ?? label;
        const plan = target && target.id !== useProfileStore.getState().activeId ? target.plan : live;
        const text = await encryptPlanBackup(name, plan, password);
        triggerBackupDownload(backupFileName(name), text);
        void import("@/lib/ops/activity-api").then(({ pingActivity }) => {
          pingActivity("backup_download");
        });
        setBackupMode(null);
        const pendingDelete = deleteAfterExport;
        setDeleteAfterExport(null);
        if (pendingDelete) void commitDelete(pendingDelete);
      } else if (backupMode === "import" && pendingImport) {
        if (atProfileCap(useProfileStore.getState().profiles.length, ent)) return;
        const parsed = await decryptPlanBackup(pendingImport, password);
        const next = useProfileStore
          .getState()
          .importProfile(parsed.name, parsed.plan, usePlanStore.getState().plan);
        setPlan(next);
        persistLibrary(next);
        void import("@/lib/ops/activity-api").then(({ pingActivity }) => {
          pingActivity("backup_import");
        });
        setPendingImport(null);
        setBackupMode(null);
      }
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Backup failed.");
    } finally {
      setBackupBusy(false);
    }
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
            <button
              key={p.id}
              type="button"
              onClick={() => onSwitch(p.id)}
              className={`block w-full truncate px-3 py-2 text-left text-sm ${
                p.id === activeId ? "text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {p.name}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setPanelOpen(true);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface"
          >
            Client Control Panel
          </button>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept=".machrun,application/octet-stream"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          void f.text().then((text) => {
            setPendingImport(text);
            setBackupError(null);
            setBackupMode("import");
            setOpen(false);
          });
        }}
      />

      {panelOpen ? (
        <ClientControlPanel
          profiles={profiles}
          activeId={activeId}
          cap={ent.profileLimit}
          capped={capped}
          onClose={() => setPanelOpen(false)}
          onRename={(id, name) => {
            useProfileStore.getState().rename(id, name);
            persistLibrary();
          }}
          onExport={(id) => startExport(id)}
          onDelete={onDeleteClient}
          onAdd={onAdd}
          onImport={startImportPicker}
          deleteBusy={deleteBusy}
          deleteError={deleteError}
        />
      ) : null}

      {backupMode ? (
        <BackupPasswordModal
          mode={backupMode}
          busy={backupBusy}
          error={backupError}
          onCancel={() => {
            if (backupBusy) return;
            setBackupMode(null);
            setPendingImport(null);
            setBackupError(null);
            setDeleteAfterExport(null);
          }}
          onConfirm={(password) => void onBackupConfirm(password)}
        />
      ) : null}
    </div>
  );
}
