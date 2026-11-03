import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { betaAccountLinkFn } from "@/lib/beta/api";

/** One line under Referrals. Hidden unless this email is invited. */
export function BetaAccountLink() {
  const [row, setRow] = useState<{ submittedCount: number; limit: number } | null>(null);

  useEffect(() => {
    let live = true;
    void betaAccountLinkFn()
      .then((page) => {
        if (!live || !page.open) return;
        setRow({ submittedCount: page.submittedCount, limit: page.limit });
      })
      .catch(() => {
        /* Not invited, or the check failed. Show nothing. */
      });
    return () => {
      live = false;
    };
  }, []);

  if (!row) return null;
  return (
    <p className="text-sm text-fg">
      <Link to="/beta" className="font-medium underline underline-offset-4">
        Beta debrief
      </Link>{" "}
      <span className="text-muted">
        {row.submittedCount} of {row.limit} submitted.
      </span>
    </p>
  );
}
