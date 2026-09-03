import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { BrandLockup } from "@/components/meridian/mach-mark";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import {
  emailVerifyStatus,
  resendEmailVerifyCode,
  submitEmailVerifyCode,
} from "@/lib/auth/email-verify-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/verify-email")({ component: VerifyEmail });

function VerifyEmail() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "send" | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      window.location.href = "/login";
      return;
    }
    void emailVerifyStatus()
      .then((s) => {
        if (s.verified) navigate({ to: "/" });
      })
      .catch(() => {});
  }, [isPending, user, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy("check");
    setError(null);
    setMsg(null);
    try {
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

  return (
    <main
      className="grid min-h-screen place-items-center px-4 py-12 text-fg"
      style={{ backgroundColor: "#0a1835" }}
    >
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link to="/" className="inline-flex justify-center">
            <BrandLockup size="lg" />
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
              We sent it to {user?.primaryEmail ?? "your inbox"}. This proves
              you can read that mailbox. It is not a password. Codes last 24
              hours — if yours expired, request a new one below.
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
            {busy === "check" ? "Checking…" : "Verify Email"}
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
