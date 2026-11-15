import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { ReferralLinkLine } from "@/components/meridian/referral-card";
import { RedirectToSignIn, isRealUser } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { referralPeopleFn, referralSummaryFn } from "@/lib/referrals/api";
import { referralBillLine, referralCountLine, referralCreditLabel, referralPoints, referralPointsReceived } from "@/lib/referrals/summary";
import type { ReferralPerson, ReferralSummary } from "@/lib/referrals/page.server";
import { pointBoardFn } from "@/lib/points/api";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/mach-rewards")({
  head: () =>
    pageHead({
      title: "Mach Rewards | MACH RUN",
      description: "Your Mach Rewards.",
      path: "/mach-rewards",
      noindex: true,
    }),
  component: MachRewardsPage,
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

const EARN_CELL = "flex h-full min-h-44 w-full flex-col bg-surface px-4 py-5 text-left";
const ATTEMPTS = "mt-auto pt-4 text-sm text-fg";

const BETA_PASSES = 3;
const BETA_POINTS = 150;

function EarnBingo({ betaSubmitted }: { betaSubmitted: number | null }) {
  function scrollToLink() {
    document.getElementById("referral-link")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const submitted = betaSubmitted == null ? null : Math.min(Math.max(betaSubmitted, 0), BETA_PASSES);
  const earned = submitted == null ? null : submitted * BETA_POINTS;

  return (
    <div className="overflow-hidden rounded-xl bg-border">
      <ul className="grid grid-cols-1 gap-px sm:grid-cols-2 xl:grid-cols-4">
        <li>
          <a
            href="https://www.instagram.com/machrundotcom/"
            target="_blank"
            rel="noopener noreferrer"
            className={`${EARN_CELL} hover:bg-elevated`}
          >
            <p className="font-display text-4xl leading-none text-fg">20</p>
            <p className="mt-6 text-base font-medium text-fg">Follow on Instagram</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">Follow MACH RUN.</p>
            <p className={ATTEMPTS}>1 possible attempt</p>
          </a>
        </li>
        <li>
          <a
            href="https://www.linkedin.com/company/machrun-com/"
            target="_blank"
            rel="noopener noreferrer"
            className={`${EARN_CELL} hover:bg-elevated`}
          >
            <p className="font-display text-4xl leading-none text-fg">20</p>
            <p className="mt-6 text-base font-medium text-fg">Follow on LinkedIn</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">Follow MACH RUN.</p>
            <p className={ATTEMPTS}>1 possible attempt</p>
          </a>
        </li>
        <li>
          <Link to="/" className={`${EARN_CELL} hover:bg-elevated`}>
            <p className="font-display text-4xl leading-none text-fg">100</p>
            <p className="mt-6 text-base font-medium text-fg">First MACH RUN</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Type your household, complete the OODA Loop, execute the MACH RUN. These points are not earned with a Hale Demo run, but your real household numbers.
            </p>
            <p className={ATTEMPTS}>1 possible attempt</p>
          </Link>
        </li>
        <li>
          <Link to="/" className={`${EARN_CELL} hover:bg-elevated`}>
            <p className="font-display text-4xl leading-none text-fg">10</p>
            <p className="mt-6 text-base font-medium text-fg">Run the loop again.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">Change your MACH RUN as you iterate and adapt to new information. 10 points earned once a month maximum.</p>
            <p className={ATTEMPTS}>1 possible attempt a month</p>
          </Link>
        </li>
        <li>
          <button type="button" onClick={scrollToLink} className={`${EARN_CELL} hover:bg-elevated`}>
            <p className="font-display text-4xl leading-none text-fg">200</p>
            <p className="mt-6 text-base font-medium text-fg">Refer a friend</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">Earn 200 points when a referred friend signs up for a yearly plan.</p>
            <p className={ATTEMPTS}>Unlimited possible attempts</p>
          </button>
        </li>
        <li>
          <Link to="/beta" className={`${EARN_CELL} hover:bg-elevated`}>
            <p className="font-display text-4xl leading-none text-fg">
              450 <span className="text-lg font-medium text-muted">possible</span>
            </p>
            <p className="mt-6 text-base font-medium text-fg">Beta debrief</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {earned == null
                ? "Loading…"
                : `${earned} of 450 earned. ${submitted} of 3 feedback forms submitted.`}
            </p>
            <p className={ATTEMPTS}>3 possible attempts</p>
          </Link>
        </li>
        <li>
          <Link to="/review" className={`${EARN_CELL} hover:bg-elevated`}>
            <p className="font-display text-4xl leading-none text-fg">100</p>
            <p className="mt-6 text-base font-medium text-fg">Short review</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">Stars, your name, and 250 characters.</p>
            <p className={ATTEMPTS}>1 possible attempt</p>
          </Link>
        </li>
      </ul>
    </div>
  );
}

function MachRewardsPage() {
  const { user, isPending } = useCurrentUserState();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [people, setPeople] = useState<ReferralPerson[] | null>(null);
  const [betaSubmitted, setBetaSubmitted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRealUser(user)) return;
    let live = true;
    void referralSummaryFn()
      .then((row) => {
        if (live) setSummary(row);
      })
      .catch(() => {
        if (live) setError("Mach Rewards are unavailable.");
      });
    void referralPeopleFn()
      .then((rows) => {
        if (live) setPeople(rows);
      })
      .catch(() => {
        if (live) setPeople([]);
      });
    void pointBoardFn()
      .then((row) => {
        if (live) setBetaSubmitted(row.betaSubmitted);
      })
      .catch(() => {
        if (live) setBetaSubmitted(0);
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
          <h1 className="mt-2 font-display text-4xl text-fg">Mach Rewards</h1>
        </header>

        <EarnBingo betaSubmitted={betaSubmitted} />

        {error ? <p className="text-sm text-negative">{error}</p> : null}

        <section className="w-full rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
          <div className="px-5 py-6 sm:px-6 sm:py-7">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">Point balance</p>
            <p className="mt-1 font-display text-5xl tabular-nums text-fg">
              {summary ? referralPoints(summary.creditCents) : "—"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {summary ? referralBillLine(summary.creditCents) : "Loading your balance…"}
            </p>
          </div>
          <div className="border-t border-border">
            <p className="px-5 py-3 text-xs font-medium uppercase tracking-[0.16em] text-subtle sm:px-6">
              History
            </p>
            {people == null ? (
              <p className="px-5 pb-5 text-sm text-muted sm:px-6">Loading…</p>
            ) : (
              (() => {
                const earned = people.filter((person) => person.creditCents > 0);
                if (earned.length === 0) {
                  return (
                    <p className="px-5 pb-5 text-base text-muted sm:px-6">
                      No points yet. Refer a friend who starts a yearly plan to earn points.
                    </p>
                  );
                }
                return (
                  <ul>
                    {earned.map((person, index) => (
                      <li
                        key={`${person.date}-${person.name}-${index}`}
                        className="flex items-center justify-between gap-4 border-t border-border px-5 py-3 first:border-t-0 sm:px-6"
                      >
                        <div className="min-w-0">
                          <p className="text-base font-medium text-fg">Referred a friend</p>
                          <p className="mt-0.5 text-sm text-subtle">
                            {person.name} · {referralDate(person.date)}
                          </p>
                        </div>
                        <p className="shrink-0 font-display text-xl tabular-nums text-fg">
                          +{referralPoints(person.creditCents)}
                        </p>
                      </li>
                    ))}
                  </ul>
                );
              })()
            )}
          </div>
        </section>

        <section id="referral-link" className="w-full scroll-mt-6 space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)] sm:p-6">
          <p className="max-w-xl text-base leading-relaxed text-muted">
            Send this link. When a friend starts a yearly plan, 200 points land on your account. Those points come off your next bill at a rate of 10 points to $1.
          </p>
          <ReferralLinkLine code={summary?.code ?? null} />
          <p className="text-base leading-relaxed text-fg">
            {summary ? referralCountLine(summary.signedUp, summary.yearly) : "Loading your rewards…"}
          </p>
          {summary ? (
            <div className="text-base leading-relaxed text-fg">
              <p>{referralPointsReceived(summary.creditCents)}</p>
              <p>{referralBillLine(summary.creditCents)}.</p>
            </div>
          ) : null}
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
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">Points</p>
              <p className="font-display text-3xl leading-none text-fg">
                {referralPoints(summary?.creditCents ?? 0)}
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
                    {person.creditCents > 0 ? referralCreditLabel(person.creditCents) : "—"}
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
