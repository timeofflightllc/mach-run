import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BackupPasswordModal } from "@/components/meridian/backup-modal";
import {
  backupFileName,
  decryptPlanBackup,
  encryptPlanBackup,
  triggerBackupDownload,
} from "@/lib/plan/backup-file";
import { useProfileStore } from "@/lib/plan/profile-store";
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
  const [renameId, setRenameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [backupMode, setBackupMode] = useState<"download" | "import" | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
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
    setOpen(false);
  }

  function startExport() {
    if (!canDownloadBackup(ent.plan)) {
      void navigate({ to: "/pricing" });
      return;
    }
    setBackupError(null);
    setBackupMode("download");
    setOpen(false);
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
        const text = await encryptPlanBackup(label, live, password);
        triggerBackupDownload(backupFileName(label), text);
        void import("@/lib/ops/activity-api").then(({ pingActivity }) => {
          pingActivity("backup_download");
        });
        setBackupMode(null);
      } else if (backupMode === "import" && pendingImport) {
        if (atProfileCap(useProfileStore.getState().profiles.length, ent)) return;
        const parsed = await decryptPlanBackup(pendingImport, password);
        const next = useProfileStore
          .getState()
          .importProfile(parsed.name, parsed.plan, usePlanStore.getState().plan);
        setPlan(next);
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
          {capped ? (
            <p className="px-3 py-2 text-xs leading-snug text-[#e8c547]">
              Advisor Lite is 5 profiles. Upgrade to Advisor Unlimited for more.
            </p>
          ) : null}
          <button
            type="button"
            onClick={onAdd}
            disabled={capped}
            className="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface disabled:cursor-not-allowed disabled:text-subtle"
          >
            New profile
          </button>
          <button
            type="button"
            onClick={startExport}
            className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-surface hover:text-fg"
          >
            Export MACH RUN file
          </button>
          <button
            type="button"
            onClick={startImportPicker}
            disabled={capped}
            className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:text-subtle"
          >
            Import MACH RUN file
          </button>
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
        </div>
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
          }}
          onConfirm={(password) => void onBackupConfirm(password)}
        />
      ) : null}
    </div>
  );
}
