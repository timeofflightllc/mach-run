import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { ReferralLinkLine } from "@/components/meridian/referral-card";
import { PrimaryButton } from "@/components/ui/field";
import { RedirectToSignIn, isRealUser } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { referralPeopleFn, referralSummaryFn } from "@/lib/referrals/api";
import { referralCountLine } from "@/lib/referrals/summary";
import type { ReferralPerson, ReferralSummary } from "@/lib/referrals/page.server";
import { pointBoardFn } from "@/lib/points/api";
import { BETA_PASS_CAP, BETA_PASS_POINTS, betaRewardPoints } from "@/lib/points/board";
import { acceptRewardsTermsFn, applyRewardPointsFn, rewardLedgerFn, rewardsAcceptanceFn } from "@/lib/rewards/api";
import type { RewardGrant } from "@/lib/rewards/balance.server";
import { rewardApplyChoices, rewardDollars } from "@/lib/rewards/apply";
import { REWARDS_TERMS } from "@/lib/rewards/terms";
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

function PlatinumCard({ balance, name }: { balance: number | null; name: string | null }) {
  const engraved = "text-[#3c3934] [text-shadow:0_1px_0_rgba(255,255,255,0.72)]";
  return (
    <div
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[1.15rem] shadow-[0_22px_40px_-24px_rgba(30,28,24,0.7),inset_0_1px_0_rgba(255,255,255,0.75)]"
      style={{ aspectRatio: "1.586 / 1" }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: [
            "linear-gradient(118deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.05) 24%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.22) 52%, rgba(60,56,50,0.08) 68%, rgba(255,255,255,0.45) 100%)",
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 1px, rgba(80,76,70,0.03) 1px 3px)",
            "linear-gradient(155deg, #f7f4ee 0%, #d4d0c6 28%, #9a968e 52%, #e4e0d6 74%, #b7b3a9 100%)",
          ].join(","),
        }}
      />
      <div className={`relative flex h-full flex-col px-[7%] py-[6%] ${engraved}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-[clamp(0.95rem,2.4vw,1.35rem)] tracking-[0.22em]">MACH RUN</p>
          <p className="font-display text-[clamp(0.7rem,1.7vw,0.95rem)] tracking-[0.28em]">PLATINUM</p>
        </div>
        <div
          aria-hidden
          className="mt-[4%] h-[16%] w-[14%] max-w-14 rounded-[0.35rem] border border-[#8a7344]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
          style={{
            background:
              "linear-gradient(135deg, #f3e2b0 0%, #c6a15a 28%, #f7edd0 46%, #a8883e 72%, #e6d39a 100%)",
          }}
        >
          <div className="grid h-full grid-cols-2 grid-rows-3 gap-px p-1 opacity-70">
            <span className="border-b border-[#8a7344]/50" />
            <span className="border-b border-[#8a7344]/50" />
            <span className="border-b border-[#8a7344]/50" />
            <span className="border-b border-[#8a7344]/50" />
            <span />
            <span />
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-display text-[clamp(2.4rem,8vw,4.25rem)] leading-none tabular-nums">
            {balance == null ? "—" : balance}
          </p>
          <p className="mt-2 text-[clamp(0.65rem,1.5vw,0.8rem)] tracking-[0.42em]">POINTS</p>
        </div>
        <p className="h-5 truncate text-left text-[clamp(0.7rem,1.8vw,0.95rem)] tracking-[0.16em] uppercase">
          {name ?? ""}
        </p>
      </div>
    </div>
  );
}

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

function EarnBingo({
  betaSubmitted,
  betaInvited,
  locked,
}: {
  betaSubmitted: number | null;
  betaInvited: boolean | null;
  locked: boolean;
}) {
  function scrollToLink() {
    document.getElementById("referral-link")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const submitted = betaSubmitted == null ? null : Math.min(Math.max(betaSubmitted, 0), BETA_PASS_CAP);
  const earned = submitted == null ? null : betaRewardPoints(submitted);

  return (
    <div className={`overflow-hidden rounded-xl bg-border ${locked ? "opacity-60" : ""}`} inert={locked}>
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
          {betaInvited === false ? (
            <div className={EARN_CELL}>
              <p className="font-display text-4xl leading-none text-fg">
                450 <span className="text-lg font-medium text-muted">possible</span>
              </p>
              <p className="mt-6 text-base font-medium text-fg">Beta debrief</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                You are not currently a beta tester. To become a beta tester for MACH RUN and have the chance to receive additional MR points and a free hat, please{" "}
                <Link to="/beta-request" className="text-fg underline underline-offset-4">
                  click here
                </Link>
                .
              </p>
              <p className={ATTEMPTS}>3 possible attempts</p>
            </div>
          ) : (
            <Link to="/beta" className={`${EARN_CELL} hover:bg-elevated`}>
              <p className="font-display text-4xl leading-none text-fg">
                450 <span className="text-lg font-medium text-muted">possible</span>
              </p>
              <p className="mt-6 text-base font-medium text-fg">Beta debrief</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {earned == null
                  ? "Loading…"
                  : `${earned} of ${BETA_PASS_CAP * BETA_PASS_POINTS} earned. ${submitted} of ${BETA_PASS_CAP} feedback forms submitted.`}
              </p>
              <p className={ATTEMPTS}>3 possible attempts</p>
            </Link>
          )}
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
  const [betaInvited, setBetaInvited] = useState<boolean | null>(null);
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [ledger, setLedger] = useState<{ balance: number; grants: RewardGrant[] } | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyPoints, setApplyPoints] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyNote, setApplyNote] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
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
        if (!live) return;
        setBetaSubmitted(row.betaSubmitted);
        setBetaInvited(row.betaInvited);
      })
      .catch(() => {
        if (!live) return;
        setBetaSubmitted(0);
        setBetaInvited(false);
      });
    void rewardsAcceptanceFn()
      .then((row) => {
        if (live) setAccepted(row.accepted);
      })
      .catch(() => {
        if (live) setAccepted(false);
      });
    void rewardLedgerFn()
      .then((row) => {
        if (live) setLedger(row);
      })
      .catch(() => {
        if (live) setError("Mach Rewards are unavailable.");
      });
    return () => {
      live = false;
    };
  }, [user]);

  async function onJoin(event: FormEvent) {
    event.preventDefault();
    if (!agreed || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await acceptRewardsTermsFn();
      if (!result.ok) throw new Error(result.reason);
      setAccepted(true);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not save that. Try again.");
    } finally {
      setJoining(false);
    }
  }

  async function onApply() {
    if (applyPoints == null || applying) return;
    setApplying(true);
    setApplyError(null);
    try {
      const result = await applyRewardPointsFn({ data: { points: applyPoints } });
      if (!result.ok) {
        setApplyError(result.error);
        return;
      }
      setLedger((current) => (current ? { ...current, balance: result.balance } : current));
      setApplyNote(result.line);
      setApplyOpen(false);
      setApplyPoints(null);
    } catch {
      setApplyError("Those points were not applied. Your balance is unchanged.");
    } finally {
      setApplying(false);
    }
  }

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

        {accepted === false ? (
          <form
            onSubmit={(event) => void onJoin(event)}
            className="w-full space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)] sm:p-6"
          >
            <h2 className="font-display text-2xl text-fg">Join Mach Rewards</h2>
            <p className="text-base text-fg">Points are a thank-you, not a paycheck.</p>
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              {REWARDS_TERMS.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-fg">
              These sit on top of the MACH RUN{" "}
              <Link to="/legal" className="font-medium underline underline-offset-4">
                Terms of Service
              </Link>
              .
            </p>
            <label className="flex items-start gap-3 text-sm leading-relaxed text-fg">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-fg"
              />
              <span>I have read and agree to the Mach Rewards Terms and the MACH RUN Terms of Service.</span>
            </label>
            {joinError ? <p className="text-sm text-negative">{joinError}</p> : null}
            <PrimaryButton type="submit" disabled={!agreed || joining}>
              {joining ? "Joining…" : "Join Mach Rewards"}
            </PrimaryButton>
          </form>
        ) : null}

        <EarnBingo betaSubmitted={betaSubmitted} betaInvited={betaInvited} locked={accepted !== true} />

        {error ? <p className="text-sm text-negative">{error}</p> : null}

        <section className="w-full rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
          <div className="px-5 py-6 sm:px-6 sm:py-7">
            <PlatinumCard
              balance={ledger == null ? null : ledger.balance}
              name={user?.displayName?.trim() || null}
            />
            <div className="mt-5">
              <PrimaryButton
                disabled={ledger == null || ledger.balance <= 0 || applyOpen || applying}
                onClick={() => {
                  setApplyOpen(true);
                  setApplyPoints(null);
                  setApplyError(null);
                }}
              >
                Apply Mach Rewards to your next bill
              </PrimaryButton>
            </div>
            {applyOpen && ledger ? (
              <fieldset className="mt-4 space-y-3">
                {rewardApplyChoices(ledger.balance).map((points, index, choices) => (
                  <label key={points} className="flex items-center gap-3 text-sm text-fg">
                    <input
                      type="radio"
                      name="reward-apply"
                      checked={applyPoints === points}
                      onChange={() => setApplyPoints(points)}
                      className="size-4 accent-fg"
                    />
                    <span>
                      {index === choices.length - 1
                        ? `All ${points} points (${rewardDollars(points)})`
                        : `${points} points (${rewardDollars(points)})`}
                    </span>
                  </label>
                ))}
                {applyError ? <p className="text-sm text-negative">{applyError}</p> : null}
                <PrimaryButton disabled={applyPoints == null || applying} onClick={() => void onApply()}>
                  {applying ? "Applying…" : "Apply to my next bill"}
                </PrimaryButton>
              </fieldset>
            ) : null}
            {applyNote ? <p className="mt-3 text-sm text-fg">{applyNote}</p> : null}
          </div>
          <div className="border-t border-border">
            <p className="px-5 py-3 text-xs font-medium uppercase tracking-[0.16em] text-subtle sm:px-6">
              History
            </p>
            {ledger == null ? (
              <p className="px-5 pb-5 text-sm text-muted sm:px-6">Loading…</p>
            ) : ledger.grants.length === 0 ? (
              <p className="px-5 pb-5 text-base text-muted sm:px-6">No points yet.</p>
            ) : (
              <ul>
                {ledger.grants.map((grant, index) => (
                  <li
                    key={`${grant.source}-${grant.date}-${index}`}
                    className={`flex items-center justify-between gap-4 px-5 py-3 sm:px-6 ${index > 0 ? "border-t border-border" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="text-base font-medium text-fg">
                        {grant.source === "beta" ? "Beta debrief" : "Referred a friend"}
                      </p>
                      <p className="mt-0.5 text-sm text-subtle">
                        {grant.source === "referral" ? `${grant.name} · ` : ""}
                        {referralDate(grant.date)}
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-xl tabular-nums text-fg">+{grant.points}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section id="referral-link" className="w-full scroll-mt-6 space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)] sm:p-6">
          <p className="max-w-xl text-base leading-relaxed text-muted">
            When a friend starts a yearly plan, those points land in Mach Rewards. Nothing comes off a bill until you apply them. 10 points is $1.
          </p>
          <ReferralLinkLine code={summary?.code ?? null} locked={accepted !== true} />
          <p className="text-base leading-relaxed text-fg">
            {summary ? referralCountLine(summary.signedUp, summary.yearly) : "Loading your rewards…"}
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
                      {person.status === "Chose monthly"
                        ? "Chose monthly"
                        : person.status === "Signed up"
                          ? "Signed up"
                          : "Started a yearly plan"}
                    </p>
                  </div>
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
