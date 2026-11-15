import { Link } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { referralSummaryFn } from "@/lib/referrals/api";
import { referralCountLine } from "@/lib/referrals/summary";
import type { ReferralSummary } from "@/lib/referrals/page.server";
import { rewardLedgerFn } from "@/lib/rewards/api";

export function referralLink(code: string): string {
  return `https://machrun.com/?ref=${code}`;
}

/** One line. The icon copies that exact address, with no line break. */
export function ReferralLinkLine({ code, locked = false }: { code: string | null; locked?: boolean }) {
  const [copied, setCopied] = useState(false);
  const link = code ? referralLink(code) : "";

  async function copy() {
    if (!link || locked) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`flex w-full min-w-0 flex-wrap items-center gap-2 overflow-visible py-1 ${locked ? "pointer-events-none opacity-60 select-none" : ""}`}>
      <button
        type="button"
        disabled={!link || locked}
        onClick={() => void copy()}
        aria-label={copied ? "Copied" : "Copy"}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-elevated disabled:opacity-60"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="min-w-0 font-mono text-sm break-all text-fg">
        {link || "Preparing your link…"}
      </span>
    </div>
  );
}

/** The link is on the profile. The list of people stays on the Referrals page. */
export function ReferralAccountCard() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    void referralSummaryFn()
      .then((row) => {
        if (live) setSummary(row);
      })
      .catch(() => {
        /* The account page still loads. */
      });
    void rewardLedgerFn()
      .then((row) => {
        if (live) setBalance(row.balance);
      })
      .catch(() => {
        /* The account page still loads. */
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="space-y-3 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
      <p className="font-display text-lg text-fg">Mach Rewards</p>
      <p className="font-display text-3xl tabular-nums text-fg">{balance == null ? "—" : balance}</p>
      <p className="text-sm leading-relaxed text-muted">
        When a friend starts a yearly plan, those points land in Mach Rewards. Nothing comes off a bill until you apply them. 10 points is $1.
      </p>
      <ReferralLinkLine code={summary?.code ?? null} />
      <p className="text-sm leading-relaxed text-fg">
        {summary ? referralCountLine(summary.signedUp, summary.yearly) : "Loading your rewards…"}
      </p>
      <Link to="/mach-rewards" className="inline-flex text-sm font-medium text-fg underline underline-offset-4">
        See who signed up
      </Link>
    </section>
  );
}
