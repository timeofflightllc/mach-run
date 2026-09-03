import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { emailVerifyStatus } from "@/lib/auth/email-verify-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function EmailVerifyBanner() {
  const { user, isPending } = useCurrentUserState();
  const [needed, setNeeded] = useState(false);

  useEffect(() => {
    if (isPending || !user || user.isDevFallback) return;
    void emailVerifyStatus()
      .then((s) => setNeeded(!s.verified))
      .catch(() => setNeeded(false));
  }, [isPending, user]);

  if (!needed) return null;

  return (
    <div className="border-b border-[#5c4a18] bg-[#241c0c]">
      <div className="page-gutter mx-auto flex max-w-none flex-col items-center gap-1.5 py-2.5 text-center sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-3">
        <span className="inline-flex shrink-0 items-center rounded-sm bg-[#e8c547] px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1a1408]">
          Verify email
        </span>
        <p className="max-w-xl text-xs leading-relaxed text-[#ead9a0]">
          Check your inbox for a 6-digit code.{" "}
          <Link
            to="/verify-email"
            className="font-medium text-[#f6e7b0] underline decoration-[#e8c547]/80 underline-offset-[3px] hover:text-[#fff3c4]"
          >
            Verify Email
          </Link>
        </p>
      </div>
    </div>
  );
}
