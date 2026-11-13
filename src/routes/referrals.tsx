import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { ReferralLinkLine } from "@/components/meridian/referral-card";
import { RedirectToSignIn, isRealUser } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { referralPeopleFn, referralSummaryFn } from "@/lib/referrals/api";
import { referralCountLine, referralMoney } from "@/lib/referrals/summary";
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

function referralDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function ReferralsPage() {
  const { user, isPending } = useCurrentUserState();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [people, setPeople] = useState<ReferralPerson[] | null>(null);
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

  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            <Link to="/account" className="underline-offset-4 hover:text-fg hover:underline">
              My Account
            </Link>
          </p>
          <h1 className="mt-2 font-display text-4xl text-fg">Referrals</h1>
        </header>

        {error ? <p className="text-sm text-negative">{error}</p> : null}

        <section className="w-full space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)] sm:p-6">
          <p className="max-w-xl text-base leading-relaxed text-muted">
            Send this link. A friend who starts a yearly plan puts a credit on your next bill.
          </p>
          <ReferralLinkLine code={summary?.code ?? null} />
          <p className="text-base leading-relaxed text-fg">
            {summary
              ? `${referralCountLine(summary.signedUp, summary.yearly)} Credits received: ${referralMoney(summary.creditCents)}.`
              : "Loading your referrals…"}
          </p>
        </section>

        <section className="w-full rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:px-6">
            <div>
              <h2 className="font-display text-2xl text-fg">People you referred</h2>
              <p className="mt-1 text-sm text-muted">
                {people == null
                  ? "Loading…"
                  : people.length === 1
                    ? "1 person"
                    : `${people.length} people`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">Credits</p>
              <p className="font-display text-3xl leading-none text-fg">
                {referralMoney(summary?.creditCents ?? 0)}
              </p>
            </div>
          </div>

          {people == null ? (
            <p className="border-t border-border px-5 py-4 text-sm text-muted sm:px-6">Loading…</p>
          ) : people.length === 0 ? (
            <p className="border-t border-border px-5 py-5 text-base text-muted sm:px-6">
              No one has used your link yet.
            </p>
          ) : (
            <ul className="border-t border-border">
              {people.map((person, index) => (
                <li
                  key={`${person.date}-${person.name}-${index}`}
                  className="flex items-center justify-between gap-6 border-t border-border px-5 py-4 first:border-t-0 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="text-base font-medium text-fg">{person.name}</p>
                    <p className="mt-0.5 text-sm text-subtle">
                      {referralDate(person.date)}
                      {" · "}
                      {person.creditCents > 0 ? "Yearly plan" : person.status}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-2xl tabular-nums text-fg">
                    {person.creditCents > 0 ? referralMoney(person.creditCents) : "—"}
                  </p>
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
