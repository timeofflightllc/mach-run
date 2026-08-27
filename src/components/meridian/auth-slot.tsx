import { AccountMenu } from "@/components/meridian/account-menu";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AuthSlot({ saved }: { saved?: "idle" | "saving" | "saved" | "guest" }) {
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);

  return (
    <div className="relative z-30 flex items-center gap-2">
      {saved === "saved" ? (
        <span className="hidden text-xs text-subtle sm:inline">Saved</span>
      ) : saved === "saving" ? (
        <span className="hidden text-xs text-subtle sm:inline">Saving…</span>
      ) : null}
      {signedIn ? (
        <AccountMenu />
      ) : (
        <>
          <a
            href="/pricing"
            className="hidden h-11 items-center px-2 text-sm font-medium text-muted hover:text-fg sm:inline-flex"
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
