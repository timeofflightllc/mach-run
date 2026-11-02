import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { referralSummaryFn } from "@/lib/referrals/api";
import { referralCountLine } from "@/lib/referrals/summary";
import type { ReferralSummary } from "@/lib/referrals/page.server";

/** Counts only. The people stay on the Referrals page. */
export function ReferralAccountCard() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);

  useEffect(() => {
    let live = true;
    void referralSummaryFn()
      .then((row) => {
        if (live) setSummary(row);
      })
      .catch(() => {
        /* The account page still loads. */
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="space-y-2 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
      <p className="font-display text-lg text-fg">Referrals</p>
      <p className="text-sm text-muted">
        {summary ? referralCountLine(summary.signedUp, summary.yearly) : "Loading your referrals…"}
      </p>
      <Link to="/referrals" className="inline-flex text-sm font-medium text-fg underline underline-offset-4">
        See your link
      </Link>
    </section>
  );
}
