import { useState, type FormEvent, type ReactNode } from "react";
import { authClient, rememberBearerIfPreview } from "@/lib/auth/client";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";

export function emailSignInNeedsFactor(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  return (data as { twoFactorRedirect?: boolean }).twoFactorRedirect === true;
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden>
      <path
        fill="currentColor"
        d="M16.37 12.63c.03 3.25 2.85 4.33 2.88 4.35-.02.06-.45 1.55-1.49 3.07-.9 1.31-1.83 2.61-3.3 2.64-1.45.03-1.91-.86-3.57-.86-1.66 0-2.17.83-3.54.89-1.42.06-2.5-1.42-3.41-2.73-1.86-2.68-3.28-7.57-1.37-10.87.95-1.64 2.64-2.68 4.48-2.71 1.4-.03 2.72.94 3.57.94.85 0 2.45-1.17 4.13-.99.7.03 2.68.28 3.95 2.14-.1.06-2.36 1.38-2.33 4.13ZM14.7 5.9c.76-.92 1.27-2.2 1.13-3.47-1.1.04-2.43.73-3.22 1.65-.71.82-1.33 2.14-1.16 3.4 1.22.1 2.48-.62 3.25-1.58Z"
      />
    </svg>
  );
}

export function PasskeyButton({
  disabled,
  busy,
  onClick,
}: {
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#f5f5f7] px-3 py-2 text-sm font-medium text-[#1d1d1f] shadow-[0_0_0_1px_#d2d2d7] hover:bg-white disabled:opacity-50"
    >
      <AppleMark />
      <span className="text-center leading-tight">
        {busy ? "Waiting for this device…" : "Login with Apple Face ID or Touch ID"}
      </span>
    </button>
  );
}

function AppMark({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <li className="flex min-w-0 items-center gap-1.5 rounded-md bg-white px-1.5 py-1 shadow-[0_0_0_1px_var(--color-border)]">
      <span className="grid size-4 shrink-0 place-items-center" aria-hidden>
        {children}
      </span>
      <span className="truncate text-[10px] font-medium leading-none text-[#1a2330]">{name}</span>
    </li>
  );
}

export function AuthenticatorMarks() {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        Works with
      </p>
      <ul className="grid grid-cols-2 gap-1.5">
        <AppMark name="Google Authenticator">
          <svg viewBox="0 0 24 24" className="size-4">
            <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.14H12v4.05h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.44Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.23-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.08v2.59A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.41 13.9A6 6 0 0 1 6.1 12c0-.66.11-1.3.31-1.9V7.51H3.08A10 10 0 0 0 2 12c0 1.61.39 3.14 1.08 4.49l3.33-2.59Z" />
            <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 2.99 14.7 2 12 2A10 10 0 0 0 3.08 7.51l3.33 2.59C7.2 7.74 9.4 5.98 12 5.98Z" />
          </svg>
        </AppMark>
        <AppMark name="Microsoft Authenticator">
          <svg viewBox="0 0 16 16" className="size-3.5">
            <path fill="#F25022" d="M1 1h6.5v6.5H1z" />
            <path fill="#7FBA00" d="M8.5 1H15v6.5H8.5z" />
            <path fill="#00A4EF" d="M1 8.5h6.5V15H1z" />
            <path fill="#FFB900" d="M8.5 8.5H15V15H8.5z" />
          </svg>
        </AppMark>
        <AppMark name="Okta Verify">
          <svg viewBox="0 0 16 16" className="size-3.5">
            <circle cx="8" cy="8" r="7" fill="#007DC1" />
            <circle cx="8" cy="8" r="3.2" fill="#fff" />
          </svg>
        </AppMark>
        <AppMark name="Duo Mobile">
          <svg viewBox="0 0 16 16" className="size-3.5">
            <rect width="16" height="16" rx="3" fill="#6BB33F" />
            <path fill="#fff" d="M3.2 11.2V4.8h2.15c1.55 0 2.45.82 2.45 2.05 0 1.22-.9 2.05-2.45 2.05H4.7v2.3H3.2Zm1.5-3.35h.55c.72 0 1.15-.36 1.15-.95s-.43-.95-1.15-.95H4.7v1.9Zm4.15 3.35 1.55-2.35L8.4 4.8h1.7l.85 1.55.9-1.55h1.6l-1.6 2.35 1.7 2.7h-1.75l-1-1.7-.95 1.7H8.85Z" />
          </svg>
        </AppMark>
        <AppMark name="1Password">
          <svg viewBox="0 0 16 16" className="size-3.5">
            <rect width="16" height="16" rx="3" fill="#0572EC" />
            <path fill="#fff" d="M5.1 11.4V4.6h1.35v5.35h2.7v1.45H5.1Z" />
          </svg>
        </AppMark>
        <AppMark name="Authy">
          <svg viewBox="0 0 16 16" className="size-3.5">
            <circle cx="8" cy="8" r="7" fill="#EC1C24" />
            <path fill="#fff" d="M8 3.2 9.15 6.6h3.55l-2.85 2.1 1.1 3.4L8 10.05 5.05 12.1l1.1-3.4-2.85-2.1h3.55L8 3.2Z" />
          </svg>
        </AppMark>
      </ul>
    </div>
  );
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
      <div className="space-y-1">
        <p className="text-base font-medium text-fg">Confirm this sign-in</p>
        <p className="text-sm leading-snug text-muted">
          Use the passkey on this device, or type the six-digit code from the authenticator app you already paired.
        </p>
      </div>
      <PasskeyButton busy={busy} onClick={() => void onPasskey()} />
      <p className="text-center text-xs text-subtle">or the app you paired</p>
      <AuthenticatorMarks />
      <form onSubmit={(e) => void onCode(e)} className="space-y-4">
        <Field label={backup ? "Backup code" : "Six-digit code from the app"}>
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
            className="max-w-none"
            placeholder={backup ? "xxxxx-xxxxx" : "000000"}
          />
        </Field>
        {error ? <p className="text-sm text-negative">{error}</p> : null}
        <PrimaryButton type="submit" disabled={busy || !code.trim()} className="w-full whitespace-nowrap">
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
