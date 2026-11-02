import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { referralSummaryFn } from "@/lib/referrals/api";
import { referralCountLine } from "@/lib/referrals/summary";
import type { ReferralSummary } from "@/lib/referrals/page.server";

function referralLink(code: string): string {
  return `https://machrun.com/?ref=${code}`;
}

/** The link is on the profile. The list of people stays on the Referrals page. */
export function ReferralAccountCard() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [copied, setCopied] = useState(false);

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

  const link = summary ? referralLink(summary.code) : "";

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
      <p className="font-display text-lg text-fg">Referrals</p>
      <p className="text-sm leading-relaxed text-muted">
        Send this link. A friend who starts a yearly plan puts a credit on your next bill.
      </p>
      <p className="font-mono text-sm leading-relaxed text-fg">
        {summary ? (
          <>
            <span className="block">https://machrun.com/</span>
            <span className="block">?ref={summary.code}</span>
          </>
        ) : (
          "Preparing your link…"
        )}
      </p>
      <button
        type="button"
        disabled={!link}
        onClick={() => void copy()}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
      <p className="text-sm leading-relaxed text-fg">
        {summary ? referralCountLine(summary.signedUp, summary.yearly) : "Loading your referrals…"}
      </p>
      <Link to="/referrals" className="inline-flex text-sm font-medium text-fg underline underline-offset-4">
        See who signed up
      </Link>
    </section>
  );
}
