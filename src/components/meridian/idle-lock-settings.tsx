import { useEffect, useState, type FormEvent } from "react";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import {
  IDLE_LOCK_MINUTES,
  clearIdleLockPrefs,
  hashIdlePin,
  isIdlePin,
  loadIdleLockPrefs,
  saveIdleLockPrefs,
  writeIdleLocked,
} from "@/lib/idle-lock";

export function IdleLockSettings({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const prefs = loadIdleLockPrefs(userId);
    setEnabled(Boolean(prefs?.enabled && prefs.pinHash));
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#idle-lock") return;
    document.getElementById("idle-lock")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  async function turnOn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (!isIdlePin(pin)) {
      setError("PIN must be 4 to 6 digits.");
      return;
    }
    if (pin !== confirm) {
      setError("PINs do not match.");
      return;
    }
    setBusy(true);
    try {
      const pinHash = await hashIdlePin(userId, pin);
      saveIdleLockPrefs(userId, { enabled: true, pinHash });
      writeIdleLocked(userId, false);
      setEnabled(true);
      setPin("");
      setConfirm("");
      setMsg(
        `Idle lock is on. MACH RUN will cover the numbers after ${IDLE_LOCK_MINUTES} minutes with no mouse or keyboard.`,
      );
    } finally {
      setBusy(false);
    }
  }

  function turnOff() {
    clearIdleLockPrefs(userId);
    setEnabled(false);
    setPin("");
    setConfirm("");
    setError(null);
    setMsg("Idle lock is off.");
  }

  return (
    <form
      id="idle-lock"
      onSubmit={(e) => void turnOn(e)}
      className="space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]"
    >
      <p className="font-display text-lg text-fg">Idle lock</p>
      <p className="text-sm leading-relaxed text-muted">
        This is not another password and not your machrun.com sign-in. It is a
        short PIN that only covers the screen after {IDLE_LOCK_MINUTES} minutes
        of no mouse or keyboard. Off unless you turn it on.
      </p>
      {enabled ? (
        <p className="text-sm font-medium text-fg">
          Idle lock is on ({IDLE_LOCK_MINUTES} minutes).
        </p>
      ) : (
        <p className="text-sm text-subtle">Idle lock is off.</p>
      )}
      <Field label="Idle lock PIN (4–6 digits)">
        <TextInput
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
      </Field>
      <Field label="Confirm PIN">
        <TextInput
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
        />
      </Field>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      {msg ? <p className="text-sm text-muted">{msg}</p> : null}
      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="submit" disabled={busy} className="w-auto">
          {busy ? "Saving…" : enabled ? "Change PIN" : "Turn on idle lock"}
        </PrimaryButton>
        {enabled ? (
          <button
            type="button"
            onClick={turnOff}
            className="h-11 rounded-lg px-4 text-sm font-medium text-muted hover:bg-elevated hover:text-fg"
          >
            Turn off
          </button>
        ) : null}
      </div>
    </form>
  );
}
