import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { BrandLockup } from "@/components/meridian/mach-mark";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import {
  completePendingSignup,
  resendPendingSignup,
} from "@/lib/auth/pending-signup-api";
import {
  emailVerifyStatus,
  ensureEmailVerifyCode,
  resendEmailVerifyCode,
  submitEmailVerifyCode,
} from "@/lib/auth/email-verify-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const PENDING_EMAIL = "mach-pending-email";
const PENDING_PASSWORD = "mach-pending-password";

export const Route = createFileRoute("/verify-email")({ component: VerifyEmail });

function readPending() {
  try {
    return {
      email: window.sessionStorage.getItem(PENDING_EMAIL) ?? "",
      password: window.sessionStorage.getItem(PENDING_PASSWORD) ?? "",
    };
  } catch {
    return { email: "", password: "" };
  }
}

function clearPending() {
  try {
    window.sessionStorage.removeItem(PENDING_EMAIL);
    window.sessionStorage.removeItem(PENDING_PASSWORD);
  } catch {
    /* ignore */
  }
}

function VerifyEmail() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "send" | null>(null);

  useEffect(() => {
    const p = readPending();
    setPendingEmail(p.email);
    setPendingPassword(p.password);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || isPending) return;
    if (pendingEmail && !user) return;
    if (!user) {
      window.location.href = "/login?mode=up";
      return;
    }
    void emailVerifyStatus()
      .then((s) => {
        if (s.verified) navigate({ to: "/" });
        else void ensureEmailVerifyCode().catch(() => {});
      })
      .catch(() => {});
  }, [ready, isPending, user, pendingEmail, navigate]);

  const waitingOnPending = Boolean(pendingEmail && !user);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy("check");
    setError(null);
    setMsg(null);
    try {
      if (waitingOnPending) {
        const result = await completePendingSignup({
          data: { email: pendingEmail, code },
        });
        if (!result.ok) {
          setError(result.reason);
          return;
        }
        if (pendingPassword) {
          const { error: err } = await authClient.signIn.email({
            email: pendingEmail,
            password: pendingPassword,
            callbackURL: "/",
          });
          if (err) throw new Error(err.message ?? "Account created. Sign in.");
        }
        clearPending();
        window.location.href = "/";
        return;
      }
      const result = await submitEmailVerifyCode({ data: { code } });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify.");
    } finally {
      setBusy(null);
    }
  }

  async function onResend() {
    setBusy("send");
    setError(null);
    setMsg(null);
    try {
      if (waitingOnPending) {
        const result = await resendPendingSignup({ data: { email: pendingEmail } });
        if (!result.ok) {
          setError(result.reason);
          return;
        }
        setMsg("A new code is on the way. Check the same inbox.");
        return;
      }
      const result = await resendEmailVerifyCode();
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setMsg(
        result.already
          ? "This email is already verified."
          : "A new code is on the way. Check the same inbox.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend.");
    } finally {
      setBusy(null);
    }
  }

  const inbox = waitingOnPending ? pendingEmail : (user?.primaryEmail ?? "your inbox");

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-12 text-fg">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link to="/" className="inline-flex justify-center">
            <BrandLockup size="lg" framed />
          </Link>
        </div>
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-5 rounded-2xl bg-surface p-6 shadow-[0_0_0_1px_var(--color-border)] sm:p-8"
        >
          <header className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
              Verify email
            </p>
            <h1 className="font-display text-3xl text-fg">Enter the 6-digit code</h1>
            <p className="text-sm text-muted">
              We sent it to {inbox}. Your MACH RUN account is{" "}
              <span className="text-fg">not created until this code is accepted</span>
              . That is how we keep junk registrations out of the user list.
              Codes last 24 hours.
            </p>
          </header>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          {msg ? <p className="text-sm text-muted">{msg}</p> : null}
          <Field label="Verification code">
            <TextInput
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
            />
          </Field>
          <PrimaryButton type="submit" disabled={busy !== null || code.length !== 6}>
            {busy === "check" ? "Checking…" : "Create my account"}
          </PrimaryButton>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void onResend()}
            className="w-full text-center text-sm text-muted underline-offset-2 hover:underline"
          >
            {busy === "send" ? "Sending…" : "Resend code"}
          </button>
        </form>
      </div>
    </main>
  );
}
