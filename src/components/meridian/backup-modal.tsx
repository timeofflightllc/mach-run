import { useState, type FormEvent } from "react";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";

const NOTE =
  "MACH RUN does not keep this password. Forget it, this file is gone. We cannot reset it.";

export function BackupPasswordModal({
  mode,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  mode: "download" | "import";
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const title = mode === "download" ? "Download MACH RUN backup" : "Import MACH RUN backup";

  function submit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!password.trim()) {
      setLocalError("Backup password cannot be empty.");
      return;
    }
    if (mode === "download" && password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    onConfirm(password);
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl bg-elevated p-5 shadow-[0_0_0_1px_var(--color-border)]"
      >
        <p id="backup-modal-title" className="font-display text-lg text-fg">
          {title}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{NOTE}</p>
        <div className="mt-4 space-y-3">
          <Field label="Backup password">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </Field>
          {mode === "download" ? (
            <Field label="Confirm password">
              <TextInput
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          ) : null}
        </div>
        {localError || error ? (
          <p className="mt-3 text-sm text-negative">{localError ?? error}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-11 rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface hover:text-fg"
          >
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={busy} className="w-auto px-4">
            {busy ? "Working…" : mode === "download" ? "Download" : "Import"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
