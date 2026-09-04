import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BackupPasswordModal } from "@/components/meridian/backup-modal";
import { DeleteAccountModal } from "@/components/meridian/delete-account-modal";
import { BrandLockup } from "@/components/meridian/mach-mark";
import { IdleLockSettings } from "@/components/meridian/idle-lock-settings";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import { startBillingPortal } from "@/lib/billing/api";
import { canDownloadBackup } from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { sendTestSignupAlert, signupAlertStatus, emailPrefsStatus, setOptionalEmails } from "@/lib/notify/api";
import { authClient, signIn, signInWithApple, signOut } from "@/lib/auth/client";
import { deleteMyAccount, getDeleteOptions } from "@/lib/auth/delete-account-api";
import type { DeleteProvider } from "@/lib/auth/delete-account";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import {
  backupFileName,
  decryptPlanBackup,
  encryptPlanBackup,
  triggerBackupDownload,
} from "@/lib/plan/backup-file";
import { clearIdleLockPrefs } from "@/lib/idle-lock";
import { usePlanStore } from "@/lib/plan/store";

export const Route = createFileRoute("/account")({
  validateSearch: (search: Record<string, unknown>) => ({
    delete: search.delete === "1" || search.delete === "true" ? "1" : undefined,
  }),
  component: Account,
});

function Account() {
  const { user, isPending } = useCurrentUserState();
  const deleteReturn = Route.useSearch().delete === "1";
  const ent = useEntitlement();
  const navigate = useNavigate();
  const setPlan = usePlanStore((s) => s.setPlan);
  const resetPlan = usePlanStore((s) => s.reset);
  const [name, setName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.primaryEmail ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"profile" | "password" | "billing" | "alert" | null>(null);
  const [alertOwner, setAlertOwner] = useState(false);
  const [alertReady, setAlertReady] = useState(false);
  const [optionalOk, setOptionalOk] = useState(true);
  const [prefsReady, setPrefsReady] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteHasPassword, setDeleteHasPassword] = useState(true);
  const [deleteProviders, setDeleteProviders] = useState<DeleteProvider[]>([]);
  const [deleteReauthed, setDeleteReauthed] = useState(false);
  const [backupMode, setBackupMode] = useState<"download" | "import" | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupOk = canDownloadBackup(ent.plan);

  useEffect(() => {
    if (!user) return;
    setName(user.displayName ?? "");
    setEmail(user.primaryEmail ?? "");
    void signupAlertStatus()
      .then((s) => {
        setAlertOwner(s.owner);
        setAlertReady(s.configured);
      })
      .catch(() => {
        setAlertOwner(false);
      });
    void emailPrefsStatus()
      .then((p) => {
        setOptionalOk(p.optionalOk);
        setPrefsReady(true);
      })
      .catch(() => {
        setOptionalOk(true);
        setPrefsReady(true);
      });
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#email-preferences") return;
    document.getElementById("email-preferences")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [user, prefsReady]);

  useEffect(() => {
    if (!user || user.isDevFallback) return;
    void getDeleteOptions()
      .then((opts) => {
        setDeleteHasPassword(opts.hasPassword);
        setDeleteProviders(opts.providers);
      })
      .catch(() => {
        setDeleteHasPassword(true);
        setDeleteProviders([]);
      });
  }, [user]);

  useEffect(() => {
    if (!deleteReturn || !user) return;
    setConfirmDelete(true);
    setDeleteReauthed(true);
  }, [deleteReturn, user]);

  if (isPending) {
    return (
      <main className="grid min-h-screen place-items-center text-muted" style={{ backgroundColor: "#0a1835" }}>
        Loading account…
      </main>
    );
  }
  if (!user || user.isDevFallback) return <RedirectToSignIn />;

  async function openBilling() {
    setBusy("billing");
    setError(null);
    setMsg(null);
    try {
      const { url } = await startBillingPortal({
        data: { origin: window.location.origin },
      });
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not open billing. Pick a plan first.",
      );
      setBusy(null);
    }
  }

  function startBackupDownload() {
    if (!backupOk) {
      void navigate({ to: "/pricing" });
      return;
    }
    setBackupError(null);
    setBackupMode("download");
  }

  function startBackupImport() {
    if (!backupOk) {
      void navigate({ to: "/pricing" });
      return;
    }
    fileRef.current?.click();
  }

  async function onBackupConfirm(password: string) {
    setBackupBusy(true);
    setBackupError(null);
    try {
      if (backupMode === "download") {
        const live = usePlanStore.getState().plan;
        const text = await encryptPlanBackup("Household", live, password);
        triggerBackupDownload(backupFileName("Household"), text);
        setBackupMode(null);
      } else if (backupMode === "import" && pendingImport) {
        const parsed = await decryptPlanBackup(pendingImport, password);
        setPlan(parsed.plan);
        setPendingImport(null);
        setBackupMode(null);
        setMsg("MACH RUN backup imported.");
      }
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Backup failed.");
    } finally {
      setBackupBusy(false);
    }
  }

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
            "Could not change password. If you signed in with Apple, Google or X, change it there.",
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

  async function toggleOptionalEmails(next: boolean) {
    const prev = optionalOk;
    setOptionalOk(next);
    setError(null);
    try {
      const saved = await setOptionalEmails({ data: { optionalOk: next } });
      setOptionalOk(saved.optionalOk);
      setMsg(next ? "Optional MACH RUN emails are on." : "Optional MACH RUN emails are off.");
    } catch (err) {
      setOptionalOk(prev);
      setError(err instanceof Error ? err.message : "Could not save email preferences.");
    }
  }

  async function startDeleteReauth(providerId: string) {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const dest = `${window.location.origin}/account?delete=1`;
      if (providerId === "apple") await signInWithApple(dest);
      else await signIn(providerId, { callbackURL: dest, errorCallbackURL: dest });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not start sign-in.");
      setDeleteBusy(false);
    }
  }

  async function confirmDeleteAccount(password: string) {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteMyAccount({ data: { password } });
      try {
        clearIdleLockPrefs(user.id);
      } catch {
        /* local only */
      }
      try {
        resetPlan();
        window.localStorage.removeItem("mach-plan-v4");
      } catch {
        /* local only */
      }
      try {
        await signOut("/");
      } catch {
        window.location.href = "/";
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete the account.");
      setDeleteBusy(false);
    }
  }

  async function sendOwnerAlert() {
    setBusy("alert");
    setError(null);
    setMsg(null);
    try {
      await sendTestSignupAlert();
      setMsg("Test signup alert sent. Check the owner inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the test alert.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen px-4 py-10 text-fg" style={{ backgroundColor: "#0a1835" }}>
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <Link to="/" className="inline-block opacity-90 hover:opacity-100">
            <BrandLockup />
          </Link>
          <Link
            to="/"
            className="mt-1 inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
          >
            Exit Account Profile
          </Link>
        </div>
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            Account profile
          </p>
          <h1 className="mt-2 font-display text-3xl text-fg">Your MACH Run identity</h1>
        </header>

        {error ? <p className="text-sm text-negative">{error}</p> : null}
        {msg ? <p className="text-sm text-muted">{msg}</p> : null}

        {alertOwner ? (
          <div className="space-y-2 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
            <p className="font-display text-lg text-fg">Signup alerts</p>
            <p className="text-sm text-muted">
              {alertReady
                ? "This inbox gets an email when someone creates a MACH RUN account. The new user is not copied."
                : "This inbox is marked as the owner, but Resend is not connected yet. Add RESEND_API_KEY and MACH_NOTIFY_EMAIL in Vercel."}
            </p>
            <button
              type="button"
              disabled={busy !== null || !alertReady}
              onClick={() => void sendOwnerAlert()}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated disabled:opacity-60"
            >
              {busy === "alert" ? "Sending…" : "Send a test signup alert"}
            </button>
          </div>
        ) : null}

        <div className="space-y-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void openBilling()}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-60 md:w-auto md:min-w-56"
          >
            {busy === "billing" ? "Opening…" : "Manage billing"}
          </button>
          <p className="text-sm text-muted">
            Card, invoices, and cancel.{" "}
            <Link to="/pricing" className="underline underline-offset-4 hover:text-fg">
              Change plan
            </Link>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch">
        <form
          onSubmit={(e) => void saveProfile(e)}
          className="h-full space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]"
        >
          <Field label="Name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" hint="Apple / Google / X logins may not let MACH RUN change this.">
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

        <div
          id="email-preferences"
          className="h-full space-y-3 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]"
        >
          <p className="font-display text-lg text-fg">Email preferences</p>
          <label className="flex items-start gap-3 text-sm text-fg">
            <input
              type="checkbox"
              checked
              disabled
              className="mt-1 accent-accent"
            />
            <span>
              <span className="font-medium">Required account emails</span>
              <span className="mt-1 block text-muted">
                Sign-in, verify, password, billing, and the first-flight checklist.
                Always on while this account exists.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-fg">
            <input
              type="checkbox"
              checked={optionalOk}
              disabled={!prefsReady}
              onChange={(e) => void toggleOptionalEmails(e.target.checked)}
              className="mt-1 accent-accent"
            />
            <span>
              <span className="font-medium">Optional MACH RUN emails</span>
              <span className="mt-1 block text-muted">
                Product notes and other mail that is not required to run the
                account. Uncheck to stop those.
              </span>
            </span>
          </label>
          <p className="text-sm text-muted">
            We will never sell, give away, or otherwise compromise your email
            and account information at any time, now and in the future.
          </p>
          <p className="text-sm text-subtle">
            To stop required account email, close the account below.
          </p>
        </div>

        <form
          onSubmit={(e) => void savePassword(e)}
          className="h-full space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]"
        >
          <p className="font-display text-lg text-fg">Password</p>
          <p className="text-sm text-muted">
            Only applies if you registered with email. Continue with Apple, Google
            and X keep their own passwords.
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

        <IdleLockSettings userId={user.id} />

        <div className="h-full space-y-2 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
          <p className="font-display text-lg text-fg">Encrypted MACH RUN backup</p>
          {backupOk ? (
            <>
              <p className="text-sm text-muted">
                Download a locked copy of this household. Use a unique backup-file
                password — not your machrun.com sign-in. MACH RUN does not store it.
              </p>
              <button
                type="button"
                onClick={startBackupDownload}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
              >
                Download MACH RUN backup
              </button>
              <button
                type="button"
                onClick={startBackupImport}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
              >
                Import MACH RUN backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".machrun,application/octet-stream"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  void f.text().then((text) => {
                    setPendingImport(text);
                    setBackupError(null);
                    setBackupMode("import");
                  });
                }}
              />
            </>
          ) : (
            <p className="text-sm text-muted">
              Encrypted backup is on Individual Unlimited.{" "}
              <Link to="/pricing" className="underline underline-offset-4 hover:text-fg">
                See plans
              </Link>
            </p>
          )}
        </div>

        <div className="h-full space-y-3 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
          <p className="font-display text-lg text-fg">Close account</p>
          <p className="text-sm leading-relaxed text-muted">
            This is not canceling a paid plan. Closing the account deletes this
            login and all saved MACH RUN information from our servers. That
            cannot be undone.
          </p>
          <button
            type="button"
            disabled={busy !== null || deleteBusy}
            onClick={() => {
              setDeleteError(null);
              setConfirmDelete(true);
            }}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium text-negative shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated disabled:opacity-60"
          >
            Close account and delete all of my information
          </button>
        </div>
        </div>

        <p className="flex justify-center">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
          >
            Back to MACH Run
          </Link>
        </p>
      </div>
      {backupMode ? (
        <BackupPasswordModal
          mode={backupMode}
          busy={backupBusy}
          error={backupError}
          onCancel={() => {
            if (backupBusy) return;
            setBackupMode(null);
            setPendingImport(null);
            setBackupError(null);
          }}
          onConfirm={(password) => void onBackupConfirm(password)}
        />
      ) : null}
      {confirmDelete ? (
        <DeleteAccountModal
          hasPassword={deleteHasPassword}
          providers={deleteProviders}
          reauthed={deleteReauthed}
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => {
            if (deleteBusy) return;
            setConfirmDelete(false);
            setDeleteError(null);
            if (!deleteReturn) setDeleteReauthed(false);
          }}
          onManageBilling={() => void openBilling()}
          onReauth={(providerId) => void startDeleteReauth(providerId)}
          onConfirm={(password) => void confirmDeleteAccount(password)}
        />
      ) : null}
    </main>
  );
}
