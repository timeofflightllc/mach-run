import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AccountMenu() {
  const { user } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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
          <Link
            to="/pricing"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2.5 text-sm text-fg hover:bg-surface"
          >
            Manage billing
          </Link>
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
    </div>
  );
}
