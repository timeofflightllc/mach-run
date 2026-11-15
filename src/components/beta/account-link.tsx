import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { betaPageFn } from "@/lib/beta/api";

/** Link under My Account. Hidden unless this email is invited. */
export function BetaAccountLink() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    void betaPageFn()
      .then((next) => {
        if (live && next.open) setOpen(true);
      })
      .catch(() => {
        /* Not invited, or the check failed. Show nothing. */
      });
    return () => {
      live = false;
    };
  }, []);

  if (!open) return null;

  return (
    <li>
      <Link
        to="/beta"
        className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-fg hover:bg-elevated"
      >
        <span>Beta Testing Feedback</span>
        <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
      </Link>
    </li>
  );
}
