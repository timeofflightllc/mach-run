import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { engageIdleLock, idleLockArmed } from "@/lib/idle-lock";
import { usePlanStore } from "@/lib/plan/store";

export const MACH_RESET_BASELINE = "mach-reset-baseline";

export function AccountMenu() {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const reset = usePlanStore((s) => s.reset);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    setPinSet(idleLockArmed(user.id));
  }, [user, open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user || user.isDevFallback) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Account";

  function doReset() {
    reset();
    window.dispatchEvent(new Event(MACH_RESET_BASELINE));
    setConfirmReset(false);
    setOpen(false);
  }

  return (
    <div ref={root} className="relative z-[80]">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 max-w-[9rem] items-center gap-1 truncate rounded-lg px-2 text-sm font-medium text-fg hover:bg-surface sm:max-w-[12rem]"
      >
        <span className="truncate">{label}</span>
        <span className="text-subtle" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-[80] mt-1 min-w-[13rem] rounded-lg bg-elevated py-1 shadow-[0_0_0_1px_var(--color-border)]"
        >
          <Link
            to="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2.5 text-sm text-fg hover:bg-surface"
          >
            Account profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              if (!user) return;
              if (pinSet) {
                engageIdleLock(user.id);
                return;
              }
              void navigate({ to: "/account", hash: "idle-lock" });
            }}
            className="block w-full px-3 py-2.5 text-left text-sm text-fg hover:bg-surface"
          >
            {pinSet ? "Engage idle privacy lock" : "Set idle privacy pin"}
          </button>
          <Link
            to="/pricing"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2.5 text-sm text-fg hover:bg-surface"
          >
            Plans
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirmReset(true);
            }}
            className="block w-full px-3 py-2.5 text-left text-sm text-muted hover:bg-surface hover:text-fg"
          >
            Reset baseline
          </button>
          {authEnabled ? (
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut().catch(() => setSigningOut(false));
              }}
              className="block w-full px-3 py-2.5 text-left text-sm text-muted hover:bg-surface hover:text-fg disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : null}
        </div>
      ) : null}

      {confirmReset ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-baseline-title"
        >
          <div className="w-full max-w-md rounded-xl bg-elevated p-5 shadow-[0_0_0_1px_var(--color-border)]">
            <p id="reset-baseline-title" className="font-display text-lg text-fg">
              Reset baseline
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Resetting the baseline will zero out and delete all OODA sections.
              Are you sure you want to do this? This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="h-11 rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doReset}
                className="h-11 rounded-lg bg-[#e8c547] px-4 text-sm font-medium text-[#1a1408]"
              >
                Reset baseline
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
