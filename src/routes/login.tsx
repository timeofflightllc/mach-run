import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, appleSignInEnabled, authClient, authEnabled, signIn, signInWithApple } from "@/lib/auth/client";
import { BrandLockup } from "@/components/meridian/mach-mark";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    if (!authEnabled) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.trim(),
          callbackURL: "/",
        });
        if (err) throw new Error(err.message ?? "Could not create the account.");
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: "/",
        });
        if (err) throw new Error(err.message ?? "Could not sign in.");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12 text-fg" style={{ backgroundColor: "#0a1835" }}>
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link to="/" className="inline-flex justify-center">
            <BrandLockup size="lg" />
          </Link>
          <p className="mt-3 max-w-sm text-center text-xs leading-relaxed text-subtle">
            Free to use with limits. A cup of coffee a month for unlimited. Pay
            for a year, get two months on us.
          </p>
        </div>

        <div className="space-y-6 rounded-2xl bg-surface p-6 shadow-[0_0_0_1px_var(--color-border)] sm:p-8">
          <div className="flex rounded-lg bg-bg p-1 shadow-[0_0_0_1px_var(--color-border)]">
            <button
              type="button"
              onClick={() => setMode("in")}
              className={`h-11 flex-1 rounded-md text-sm font-medium ${
                mode === "in" ? "bg-accent text-accent-fg" : "text-muted"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("up")}
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
                    onChange={(ev) => setEmail(ev.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="Password" hint="At least 8 characters">
                  <TextInput
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                  />
                </Field>
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
                      void signInWithApple("/").catch((err) => {
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
                    onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
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
    </main>
  );
}
