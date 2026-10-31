import { useState, type FormEvent } from "react";
import { Field, TextInput } from "@/components/ui/field";
import { DELETE_ACCOUNT_CONFIRM, type DeleteProvider } from "@/lib/auth/delete-account";
import { authClient, rememberBearerIfPreview } from "@/lib/auth/client";

export function DeleteAccountModal({
  hasPassword,
  needsFactor,
  providers,
  reauthed,
  busy,
  error,
  onCancel,
  onManageBilling,
  onReauth,
  onConfirm,
}: {
  hasPassword: boolean;
  needsFactor: boolean;
  providers: DeleteProvider[];
  reauthed: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onManageBilling: () => void;
  onReauth: (providerId: string) => void;
  onConfirm: (password: string, factor: { code: string; backup: boolean; passkey: boolean }) => void;
}) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [passkeyOk, setPasskeyOk] = useState(false);
  const [factorError, setFactorError] = useState<string | null>(null);
  const factorReady = !needsFactor || passkeyOk || (backup ? code.trim().length > 0 : code.length === 6);
  const ready = (hasPassword ? password.length > 0 : reauthed) && factorReady;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    onConfirm(hasPassword ? password : "", {
      code: passkeyOk ? "" : code.trim(),
      backup,
      passkey: passkeyOk,
    });
  }

  async function onPasskey() {
    setFactorError(null);
    try {
      const result = await authClient.signIn.passkey();
      const token =
        result && "data" in result && result.data && "session" in result.data
          ? String((result.data.session as { token?: string } | undefined)?.token ?? "")
          : "";
      if (!token) {
        setFactorError("This device has no passkey for this account.");
        return;
      }
      rememberBearerIfPreview(token);
      setPasskeyOk(true);
    } catch {
      setFactorError("This device has no passkey for this account.");
    }
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
        className="w-full max-w-lg rounded-xl bg-elevated p-5 shadow-[0_0_0_1px_var(--color-border)]"
      >
        <p id="delete-account-title" className="font-display text-lg text-fg">
          Close account
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This is not canceling a credit-card plan — to do that,{" "}
          <button
            type="button"
            onClick={onManageBilling}
            className="whitespace-nowrap underline underline-offset-4 hover:text-fg"
          >
            click here.
          </button>{" "}
          {hasPassword
            ? "Type your password below and select Yes, delete ALL of my information. This cannot be undone."
            : "Confirm below and select Yes, delete ALL of my information. This cannot be undone."}{" "}
          That deletes the login, saved MACH RUN, billing record on file, and
          email preferences from our servers.
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

        {needsFactor ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm leading-relaxed text-muted">
              This advisor sign-in check is on. Enter a current code, or use Face ID or this device.
            </p>
            {passkeyOk ? (
              <p className="text-sm text-fg">This device confirmed.</p>
            ) : (
              <>
                <Field label={backup ? "Backup code" : "Authenticator code"}>
                  <TextInput
                    value={code}
                    onChange={(e) =>
                      setCode(backup ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode={backup ? "text" : "numeric"}
                    autoComplete="one-time-code"
                  />
                </Field>
                <button
                  type="button"
                  className="text-sm text-fg underline underline-offset-4"
                  onClick={() => void onPasskey()}
                >
                  Use Face ID or this device
                </button>
                <button
                  type="button"
                  className="block text-sm text-muted underline underline-offset-4"
                  onClick={() => {
                    setBackup((v) => !v);
                    setCode("");
                  }}
                >
                  {backup ? "Use a six-digit code" : "Use a backup code"}
                </button>
              </>
            )}
            {factorError ? <p className="text-sm text-negative">{factorError}</p> : null}
          </div>
        ) : null}

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
