import { useEffect, useState } from "react";
import { passwordLaterStatus } from "@/lib/auth/pending-signup-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const HIDE = "mach-password-later-hide";

/** Non-blocking. The plan stays on screen. They can set the password now or from Account. */
export function PasswordLaterBanner() {
  const { user, isPending } = useCurrentUserState();
  const [needed, setNeeded] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(HIDE) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  useEffect(() => {
    if (isPending || !user || user.isDevFallback) return;
    void passwordLaterStatus()
      .then((s) => setNeeded(s.needed))
      .catch(() => setNeeded(false));
  }, [isPending, user]);

  if (!needed || hidden) return null;

  return (
    <div className="border-b border-border bg-surface">
      <div className="page-gutter mx-auto flex max-w-none flex-col items-center gap-1.5 py-2.5 text-center sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-3">
        <p className="max-w-xl text-sm leading-relaxed text-fg">
          Set a password whenever you want. It does not change this plan.{" "}
          <a href="/account#password" className="font-medium text-[#3a8a58] underline underline-offset-2">
            Set it in Account
          </a>
        </p>
        <button
          type="button"
          className="text-sm text-muted underline-offset-2 hover:underline"
          onClick={() => {
            try {
              sessionStorage.setItem(HIDE, "1");
            } catch {
              /* ignore */
            }
            setHidden(true);
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
