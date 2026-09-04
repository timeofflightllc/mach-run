import { useState, type FormEvent } from "react";
import { Field, TextInput } from "@/components/ui/field";
import { DELETE_ACCOUNT_CONFIRM, type DeleteProvider } from "@/lib/auth/delete-account";

export function DeleteAccountModal({
  hasPassword,
  providers,
  reauthed,
  busy,
  error,
  onCancel,
  onReauth,
  onConfirm,
}: {
  hasPassword: boolean;
  providers: DeleteProvider[];
  reauthed: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onReauth: (providerId: string) => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const ready = hasPassword ? password.length > 0 : reauthed;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    onConfirm(hasPassword ? password : "");
  }

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl bg-elevated p-5 shadow-[0_0_0_1px_var(--color-border)]"
      >
        <p id="delete-account-title" className="font-display text-lg text-fg">
          Cancel account
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This deletes the login, saved MACH RUN, billing record on file, and
          email preferences. It cannot be undone.
        </p>

        {hasPassword ? (
          <div className="mt-4">
            <p className="mb-3 text-sm leading-relaxed text-muted">
              Type your MACH RUN password to prove you mean it.
            </p>
            <Field label="Password">
              <TextInput
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </Field>
          </div>
        ) : providers.length > 0 ? (
          <div className="mt-4 space-y-3">
            {reauthed ? (
              <p className="text-sm leading-relaxed text-muted">
                Identity confirmed. Click below to delete everything.
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-muted">
                  This login uses Apple, Google, or X. Sign in again with the
                  same provider, then confirm.
                </p>
                <div className="flex flex-col gap-2">
                  {providers.map((p) => (
                    <button
                      key={p.providerId}
                      type="button"
                      disabled={busy}
                      onClick={() => onReauth(p.providerId)}
                      className="h-11 rounded-lg px-4 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-surface disabled:opacity-50"
                    >
                      Continue with {p.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Set a MACH RUN password on this page first, then delete the account.
          </p>
        )}

        {error ? <p className="mt-3 text-sm text-negative">{error}</p> : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="submit"
            disabled={!ready || busy}
            className="h-auto min-h-11 rounded-lg bg-[#e8c547] px-4 py-2.5 text-sm font-medium leading-snug text-[#1a1408] disabled:opacity-50"
          >
            {busy ? "Deleting…" : DELETE_ACCOUNT_CONFIRM}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-11 rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface hover:text-fg"
          >
            Keep my account
          </button>
        </div>
      </form>
    </div>
  );
}
