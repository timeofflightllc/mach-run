import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { BrandLockup } from "@/components/meridian/mach-mark";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";

export const Route = createFileRoute("/account")({ component: Account });

function Account() {
  const { user, isPending } = useCurrentUserState();
  const [name, setName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.primaryEmail ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"profile" | "password" | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.displayName ?? "");
    setEmail(user.primaryEmail ?? "");
  }, [user]);

  if (isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg text-muted">
        Loading account…
      </main>
    );
  }
  if (!user || user.isDevFallback) return <RedirectToSignIn />;

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy("profile");
    setError(null);
    setMsg(null);
    try {
      const nextName = name.trim();
      if (nextName && nextName !== (user?.displayName ?? "")) {
        const { error: err } = await authClient.updateUser({ name: nextName });
        if (err) throw new Error(err.message ?? "Could not update name.");
      }
      const nextEmail = email.trim();
      if (nextEmail && nextEmail !== (user?.primaryEmail ?? "")) {
        const { error: err } = await authClient.changeEmail({
          newEmail: nextEmail,
        });
        if (err) throw new Error(err.message ?? "Could not update email.");
      }
      setMsg("Profile saved. If you changed email, check that inbox to confirm.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setBusy("password");
    setError(null);
    setMsg(null);
    try {
      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters.");
      }
      const { error: err } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (err) {
        throw new Error(
          err.message ??
            "Could not change password. If you signed in with Google or X, change it there.",
        );
      }
      setCurrentPassword("");
      setNewPassword("");
      setMsg("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg">
      <div className="mx-auto w-full max-w-lg space-y-8">
        <Link to="/" className="inline-block opacity-90 hover:opacity-100">
          <BrandLockup />
        </Link>
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            Account profile
          </p>
          <h1 className="mt-2 font-display text-3xl text-fg">Your MACH Run identity</h1>
          <p className="mt-2 text-sm text-muted">
            Name and email for this login. Billing is on Manage billing.
          </p>
        </header>

        {error ? <p className="text-sm text-negative">{error}</p> : null}
        {msg ? <p className="text-sm text-muted">{msg}</p> : null}

        <form
          onSubmit={(e) => void saveProfile(e)}
          className="space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]"
        >
          <Field label="Name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" hint="Google / X logins may not let MACH RUN change this.">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <PrimaryButton disabled={busy !== null}>
            {busy === "profile" ? "Saving…" : "Save profile"}
          </PrimaryButton>
        </form>

        <form
          onSubmit={(e) => void savePassword(e)}
          className="space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]"
        >
          <p className="font-display text-lg text-fg">Password</p>
          <p className="text-sm text-muted">
            Only applies if you registered with email. Google and X keep their own
            passwords.
          </p>
          <Field label="Current password">
            <TextInput
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>
          <Field label="New password">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          <PrimaryButton disabled={busy !== null || !currentPassword || !newPassword}>
            {busy === "password" ? "Saving…" : "Update password"}
          </PrimaryButton>
        </form>

        <p className="text-sm text-subtle">
          <Link to="/pricing" className="underline-offset-4 hover:text-fg hover:underline">
            Manage billing
          </Link>
          {" · "}
          <Link to="/" className="underline-offset-4 hover:text-fg hover:underline">
            Back to the engine
          </Link>
        </p>
      </div>
    </main>
  );
}
