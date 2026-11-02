import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { RedirectToSignIn, isRealUser } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { referralPeopleFn, referralSummaryFn } from "@/lib/referrals/api";
import { referralCountLine } from "@/lib/referrals/summary";
import type { ReferralPerson, ReferralSummary } from "@/lib/referrals/page.server";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/referrals")({
  head: () =>
    pageHead({
      title: "Referrals | MACH RUN",
      description: "Your MACH RUN referral link.",
      path: "/referrals",
      noindex: true,
    }),
  component: ReferralsPage,
});

function referralLink(code: string): string {
  return `https://machrun.com/?ref=${code}`;
}

function ReferralsPage() {
  const { user, isPending } = useCurrentUserState();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [people, setPeople] = useState<ReferralPerson[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRealUser(user)) return;
    let live = true;
    void referralSummaryFn()
      .then((row) => {
        if (live) setSummary(row);
      })
      .catch(() => {
        if (live) setError("Referrals are unavailable.");
      });
    void referralPeopleFn()
      .then((rows) => {
        if (live) setPeople(rows);
      })
      .catch(() => {
        if (live) setPeople([]);
      });
    return () => {
      live = false;
    };
  }, [user]);

  if (isPending && !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg text-muted">
        Loading…
      </main>
    );
  }
  if (!isPending && !isRealUser(user)) return <RedirectToSignIn />;

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
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full max-w-2xl space-y-8">
        <PageMast />
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            Account
          </p>
          <h1 className="mt-2 font-display text-4xl text-fg">Referrals</h1>
        </header>

        {error ? <p className="text-sm text-negative">{error}</p> : null}

        <section className="space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
          <p className="text-sm text-muted">
            Send this link. A friend who starts a yearly plan puts a credit on your next bill.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 break-all font-mono text-sm text-fg">
              {link || "Preparing your link…"}
            </p>
            <button
              type="button"
              disabled={!link}
              onClick={() => void copy()}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="text-sm text-fg">
            {summary
              ? referralCountLine(summary.signedUp, summary.yearly)
              : "Loading your referrals…"}
          </p>
        </section>

        <section className="space-y-3">
          {people == null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : people.length === 0 ? (
            <p className="text-sm text-muted">No one has used your link yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
              {people.map((person, index) => (
                <li
                  key={`${person.date}-${index}`}
                  className="flex items-baseline justify-between gap-4 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fg">{person.name}</span>
                    <span className="block text-xs text-subtle">{person.date}</span>
                  </span>
                  <span className="shrink-0 text-sm text-muted">{person.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <MachFooter />
      </div>
    </main>
  );
}
