import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useEntitlement } from "@/lib/billing/use-entitlement";

export function AuthSlot({ saved }: { saved?: "idle" | "saving" | "saved" | "guest" }) {
  const { user } = useCurrentUserState();
  const ent = useEntitlement();
  const signedIn = Boolean(user && !user.isDevFallback);

  return (
    <div className="relative z-30 flex items-center gap-2">
      {saved === "saved" ? (
        <span className="hidden text-xs text-subtle sm:inline">Saved</span>
      ) : saved === "saving" ? (
        <span className="hidden text-xs text-subtle sm:inline">Saving…</span>
      ) : null}
      {signedIn ? (
        <>
          <Link
            to="/pricing"
            className="inline-flex h-11 items-center px-2 text-xs font-medium text-fg underline decoration-fg/40 underline-offset-4 hover:decoration-fg"
          >
            {ent.paid ? "MACH" : "Upgrade"}
          </Link>
          <div className="max-w-[11rem] truncate text-xs sm:max-w-none">
            <UserButton />
          </div>
        </>
      ) : (
        <>
          <a
            href="/pricing"
            className="inline-flex h-11 items-center px-2 text-sm font-medium text-muted hover:text-fg"
          >
            Pricing
          </a>
          <a
            href="/login"
            className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface hover:text-fg"
          >
            Sign in
          </a>
        </>
      )}
    </div>
  );
}
