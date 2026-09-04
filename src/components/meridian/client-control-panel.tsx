import { useState } from "react";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import type { MachProfile } from "@/lib/plan/profile-store";

function namesMatch(typed: string, name: string): boolean {
  return typed.trim().toLowerCase() === name.trim().toLowerCase();
}

export function ClientControlPanel({
  profiles,
  activeId,
  cap,
  capped,
  onClose,
  onRename,
  onExport,
  onDelete,
  onAdd,
  onImport,
  deleteBusy,
  deleteError,
}: {
  profiles: MachProfile[];
  activeId: string;
  cap: number | null;
  capped: boolean;
  onClose: () => void;
  onRename: (id: string, name: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string, opts?: { backupFirst?: boolean }) => void;
  onAdd: () => void;
  onImport: () => void;
  deleteBusy?: boolean;
  deleteError?: string | null;
}) {
  const last = profiles.length <= 1;
  const [renameId, setRenameId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [backupFirst, setBackupFirst] = useState(false);
  const pending = profiles.find((p) => p.id === pendingId) ?? null;
  const canDelete = pending ? namesMatch(typed, pending.name) : false;

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-panel-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-elevated p-5 shadow-[0_0_0_1px_var(--color-border)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="client-panel-title" className="font-display text-lg text-fg">
              Client Control Panel
            </p>
            <p className="mt-1 text-sm text-muted">
              Add, import, export, rename, or delete a client MACH RUN. Delete
              is permanent.
            </p>
            {cap != null ? (
              <p className="mt-2 text-xs text-muted">
                {profiles.length} of {cap} profiles
                {capped ? " — Advisor Lite cap." : ""}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted">{profiles.length} profiles</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleteBusy}
            className="text-sm text-muted hover:text-fg"
          >
            Close
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="rounded-lg bg-surface px-3 py-3 shadow-[0_0_0_1px_var(--color-border)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                {renameId === p.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => {
                      onRename(p.id, draft);
                      setRenameId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onRename(p.id, draft);
                        setRenameId(null);
                      }
                    }}
                    className="h-9 min-w-0 flex-1 rounded bg-bg px-2 text-sm text-fg"
                  />
                ) : (
                  <p className="min-w-0 flex-1 truncate text-sm text-fg">{p.name}</p>
                )}
                {p.id === activeId ? (
                  <span className="rounded bg-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                    Active
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs text-muted hover:text-fg"
                  onClick={() => {
                    setRenameId(p.id);
                    setDraft(p.name);
                    setPendingId(null);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-fg"
                  onClick={() => onExport(p.id)}
                >
                  Export
                </button>
                <button
                  type="button"
                  className="text-xs text-[#e8c547] hover:text-fg disabled:text-subtle"
                  disabled={last}
                  onClick={() => {
                    setPendingId(p.id);
                    setTyped("");
                    setBackupFirst(false);
                    setRenameId(null);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton type="button" disabled={capped} onClick={onAdd}>
            New client
          </PrimaryButton>
          <button
            type="button"
            disabled={capped}
            onClick={onImport}
            className="h-11 rounded-lg px-4 text-sm text-muted hover:text-fg disabled:cursor-not-allowed disabled:text-subtle"
          >
            Import MACH RUN file
          </button>
        </div>
        {capped ? (
          <p className="mt-2 text-xs leading-snug text-[#e8c547]">
            Advisor Lite is 5 profiles. Upgrade to Advisor Unlimited for more.
          </p>
        ) : null}

        {last ? (
          <p className="mt-3 text-xs leading-relaxed text-[#e8c547]">
            Keep at least one MACH RUN. Add a new client first if you want this
            one gone.
          </p>
        ) : null}

        {pending && !last ? (
          <div className="mt-4 rounded-lg bg-surface px-3 py-3 shadow-[0_0_0_1px_#e8c547]">
            <p className="text-sm text-fg">
              Delete <span className="font-medium">{pending.name}</span>? Type
              that name to confirm. This cannot be undone.
            </p>
            <Field className="mt-2" label="Client name">
              <TextInput
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoFocus
                disabled={deleteBusy}
              />
            </Field>
            <label className="mt-3 flex items-start gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1"
                checked={backupFirst}
                disabled={deleteBusy}
                onChange={(e) => setBackupFirst(e.target.checked)}
              />
              <span>
                Download an encrypted backup of this client first, then delete.
              </span>
            </label>
            {deleteError ? (
              <p className="mt-2 text-sm text-[#e8c547]">{deleteError}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton
                type="button"
                disabled={!canDelete || deleteBusy}
                onClick={() => {
                  if (!canDelete || !pending) return;
                  onDelete(pending.id, { backupFirst });
                  if (!backupFirst) {
                    setPendingId(null);
                    setTyped("");
                    setBackupFirst(false);
                  }
                }}
              >
                {deleteBusy
                  ? "Saving…"
                  : backupFirst
                    ? "Backup, then delete"
                    : "Delete this client"}
              </PrimaryButton>
              <button
                type="button"
                className="text-sm text-muted hover:text-fg"
                onClick={() => {
                  setPendingId(null);
                  setTyped("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
