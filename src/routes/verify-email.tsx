import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
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
import { afterAuthHref, registerForPlanHref, verifySearch } from "@/lib/billing/checkout-intent";
import { writeActPlace } from "@/lib/act-place";
import { clearAllStoredRuns } from "@/lib/plan/last-run";
import { armQuizOpen, holdQuizPlan, quizPlan, type QuizAnswers } from "@/lib/plan/quiz-plan";
import { useProfileStore } from "@/lib/plan/profile-store";
import { usePlanStore } from "@/lib/plan/store";
import { pageHead } from "@/lib/seo";

const PENDING_EMAIL = "mach-pending-email";
const PENDING_PASSWORD = "mach-pending-password";

const quizOpenFlights = new Map<
  string,
  Promise<{ ok: true; quiz?: { password: string; answers: QuizAnswers | null } } | { ok: false; reason: string }>
>();

export const Route = createFileRoute("/verify-email")({
  head: () =>
    pageHead({
      title: "Verify your MACH RUN email address | MACH RUN",
      description: "Enter the code sent to your email.",
      path: "/verify-email",
      noindex: true,
    }),
  validateSearch: (search: Record<string, unknown>) => verifySearch(search),
  component: VerifyEmail,
});

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
  const search = Route.useSearch();
  const next = afterAuthHref(search);
  const backToRegister =
    search.package && search.interval
      ? registerForPlanHref(search.package, search.interval)
      : "/login?mode=up";
  const { user, isPending } = useCurrentUserState();
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "send" | null>(null);
  const [opening, setOpening] = useState(false);

  async function openFromLink(email: string, code: string) {
    const key = `${email}:${code}`;
    let flight = quizOpenFlights.get(key);
    if (!flight) {
      flight = completePendingSignup({ data: { email, code, password: "" } });
      quizOpenFlights.set(key, flight);
    }
    const result = await flight;
    if (!result.ok) {
      quizOpenFlights.delete(key);
      throw new Error(result.reason);
    }
    if (result.quiz?.answers) {
      const plan = quizPlan(result.quiz.answers);
      holdQuizPlan(plan);
      armQuizOpen();
      clearAllStoredRuns();
      writeActPlace(null);
      usePlanStore.getState().setPlan(plan);
      useProfileStore.getState().hydrateFromPlan(plan);
    }
    if (result.quiz?.password) {
      const { error: err } = await authClient.signIn.email({
        email,
        password: result.quiz.password,
        callbackURL: "/",
      });
      if (err) throw new Error(err.message ?? "Account created. Sign in.");
    }
    clearPending();
    window.location.href = "/";
  }

  useEffect(() => {
    const p = readPending();
    setPendingEmail(search.email || p.email);
    setPendingPassword(search.choose === "1" ? "" : p.password);
    if (search.code) setCode(search.code);
    setReady(true);
  }, [search.email, search.code, search.choose]);

  useEffect(() => {
    if (!ready || isPending) return;
    if (pendingEmail && !user) return;
    if (!user) {
      window.location.href = backToRegister;
      return;
    }
    void emailVerifyStatus()
      .then((s) => {
        if (s.verified) {
          window.location.href = next;
          return;
        }
        void ensureEmailVerifyCode().catch(() => {});
      })
      .catch(() => {});
  }, [ready, isPending, user, pendingEmail, next, backToRegister]);

  const waitingOnPending = Boolean(pendingEmail && !user);
  const choosePassword = search.choose === "1";

  useEffect(() => {
    if (!ready || !choosePassword || !pendingEmail || !search.code || user) return;
    setOpening(true);
    setError(null);
    void openFromLink(pendingEmail, search.code).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not open that MACH RUN.");
      setOpening(false);
    });
  }, [ready, choosePassword, pendingEmail, search.code, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy("check");
    setError(null);
    setMsg(null);
    try {
      if (waitingOnPending) {
        if (choosePassword) {
          setOpening(true);
          await openFromLink(pendingEmail, code || search.code || "");
          return;
        }
        const result = await completePendingSignup({
          data: { email: pendingEmail, code, password: "" },
        });
        if (!result.ok) {
          setError(result.reason);
          return;
        }
        if (pendingPassword) {
          const { error: err } = await authClient.signIn.email({
            email: pendingEmail,
            password: pendingPassword,
            callbackURL: next,
          });
          if (err) throw new Error(err.message ?? "Account created. Sign in.");
        }
        clearPending();
        window.location.href = next;
        return;
      }
      const result = await submitEmailVerifyCode({ data: { code } });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      window.location.href = next;
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
    <main className="flex min-h-screen flex-col bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full">
        <PageMast ornament={false} />
      </div>
      <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-lg space-y-8">
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-5 rounded-2xl bg-surface p-6 shadow-[0_0_0_1px_var(--color-border)] sm:p-8"
        >
          <header className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
              Verify email
            </p>
            <h1 className="font-display text-3xl text-fg">
              {choosePassword ? "Open your MACH RUN" : "Enter the 6-digit code"}
            </h1>
            <p className="text-sm text-fg">
              {choosePassword ? (
                <>
                  Your sketch is saved{inbox ? <> for <span className="font-medium">{inbox}</span></> : null}.
                </>
              ) : (
                <>
                  Sent to <span className="font-medium">{inbox}</span>.
                </>
              )}
            </p>
            <p className="text-sm text-muted">
              {choosePassword
                ? "The account is not created until this link is opened. The link lasts 24 hours."
                : "Your MACH RUN account is not created until this is accepted. That helps us ensure bots don't flood our registration system and website. The link lasts 24 hours."}
            </p>
            {waitingOnPending ? (
              <a
                href={choosePassword ? "/start" : backToRegister}
                className="inline-block text-sm text-[#e8c547] underline decoration-[#e8c547]/70 underline-offset-2"
              >
                {choosePassword ? "Wrong address? Start again." : "Wrong address? Go back and fix it."}
              </a>
            ) : null}
          </header>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          {msg ? <p className="text-sm text-muted">{msg}</p> : null}
          {choosePassword && search.code ? null : (
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
          )}
          {choosePassword ? (
            <p className="text-sm text-muted">{opening ? "Opening your MACH RUN…" : "This opens the sketch. No password on this screen."}</p>
          ) : null}
          <PrimaryButton type="submit" disabled={busy !== null || opening || (!choosePassword && code.length !== 6)}>
            {opening || busy === "check" ? "Opening…" : choosePassword ? "Open your MACH RUN" : "Create my account"}
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
      </div>
      <MachFooter staticInset />
    </main>
  );
}
