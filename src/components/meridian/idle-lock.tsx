import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrandLockup } from "@/components/meridian/mach-mark";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  IDLE_LOCK_MS,
  MACH_IDLE_LOCK_NOW,
  hashIdlePin,
  loadIdleLockPrefs,
  readIdleLocked,
  writeIdleLocked,
} from "@/lib/idle-lock";

const ACTIVITY = [
  "pointerdown",
  "keydown",
  "mousemove",
  "scroll",
  "touchstart",
  "wheel",
] as const;

export function IdleLockGate() {
  const { user, isPending } = useCurrentUserState();
  const userId = user && !user.isDevFallback ? user.id : null;
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const last = useRef(Date.now());
  const lockedRef = useRef(false);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    if (!userId) {
      lockedRef.current = false;
      setLocked(false);
      return;
    }
    const prefs = loadIdleLockPrefs(userId);
    const already = Boolean(prefs?.enabled && prefs.pinHash && readIdleLocked(userId));
    lockedRef.current = already;
    setLocked(already);
    last.current = Date.now();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const id = userId;
    function coverNow() {
      const prefs = loadIdleLockPrefs(id);
      if (!prefs?.enabled || !prefs.pinHash) return;
      lockedRef.current = true;
      writeIdleLocked(id, true);
      setPin("");
      setError(null);
      setLocked(true);
    }
    window.addEventListener(MACH_IDLE_LOCK_NOW, coverNow);
    return () => window.removeEventListener(MACH_IDLE_LOCK_NOW, coverNow);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const onActivity = () => {
      if (lockedRef.current) return;
      last.current = Date.now();
    };
    for (const ev of ACTIVITY) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    const tick = window.setInterval(() => {
      if (lockedRef.current) return;
      const prefs = loadIdleLockPrefs(userId);
      if (!prefs?.enabled || !prefs.pinHash) return;
      if (Date.now() - last.current < IDLE_LOCK_MS) return;
      lockedRef.current = true;
      writeIdleLocked(userId, true);
      setPin("");
      setError(null);
      setLocked(true);
    }, 1000);

    return () => {
      for (const ev of ACTIVITY) window.removeEventListener(ev, onActivity);
      window.clearInterval(tick);
    };
  }, [userId]);

  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);

  if (isPending || !userId || !locked) return null;

  async function unlock(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const prefs = loadIdleLockPrefs(userId);
      if (!prefs?.pinHash) {
        writeIdleLocked(userId, false);
        lockedRef.current = false;
        setLocked(false);
        return;
      }
      const hash = await hashIdlePin(userId, pin.trim());
      if (hash !== prefs.pinHash) {
        setError("That PIN does not match.");
        return;
      }
      writeIdleLocked(userId, false);
      last.current = Date.now();
      lockedRef.current = false;
      setPin("");
      setLocked(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] grid place-items-center px-4"
      style={{ backgroundColor: "#0a1835" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-lock-title"
    >
      <form onSubmit={(e) => void unlock(e)} className="w-full max-w-md">
        <BrandLockup />
        <p id="idle-lock-title" className="mt-8 font-display text-2xl text-fg">
          Idle lock
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This PIN only uncovers the screen. It is not your machrun.com sign-in
          and not another account password.
        </p>
        <div className="mt-5">
          <Field label="Idle lock PIN">
            <TextInput
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
          </Field>
        </div>
        {error ? <p className="mt-3 text-sm text-negative">{error}</p> : null}
        <PrimaryButton type="submit" disabled={busy || pin.length < 4} className="mt-5">
          {busy ? "Checking…" : "Uncover"}
        </PrimaryButton>
        <p className="mt-4 text-sm text-subtle">
          Forgot the PIN? Sign out, sign back in, then change it on Account
          profile before the lock starts again.
        </p>
        <button
          type="button"
          className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-fg"
          onClick={() => void signOut("/login")}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
