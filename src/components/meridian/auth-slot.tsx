import { AccountMenu } from "@/components/meridian/account-menu";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AuthSlot({ saved }: { saved?: "idle" | "saving" | "saved" | "guest" }) {
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);

  return (
    <div className="relative z-30 ml-auto flex items-center justify-end gap-2">
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
          <div className="flex flex-col items-end">
            <a
              href="/login"
              className="inline-flex h-11 items-center justify-end rounded-lg px-0 text-sm font-medium text-muted hover:bg-surface hover:text-fg sm:px-3"
            >
              Sign in
            </a>
            <p className="-mt-1 max-w-[10.5rem] pb-1 text-right text-[10px] leading-tight text-subtle sm:hidden">
              The Supersonic Financial Calculator
            </p>
          </div>
        </>
      )}
    </div>
  );
}
