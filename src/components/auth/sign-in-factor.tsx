import { useState, type FormEvent } from "react";
import { authClient, rememberBearerIfPreview } from "@/lib/auth/client";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";

export function emailSignInNeedsFactor(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  return (data as { twoFactorRedirect?: boolean }).twoFactorRedirect === true;
}

export function SignInFactor({
  next,
  onDone,
}: {
  next: string;
  onDone?: () => void;
}) {
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPasskey() {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.passkey();
      const session =
        result && "data" in result && result.data && "session" in result.data
          ? result.data.session
          : null;
      if (!session) return;
      const token =
        session && typeof session === "object" && "token" in session
          ? String((session as { token?: string }).token ?? "")
          : "";
      rememberBearerIfPreview(token);
      if (onDone) {
        onDone();
        return;
      }
      window.location.href = next;
    } catch {
      /* This device has no passkey. The code box stays. */
    } finally {
      setBusy(false);
    }
  }

  async function onCode(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const result = backup
        ? await authClient.twoFactor.verifyBackupCode({ code: trimmed })
        : await authClient.twoFactor.verifyTotp({ code: trimmed });
      if (result.error || !result.data) {
        setError(result.error?.message ?? "That code did not work.");
        return;
      }
      if (onDone) {
        onDone();
        return;
      }
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onPasskey()}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
      >
        Use Face ID or this device
      </button>
      <form onSubmit={(e) => void onCode(e)} className="space-y-4">
        <Field label={backup ? "Backup code" : "Authenticator code"}>
          <TextInput
            value={code}
            onChange={(ev) =>
              setCode(
                backup
                  ? ev.target.value
                  : ev.target.value.replace(/\D/g, "").slice(0, 6),
              )
            }
            inputMode={backup ? "text" : "numeric"}
            autoComplete="one-time-code"
            placeholder={backup ? "xxxxx-xxxxx" : "000000"}
          />
        </Field>
        {error ? <p className="text-sm text-negative">{error}</p> : null}
        <PrimaryButton type="submit" disabled={busy || !code.trim()} className="w-full">
          {busy ? "Working…" : "Continue"}
        </PrimaryButton>
      </form>
      <button
        type="button"
        className="w-full text-center text-sm text-muted underline-offset-2 hover:underline"
        onClick={() => {
          setBackup((on) => !on);
          setCode("");
          setError(null);
        }}
      >
        {backup ? "Use a six-digit code" : "Use a backup code"}
      </button>
    </div>
  );
}
