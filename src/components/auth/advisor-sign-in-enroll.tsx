import { useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { authClient, rememberBearerIfPreview } from "@/lib/auth/client";
import { turnOffAdvisorCheckFn } from "@/lib/auth/advisor-mfa-api";
import { SignInFactor, AuthenticatorMarks, PasskeyButton } from "@/components/auth/sign-in-factor";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";

type EnableResult = { totpURI?: string; backupCodes?: string[] };

let enableFlight: {
  userId: string;
  promise: Promise<{ data: EnableResult | null; error: { message?: string } | null }>;
} | null = null;

function startEnable(userId: string, password?: string) {
  if (!password && enableFlight?.userId === userId) return enableFlight.promise;
  const promise = authClient.twoFactor.enable(password ? { password } : {}) as Promise<{
    data: EnableResult | null;
    error: { message?: string } | null;
  }>;
  enableFlight = { userId, promise };
  return promise;
}

function TotpQr({ uri }: { uri: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(uri, { margin: 1, width: 180 }).then((url) => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [uri]);
  if (!src) return null;
  return <img src={src} width={180} height={180} alt="" className="rounded-md bg-white p-2" />;
}

/**
 * Advisor enrollment. Not linked from household signup.
 * Stage 7 is what puts this in front of the client list.
 */
export function AdvisorSignInEnroll({
  alreadyOn = false,
  onEnrolled,
  onTurnedOff,
}: {
  alreadyOn?: boolean;
  onEnrolled?: () => void;
  onTurnedOff?: () => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [passkeyOn, setPasskeyOn] = useState(false);
  const [authenticatorOn, setAuthenticatorOn] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [code, setCode] = useState("");
  const [showOff, setShowOff] = useState(false);
  const [offBackup, setOffBackup] = useState(false);
  const [offCode, setOffCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onTurnedOffRef = useRef(onTurnedOff);
  onTurnedOffRef.current = onTurnedOff;
  const [busy, setBusy] = useState(false);
  const onEnrolledRef = useRef(onEnrolled);
  onEnrolledRef.current = onEnrolled;

  function enrolled() {
    onEnrolledRef.current?.();
  }

  useEffect(() => {
    if (alreadyOn) return;
    let live = true;
    void (async () => {
      const session = await authClient.getSession();
      const userId = session.data?.user?.id ?? "";
      const already = Boolean(
        session.data?.user &&
          (session.data.user as { twoFactorEnabled?: boolean }).twoFactorEnabled,
      );
      if (!live) return;
      if (already) {
        setAuthenticatorOn(true);
        enrolled();
        return;
      }
      const passkeys = await authClient.passkey.listUserPasskeys();
      if (!live) return;
      if (Array.isArray(passkeys.data) && passkeys.data.length > 0) {
        setPasskeyOn(true);
        enrolled();
        return;
      }
      if (!userId) return;
      const started = await startEnable(userId);
      if (!live) return;
      if (started.error || !started.data?.totpURI) {
        const message = started.error?.message ?? "";
        if (/password/i.test(message)) setNeedPassword(true);
        else if (message) setError(message);
        return;
      }
      setUri(started.data.totpURI);
      setCodes(started.data.backupCodes ?? []);
    })();
    return () => {
      live = false;
    };
  }, [alreadyOn]);

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    enableFlight = null;
    const session = await authClient.getSession();
    const userId = session.data?.user?.id ?? "";
    try {
      const started = await startEnable(userId, password);
      if (started.error || !started.data?.totpURI) {
        setError(started.error?.message ?? "That password did not work.");
        return;
      }
      setNeedPassword(false);
      setUri(started.data.totpURI);
      setCodes(started.data.backupCodes ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function onPasskey() {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.passkey.addPasskey({
        name: "This device",
        authenticatorAttachment: "platform",
      });
      if (result && "data" in result && result.data && "id" in result.data && result.data.id) {
        setPasskeyOn(true);
        enrolled();
        return;
      }
    } catch {
      /* The sheet was cancelled. The QR stays. */
    } finally {
      setBusy(false);
    }
  }

  async function onCode(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.replace(/\D/g, "").slice(0, 6);
    if (trimmed.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: trimmed });
      if (result.error || !result.data) {
        setError(result.error?.message ?? "That code did not work.");
        return;
      }
      setAuthenticatorOn(true);
      setShowCodes(true);
      enrolled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function finishOff(kind: "code" | "passkey") {
    await turnOffAdvisorCheckFn({
      data: {
        code: kind === "code" ? offCode.trim() : "",
        backup: kind === "code" && offBackup,
        passkey: kind === "passkey",
      },
    });
    onTurnedOffRef.current?.();
  }

  async function turnOff(kind: "code" | "passkey") {
    setBusy(true);
    setError(null);
    try {
      if (kind === "passkey") {
        const result = await authClient.signIn.passkey();
        const token =
          result && "data" in result && result.data && "session" in result.data
            ? String((result.data.session as { token?: string } | undefined)?.token ?? "")
            : "";
        if (!token) {
          setError("This device has no passkey for this account.");
          return;
        }
        rememberBearerIfPreview(token);
      }
      await finishOff(kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn the check off.");
    } finally {
      setBusy(false);
    }
  }

  if (alreadyOn) {
    return (
      <div className="space-y-4">
        {showOff ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void turnOff("code");
            }}
            className="space-y-3"
          >
            <p className="text-sm text-muted">
              A current code or this device turns the check off.
            </p>
            <Field label={offBackup ? "Backup code" : "Authenticator code"}>
              <TextInput
                className="max-w-none"
                value={offCode}
                onChange={(ev) =>
                  setOffCode(
                    offBackup ? ev.target.value : ev.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                inputMode={offBackup ? "text" : "numeric"}
                autoComplete="one-time-code"
              />
            </Field>
            <PrimaryButton
              type="submit"
              disabled={busy || (offBackup ? !offCode.trim() : offCode.length !== 6)}
              className="w-full whitespace-nowrap"
            >
              {busy ? "Working…" : "Turn the check off"}
            </PrimaryButton>
            <button
              type="button"
              className="text-sm text-fg underline underline-offset-4"
              onClick={() => void turnOff("passkey")}
            >
              Login with Apple Face ID or Touch ID
            </button>
            <button
              type="button"
              className="block text-sm text-muted underline underline-offset-4"
              onClick={() => {
                setOffBackup((v) => !v);
                setOffCode("");
              }}
            >
              {offBackup ? "Use a six-digit code" : "Use a backup code"}
            </button>
            <button
              type="button"
              className="block text-sm text-muted underline underline-offset-4"
              onClick={() => setShowOff(false)}
            >
              Back
            </button>
          </form>
        ) : (
          <>
            <SignInFactor next="/" onDone={() => onEnrolledRef.current?.()} />
            <button
              type="button"
              className="text-sm text-muted underline underline-offset-4"
              onClick={() => setShowOff(true)}
            >
              Turn the check off
            </button>
          </>
        )}
        {error ? <p className="text-sm text-negative">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-center text-2xl font-semibold leading-tight text-fg">
          MACH RUN
          <br />
          Advisor Authentication
        </p>
        <p className="text-sm leading-snug text-muted">
          Advisor Lite and Advisor Heavy require multi-factor authentication (MFA) before a client plan opens. Use one of the methods below. A device passkey or an authenticator app is the standard for a book of clients. MACH RUN does not use text-message codes.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-fg">This Mac, iPhone, or iPad</p>
        <PasskeyButton busy={busy} onClick={() => void onPasskey()} />
        <p className="text-xs leading-snug text-muted">
          The next prompt is from your device. Approving it saves a passkey for MACH RUN. It is not an Apple ID login, and it does not create a six-digit code.
        </p>
      </div>
      {passkeyOn && !authenticatorOn ? (
        <p className="text-sm text-fg">
          This device is paired. A lost device locks the client list until the desk clears it.
        </p>
      ) : null}
      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium text-fg">Or pair an authenticator app</p>
        <p className="text-xs leading-snug text-muted">
          Scan the QR code in one of these apps. The app shows a six-digit code. Type that code below. You do not choose the number.
        </p>
        <AuthenticatorMarks />
      </div>
      {needPassword ? (
        <form onSubmit={(e) => void onPassword(e)} className="space-y-4">
          <Field label="Password">
            <TextInput
              type="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              autoComplete="current-password"
              className="max-w-none"
            />
          </Field>
          <PrimaryButton type="submit" disabled={busy || !password} className="w-full">
            {busy ? "Working…" : "Show the QR code"}
          </PrimaryButton>
        </form>
      ) : null}
      {uri && !showCodes ? (
        <div className="space-y-4">
          <TotpQr uri={uri} />
          <form onSubmit={(e) => void onCode(e)} className="space-y-4">
            <Field label="Six-digit code from the app">
              <TextInput
                value={code}
                onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="max-w-none"
                placeholder="000000"
              />
            </Field>
            <PrimaryButton type="submit" disabled={busy || code.length !== 6} className="w-full">
              {busy ? "Working…" : "Confirm code"}
            </PrimaryButton>
          </form>
        </div>
      ) : !needPassword && !showCodes && !passkeyOn && !error ? (
        <p className="text-sm text-muted">Preparing the QR code…</p>
      ) : null}
      {showCodes ? (
        <div className="space-y-3">
          <p className="text-sm text-fg">Save these backup codes. They are shown once.</p>
          <ul className="space-y-1 font-mono text-sm text-fg">
            {codes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <button
            type="button"
            className="text-sm text-fg underline underline-offset-4"
            onClick={() => {
              setShowCodes(false);
              setCodes([]);
            }}
          >
            I saved these codes
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-negative">{error}</p> : null}
    </div>
  );
}
