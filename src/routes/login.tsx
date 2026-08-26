import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
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
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10 text-fg">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <Link to="/" className="inline-block">
            <BrandLockup />
          </Link>
          <p className="mt-2 text-xs tracking-[0.14em] text-subtle">
            The Supersonic Financial Calculator from Time Of Flight LLC
          </p>
          <p className="mt-1 text-xs text-subtle">
            Free: save your MACH Run · 2 accounts · 2 contributions · 2 income stages
          </p>
        </div>

        <div className="flex rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--color-border)]">
          <button
            type="button"
            onClick={() => setMode("in")}
            className={`h-10 flex-1 rounded-md text-sm font-medium ${
              mode === "in" ? "bg-accent text-accent-fg" : "text-muted"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("up")}
            className={`h-10 flex-1 rounded-md text-sm font-medium ${
              mode === "up" ? "bg-accent text-accent-fg" : "text-muted"
            }`}
          >
            Register
          </button>
        </div>

        {authEnabled ? (
          <>
            <form onSubmit={(e) => void onEmail(e)} className="space-y-3">
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
              {GROK_PROVIDERS.map((p) => (
                <button
                  key={p.providerId}
                  type="button"
                  onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
                  className="h-11 w-full rounded-lg bg-surface text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
                >
                  Continue with {p.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}

        <p className="text-center text-xs text-subtle">
          <Link to="/pricing" className="underline-offset-4 hover:text-fg hover:underline">
            See MACH pricing
          </Link>
          {" · "}
          <Link to="/" className="underline-offset-4 hover:text-fg hover:underline">
            Continue without an account
          </Link>
          — this browser only.
        </p>
      </div>
    </main>
  );
}
