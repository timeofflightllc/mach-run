import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
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

function memberYear(iso: string | null): string | null {
  if (!iso) return null;
  const year = new Date(iso).getFullYear();
  if (!Number.isFinite(year)) return null;
  return String(year).slice(-2);
}

function PlatinumCard({
  balance,
  name,
  since,
}: {
  balance: number | null;
  name: string | null;
  since: string | null;
}) {
  const face = "text-[#2c2926] [text-shadow:0_1px_0_rgba(255,255,255,0.65)]";
  return (
    <div
      className={`relative mx-auto w-full max-w-lg overflow-hidden rounded-[1rem] shadow-[0_18px_34px_-22px_rgba(30,28,24,0.72),inset_0_1px_0_rgba(255,255,255,0.8)] ${face}`}
      style={{ aspectRatio: "1.586 / 1", containerType: "inline-size", fontFamily: "var(--font-card)" }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(circle at 50% 58%, rgba(255,255,255,0.45) 0 8%, transparent 9% 12%, rgba(70,66,60,0.05) 13% 16%, transparent 17% 22%, rgba(70,66,60,0.04) 23% 26%, transparent 27%)",
            "linear-gradient(118deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.08) 26%, rgba(255,255,255,0) 42%, rgba(255,255,255,0.2) 58%, rgba(40,36,32,0.06) 74%, rgba(255,255,255,0.5) 100%)",
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0 1px, rgba(70,66,60,0.035) 1px 3px)",
            "linear-gradient(160deg, #f6f3ec 0%, #d8d4ca 30%, #a29e96 54%, #ece7dc 76%, #c2beb4 100%)",
          ].join(","),
        }}
      />
      <div aria-hidden className="absolute inset-[3.4%] rounded-[0.7rem] border border-[#2c2926]/80" />
      <div aria-hidden className="absolute inset-[5%] rounded-[0.55rem] border border-[#2c2926]/30" />

      <div className="relative flex h-full flex-col items-center px-[7%] pt-[6%]">
        <div className="flex w-max max-w-full flex-col items-stretch">
          <p className="whitespace-nowrap text-center text-[5.6cqw] font-bold leading-none tracking-[0.06em]">
            MACH RUN EXPRESS
          </p>
          <p className="mx-auto mt-[1cqw] flex w-2/3 justify-between text-[3.5cqw] font-semibold leading-none">
            {["R", "E", "W", "A", "R", "D", "S"].map((letter, index) => (
              <span key={index}>{letter}</span>
            ))}
          </p>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute left-[8%] top-[46%] h-[18%] w-[13%] max-w-11 -translate-y-1/2 rounded-[0.28rem] border border-[#8a7344]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
        style={{
          background: "linear-gradient(135deg, #f4e4b4 0%, #c6a15a 30%, #f8efd4 48%, #a8883e 74%, #e7d49c 100%)",
        }}
      >
        <div className="grid h-full grid-cols-2 grid-rows-3 gap-px p-[2px] opacity-70">
          <span className="border-b border-[#8a7344]/55" />
          <span className="border-b border-[#8a7344]/55" />
          <span className="border-b border-[#8a7344]/55" />
          <span className="border-b border-[#8a7344]/55" />
          <span />
          <span />
        </div>
      </div>

      <img
        src="/brand/rewards-pilot.jpg"
        alt=""
        className="pointer-events-none absolute left-1/2 top-[53%] h-[54%] w-[32%] -translate-x-1/2 -translate-y-1/2 object-cover"
        style={{ clipPath: "ellipse(46% 46% at 50% 50%)" }}
      />

      <div className="absolute right-[8%] top-[38%] -translate-y-1/2 text-right">
        <p className="text-[2.6cqw] font-semibold tracking-[0.22em]">POINTS</p>
        <p className="mt-[0.4cqw] text-[6.2cqw] font-bold leading-none tabular-nums">
          {balance == null ? "—" : balance}
        </p>
      </div>

      <div className="absolute right-[7.5%] top-[60%] flex w-[27%] flex-col items-center">
        <div className="relative flex w-full items-center justify-center">
          <svg viewBox="0 0 140 22" className="absolute inset-0 h-full w-full" aria-hidden>
            <path d="M8 1.5 H132 L138.5 11 L132 20.5 H8 L1.5 11 Z" fill="none" stroke="#2c2926" strokeWidth="1.1" />
          </svg>
          <p className="relative px-[0.7em] py-[0.45em] text-[1.85cqw] font-semibold leading-none tracking-[0.14em]">
            MEMBER SINCE
          </p>
        </div>
        <p className="mt-[0.7cqw] text-[3.1cqw] font-bold leading-none tabular-nums">{since ?? "—"}</p>
      </div>

      <p className="absolute bottom-[7.5%] left-[8%] right-[40%] truncate text-[3.3cqw] font-semibold tracking-[0.12em] uppercase">
        {name ?? ""}
      </p>
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

const EARN_CELL =
  "flex w-full items-start gap-3 self-start rounded-xl bg-surface px-4 py-3 text-left shadow-[0_0_0_1px_var(--color-border)]";

function EarnFace({
  points,
  note,
  title,
  detail,
  attempts,
}: {
  points: string;
  note?: string;
  title: string;
  detail: ReactNode;
  attempts: string;
}) {
  return (
    <>
      <div className="w-14 shrink-0">
        <p className="font-display text-3xl leading-none text-fg">{points}</p>
        {note ? <p className="mt-1 text-xs leading-tight text-muted">{note}</p> : null}
      </div>
      <span className="min-w-0">
        <span className="block text-base font-medium leading-tight text-fg">{title}</span>
        <span className="mt-1 block text-sm leading-snug text-muted">{detail}</span>
        <span className="mt-1.5 block text-sm text-fg">{attempts}</span>
      </span>
    </>
  );
}

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
    <div className={locked ? "opacity-60" : ""} inert={locked}>
      <ul className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <li>
          <a
            href="https://www.instagram.com/machrundotcom/"
            target="_blank"
            rel="noopener noreferrer"
            className={`${EARN_CELL} hover:bg-elevated`}
          >
            <EarnFace
              points="20"
              title="Follow on Instagram"
              detail="Follow MACH RUN."
              attempts="1 possible attempt"
            />
          </a>
        </li>
        <li>
          <a
            href="https://www.linkedin.com/company/machrun-com/"
            target="_blank"
            rel="noopener noreferrer"
            className={`${EARN_CELL} hover:bg-elevated`}
          >
            <EarnFace
              points="20"
              title="Follow on LinkedIn"
              detail="Follow MACH RUN."
              attempts="1 possible attempt"
            />
          </a>
        </li>
        <li>
          <Link to="/" className={`${EARN_CELL} hover:bg-elevated`}>
            <EarnFace
              points="100"
              title="First MACH RUN"
              detail="Type your household, complete the OODA Loop, execute the MACH RUN. These points are not earned with a Hale Demo run, but your real household numbers."
              attempts="1 possible attempt"
            />
          </Link>
        </li>
        <li>
          <Link to="/" className={`${EARN_CELL} hover:bg-elevated`}>
            <EarnFace
              points="10"
              title="Run the loop again."
              detail="Change your MACH RUN as you iterate and adapt to new information. 10 points earned once a month maximum."
              attempts="1 possible attempt a month"
            />
          </Link>
        </li>
        <li>
          <button type="button" onClick={scrollToLink} className={`${EARN_CELL} hover:bg-elevated`}>
            <EarnFace
              points="200"
              title="Refer a friend"
              detail="Earn 200 points when a referred friend signs up for a yearly plan."
              attempts="Unlimited possible attempts"
            />
          </button>
        </li>
        <li>
          {betaInvited === false ? (
            <div className={EARN_CELL}>
              <EarnFace
                points="450"
                note="possible"
                title="Beta debrief"
                detail={
                  <>
                    You are not currently a beta tester. To become a beta tester for MACH RUN and have the chance to
                    receive additional MR points and a free hat, please{" "}
                    <Link to="/beta-request" className="text-fg underline underline-offset-4">
                      click here
                    </Link>
                    .
                  </>
                }
                attempts="3 possible attempts"
              />
            </div>
          ) : (
            <Link to="/beta" className={`${EARN_CELL} hover:bg-elevated`}>
              <EarnFace
                points="450"
                note="possible"
                title="Beta debrief"
                detail={
                  earned == null
                    ? "Loading…"
                    : `${earned} of ${BETA_PASS_CAP * BETA_PASS_POINTS} earned. ${submitted} of ${BETA_PASS_CAP} feedback forms submitted.`
                }
                attempts="3 possible attempts"
              />
            </Link>
          )}
        </li>
        <li>
          <Link to="/review" className={`${EARN_CELL} hover:bg-elevated`}>
            <EarnFace points="100" title="Short review" detail="Stars, your name, and 250 characters." attempts="1 possible attempt" />
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
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
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
        if (live) {
          setAccepted(row.accepted);
          setAcceptedAt(row.acceptedAt);
        }
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
      setAcceptedAt(new Date().toISOString());
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
              since={memberYear(acceptedAt)}
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
