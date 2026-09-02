import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BackupPasswordModal } from "@/components/meridian/backup-modal";
import { BrandLockup } from "@/components/meridian/mach-mark";
import { IdleLockSettings } from "@/components/meridian/idle-lock-settings";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import { startBillingPortal } from "@/lib/billing/api";
import { canDownloadBackup } from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { sendTestSignupAlert, signupAlertStatus } from "@/lib/notify/api";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import {
  backupFileName,
  decryptPlanBackup,
  encryptPlanBackup,
  triggerBackupDownload,
} from "@/lib/plan/backup-file";
import { usePlanStore } from "@/lib/plan/store";

export const Route = createFileRoute("/account")({ component: Account });

function Account() {
  const { user, isPending } = useCurrentUserState();
  const ent = useEntitlement();
  const navigate = useNavigate();
  const setPlan = usePlanStore((s) => s.setPlan);
  const [name, setName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.primaryEmail ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"profile" | "password" | "billing" | "alert" | null>(null);
  const [alertOwner, setAlertOwner] = useState(false);
  const [alertReady, setAlertReady] = useState(false);
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
  }, [user]);

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
            Name and email for this login only.
          </p>
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

        <form
          onSubmit={(e) => void saveProfile(e)}
          className="space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]"
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

        <form
          onSubmit={(e) => void savePassword(e)}
          className="space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]"
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

        <div className="space-y-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void openBilling()}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
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

        <div className="space-y-2 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
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

        <IdleLockSettings userId={user.id} />

        <p className="text-sm text-subtle">
          <Link to="/" className="underline-offset-4 hover:text-fg hover:underline">
            Back to the engine
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
    </main>
  );
}
