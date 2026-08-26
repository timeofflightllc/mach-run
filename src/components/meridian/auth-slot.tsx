import { Link } from "@tanstack/react-router";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useEntitlement } from "@/lib/billing/use-entitlement";

export function AuthSlot({ saved }: { saved?: "idle" | "saving" | "saved" | "guest" }) {
  const { isPending } = useCurrentUserState();
  const ent = useEntitlement();
  if (isPending) {
    return <div className="h-11 w-24 animate-pulse rounded-lg bg-surface" />;
  }
  return (
    <div className="flex items-center gap-2">
      {saved === "saved" ? (
        <span className="hidden text-xs text-subtle sm:inline">Saved</span>
      ) : saved === "saving" ? (
        <span className="hidden text-xs text-subtle sm:inline">Saving…</span>
      ) : null}
      <SignedIn>
        {!ent.paid ? (
          <Link
            to="/pricing"
            className="hidden h-11 items-center px-2 text-xs font-medium text-fg underline decoration-fg/40 underline-offset-4 hover:decoration-fg sm:inline-flex"
          >
            Upgrade
          </Link>
        ) : (
          <Link
            to="/pricing"
            className="hidden text-xs text-subtle sm:inline"
          >
            MACH
          </Link>
        )}
        <div className="max-w-[11rem] truncate text-xs sm:max-w-none">
          <UserButton />
        </div>
      </SignedIn>
      <SignedOut>
        <Link
          to="/pricing"
          className="hidden h-11 items-center px-2 text-xs font-medium text-muted hover:text-fg sm:inline-flex"
        >
          Pricing
        </Link>
        <Link
          to="/login"
          className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface hover:text-fg"
        >
          Sign in
        </Link>
      </SignedOut>
    </div>
  );
}