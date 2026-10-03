import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, appleSignInEnabled, authClient, authEnabled, signIn, signInWithApple } from "@/lib/auth/client";
import { afterAuthHref, loginSearch, registerForPlanHref } from "@/lib/billing/checkout-intent";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { TurnstileBox, turnstileEnabled } from "@/components/auth/turnstile-box";
import { startPendingSignup } from "@/lib/auth/pending-signup-api";
import { suggestEmailFix } from "@/lib/auth/email-domain-typo";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => loginSearch(search),
  component: Login,
});

function Login() {
  const start = Route.useSearch();
  const next = afterAuthHref(start);
  const retry =
    start.package && start.interval
      ? registerForPlanHref(start.package, start.interval)
      : "/login?mode=up";
  const [mode, setMode] = useState<"in" | "up">(start.mode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [honeypot, setHoneypot] = useState("");
  const [keptTypo, setKeptTypo] = useState<string | null>(null);
  const [typoHold, setTypoHold] = useState(false);

  const suggestion = mode === "up" ? suggestEmailFix(email) : null;
  const holdingTypo = Boolean(
    suggestion && keptTypo !== suggestion.typed.toLowerCase(),
  );

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    if (!authEnabled) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const fix = suggestEmailFix(email);
        if (fix && keptTypo !== fix.typed.toLowerCase()) {
          setTypoHold(true);
          setBusy(false);
          return;
        }
        if (turnstileEnabled() && !captcha) {
          throw new Error("Confirm you’re not a robot before creating an account.");
        }
        const started = await startPendingSignup({
          data: {
            email: email.trim(),
            password,
            name: name.trim() || email.trim(),
            captcha: captcha ?? "",
            honeypot,
          },
        });
        if (!started.ok) {
          setCaptcha(null);
          setCaptchaReset((n) => n + 1);
          throw new Error(started.reason);
        }
        try {
          sessionStorage.setItem("mach-pending-email", email.trim().toLowerCase());
          sessionStorage.setItem("mach-pending-password", password);
        } catch {
          /* private mode */
        }
        const verify = new URLSearchParams();
        if (start.package) verify.set("package", start.package);
        if (start.interval) verify.set("interval", start.interval);
        const qs = verify.toString();
        window.location.href = qs ? `/verify-email?${qs}` : "/verify-email";
        return;
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: next,
        });
        if (err) throw new Error(err.message ?? "Could not sign in.");
      }
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-bg py-10 text-fg">
      <div className="page-gutter mx-auto w-full">
        <PageMast />
      </div>
      <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-lg space-y-8">
        <p className="text-center text-base leading-relaxed text-muted sm:text-lg">
          Free to use with limits. Unlimited is a monthly hop. Pay
          for a year, we throw in two months.
        </p>

        <div className="space-y-6 rounded-2xl bg-surface p-6 shadow-[0_0_0_1px_var(--color-border)] sm:p-8">
          <div className="flex rounded-lg bg-bg p-1 shadow-[0_0_0_1px_var(--color-border)]">
            <button
              type="button"
              onClick={() => {
                setMode("in");
                setCaptcha(null);
              }}
              className={`h-11 flex-1 rounded-md text-sm font-medium ${
                mode === "in" ? "bg-accent text-accent-fg" : "text-muted"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("up");
                setCaptcha(null);
              }}
              className={`h-11 flex-1 rounded-md text-sm font-medium ${
                mode === "up" ? "bg-accent text-accent-fg" : "text-muted"
              }`}
            >
              Register
            </button>
          </div>

          {authEnabled ? (
            <>
              <form onSubmit={(e) => void onEmail(e)} className="space-y-4">
                {mode === "up" ? (
                  <Field label="Name">
                    <TextInput
                      value={name}
                      onChange={(ev) => setName(ev.target.value)}
                      autoComplete="name"
                      placeholder="Your name"
                    />
                  </Field>
                ) : null}
                <Field label="Email">
                  <TextInput
                    type="email"
                    required
                    value={email}
                    onChange={(ev) => {
                      setEmail(ev.target.value);
                      setKeptTypo(null);
                      setTypoHold(false);
                    }}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </Field>
                {holdingTypo && suggestion ? (
                  <p className="text-sm leading-relaxed text-[#e8c547]">
                    {typoHold ? "Not sent yet. " : null}
                    Did you mean {suggestion.email}?{" "}
                    <button
                      type="button"
                      className="font-medium text-[#e8c547] underline decoration-[#e8c547]/70 underline-offset-2"
                      onClick={() => {
                        setEmail(suggestion.email);
                        setKeptTypo(null);
                        setTypoHold(false);
                      }}
                    >
                      Use this address
                    </button>
                    {" · "}
                    <button
                      type="button"
                      className="font-medium text-[#e8c547] underline decoration-[#e8c547]/70 underline-offset-2"
                      onClick={() => setKeptTypo(suggestion.typed.toLowerCase())}
                    >
                      Keep what I typed
                    </button>
                  </p>
                ) : suggestion && keptTypo === suggestion.typed.toLowerCase() ? (
                  <p className="text-sm text-muted">
                    Keeping {suggestion.typed}. Hit Create account to send the code.
                  </p>
                ) : null}
                <Field
                  label="Password"
                  hint={mode === "up" ? "At least 8 characters" : undefined}
                >
                  <TextInput
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                  />
                </Field>
                {mode === "up" ? (
                  <>
                    <label className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
                      Company website
                      <input
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(ev) => setHoneypot(ev.target.value)}
                      />
                    </label>
                    {turnstileEnabled() ? (
                      <TurnstileBox resetKey={captchaReset} onToken={setCaptcha} />
                    ) : null}
                  </>
                ) : null}
                {error ? <p className="text-sm text-negative">{error}</p> : null}
                <PrimaryButton type="submit" disabled={busy} className="w-full">
                  {busy
                    ? "Working…"
                    : mode === "up"
                      ? "Create account"
                      : "Sign in"}
                </PrimaryButton>
              </form>

              <p className="text-center text-xs text-subtle">or</p>

              <div className="space-y-2">
                {appleSignInEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBusy(true);
                      setError(null);
                      void signInWithApple(next, retry).catch((err) => {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Apple sign-in failed.",
                        );
                        setBusy(false);
                      });
                    }}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#f5f5f7] text-sm font-medium text-[#1d1d1f] hover:bg-white"
                  >
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M16.37 12.63c.03 3.25 2.85 4.33 2.88 4.35-.02.06-.45 1.55-1.49 3.07-.9 1.31-1.83 2.61-3.3 2.64-1.45.03-1.91-.86-3.57-.86-1.66 0-2.17.83-3.54.89-1.42.06-2.5-1.42-3.41-2.73-1.86-2.68-3.28-7.57-1.37-10.87.95-1.64 2.64-2.68 4.48-2.71 1.4-.03 2.72.94 3.57.94.85 0 2.45-1.17 4.13-.99.7.03 2.68.28 3.95 2.14-.1.06-2.36 1.38-2.33 4.13ZM14.7 5.9c.76-.92 1.27-2.2 1.13-3.47-1.1.04-2.43.73-3.22 1.65-.71.82-1.33 2.14-1.16 3.4 1.22.1 2.48-.62 3.25-1.58Z"
                      />
                    </svg>
                    Continue with Apple
                  </button>
                ) : null}
                {GROK_PROVIDERS.map((p) => (
                  <button
                    key={p.providerId}
                    type="button"
                    onClick={() => void signIn(p.providerId, { callbackURL: next, errorCallbackURL: retry })}
                    className="h-11 w-full rounded-lg bg-bg text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
                  >
                    Continue with {p.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Sign-in is disabled.</p>
          )}
        </div>

        <p className="text-center text-xs leading-relaxed text-subtle">
          <Link to="/pricing" className="underline-offset-4 hover:text-fg hover:underline">
            See MACH RUN pricing
          </Link>
          {" · "}
          <Link to="/" className="underline-offset-4 hover:text-fg hover:underline">
            Continue without an account
          </Link>
          <span className="block mt-1">this browser only, until you sign in</span>
        </p>
      </div>
      </div>
      <MachFooter />
    </main>
  );
}
