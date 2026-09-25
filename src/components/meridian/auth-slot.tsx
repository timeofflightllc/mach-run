import { AccountMenu } from "@/components/meridian/account-menu";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AuthSlot({ saved }: { saved?: "idle" | "saving" | "saved" | "guest" }) {
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);

  return (
    <div className="relative z-30 flex shrink-0 items-center justify-end gap-1">
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
            className="hidden h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-muted hover:text-fg sm:inline-flex"
          >
            Pricing
          </a>
          <p className="inline-flex h-11 shrink-0 items-center justify-end gap-0.5 whitespace-nowrap px-0 text-[11px] font-medium leading-tight sm:gap-1 sm:px-3 sm:text-sm">
            <a
              href="/login"
              className="shrink-0 whitespace-nowrap rounded-lg px-1 py-1 text-muted hover:bg-surface hover:text-fg"
            >
              Sign In
            </a>
            <span className="text-subtle" aria-hidden>
              /
            </span>
            <a
              href="/login?mode=up"
              className="rounded-lg px-1 py-1 text-muted hover:bg-surface hover:text-fg"
            >
              Create Account
            </a>
          </p>
        </>
      )}
    </div>
  );
}
