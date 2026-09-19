import { useState } from "react";
import { Field, TextInput } from "@/components/ui/field";
import { checkOpsDeskPasswordFn, deleteOpsAccountFn } from "@/lib/ops/api";
import type { OpsRosterRow } from "@/lib/ops/roster";

export function OpsDeleteAccount({
  row,
  onDeleted,
}: {
  row: OpsRosterRow;
  onDeleted: () => void;
}) {
  const who = row.email ?? row.id;
  const [step, setStep] = useState<"idle" | "password" | "confirm">("idle");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function reset() {
    setStep("idle");
    setPassword("");
    setNote("");
    setBusy(false);
    setErr(null);
  }

  async function checkPassword() {
    if (!password) {
      setErr("Type your desk password to continue.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const result = await checkOpsDeskPasswordFn({ data: { password } });
      if (result.ok) {
        setStep("confirm");
      } else {
        setErr(result.error ?? "That password does not match this desk login.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not check that password.");
    } finally {
      setBusy(false);
    }
  }

  async function wipe() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const result = await deleteOpsAccountFn({
        data: {
          userId: row.id,
          email: row.email ?? "",
          actorPassword: password,
          note,
        },
      });
      if (result.ok) {
        setMsg(result.message);
        onDeleted();
        reset();
      } else {
        setErr(result.error ?? "Could not delete.");
        setStep("password");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete.");
      setStep("password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-negative">Delete account</h3>
      <p className="text-sm text-muted">
        Wipes login, saved MACH RUNs, and the Stripe seat. Confirm with{" "}
        <span className="text-fg">your</span> desk password, then confirm once
        more. No undo. Owner emails cannot be deleted from the desk.
      </p>
      {msg ? <p className="text-sm text-positive">{msg}</p> : null}
      {err ? <p className="text-sm text-negative">{err}</p> : null}

      {step === "idle" ? (
        <button
          type="button"
          disabled={!row.email}
          className="rounded-lg border border-negative/50 px-3 py-2 text-negative disabled:opacity-40"
          onClick={() => {
            setErr(null);
            setMsg(null);
            setStep("password");
          }}
        >
          Delete {who}
        </button>
      ) : null}

      {step === "password" ? (
        <div className="max-w-md space-y-3 rounded-lg bg-elevated p-3">
          <p className="text-sm text-fg">
            Enter the password for the admin account you are signed in as.
          </p>
          <Field label="Your desk password">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void checkPassword();
                }
              }}
            />
          </Field>
          <Field label="Note (optional)">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-negative/50 px-3 py-2 text-negative disabled:opacity-40"
              onClick={() => void checkPassword()}
            >
              {busy ? "Checking…" : "Continue"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-border px-3 py-2 text-muted disabled:opacity-40"
              onClick={reset}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="max-w-md space-y-3 rounded-lg bg-elevated p-3">
          <p className="text-sm text-fg">
            Permanently delete <span className="font-medium">{who}</span>? Login,
            plans, and Stripe seat will be gone. This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-negative/50 px-3 py-2 text-negative disabled:opacity-40"
              onClick={() => void wipe()}
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-border px-3 py-2 text-muted disabled:opacity-40"
              onClick={() => setStep("password")}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
