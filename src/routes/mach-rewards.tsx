import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
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
import { acceptRewardsTermsFn, applyRewardPointsFn, instagramRewardCodeFn, rewardLedgerFn, rewardsAcceptanceFn } from "@/lib/rewards/api";
import type { RewardGrant } from "@/lib/rewards/balance.server";
import type { RewardStanding } from "@/lib/rewards/standing";
import { rewardTier, type RewardTier } from "@/lib/rewards/tier";
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

const SILVER_METAL = [
  "radial-gradient(circle at 50% 58%, rgba(255,255,255,0.45) 0 8%, transparent 9% 12%, rgba(70,66,60,0.05) 13% 16%, transparent 17% 22%, rgba(70,66,60,0.04) 23% 26%, transparent 27%)",
  "linear-gradient(118deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.08) 26%, rgba(255,255,255,0) 42%, rgba(255,255,255,0.2) 58%, rgba(40,36,32,0.06) 74%, rgba(255,255,255,0.5) 100%)",
  "repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0 1px, rgba(70,66,60,0.035) 1px 3px)",
  "linear-gradient(160deg, #f6f3ec 0%, #d8d4ca 30%, #a29e96 54%, #ece7dc 76%, #c2beb4 100%)",
].join(",");

const CARD_METAL: Record<
  RewardTier,
  { face: string; border: string; borderSoft: string; background: string }
> = {
  Green: {
    face: "text-[#e7c56a] [text-shadow:0_1px_0_rgba(0,0,0,0.35)]",
    border: "border-[#d4b15a]/90",
    borderSoft: "border-[#e7c56a]/40",
    background: [
      "radial-gradient(circle at 50% 58%, rgba(255,236,180,0.2) 0 8%, transparent 9% 12%, rgba(0,0,0,0.16) 13% 16%, transparent 17% 22%, rgba(0,0,0,0.1) 23% 26%, transparent 27%)",
      "linear-gradient(118deg, rgba(255,228,160,0.28) 0%, rgba(255,255,255,0.05) 26%, rgba(255,255,255,0) 42%, rgba(255,214,120,0.12) 58%, rgba(0,0,0,0.2) 74%, rgba(255,228,160,0.16) 100%)",
      "repeating-linear-gradient(90deg, rgba(255,236,190,0.08) 0 1px, rgba(0,0,0,0.1) 1px 3px)",
      "linear-gradient(160deg, #1a6b45 0%, #0c4a30 30%, #072e20 54%, #12573a 76%, #083526 100%)",
    ].join(","),
  },
  Silver: {
    face: "text-[#2c2926] [text-shadow:0_1px_0_rgba(255,255,255,0.65)]",
    border: "border-[#2c2926]/80",
    borderSoft: "border-[#2c2926]/30",
    background: SILVER_METAL,
  },
  Gold: {
    face: "text-[#1a140e] [text-shadow:0_1px_0_rgba(255,248,220,0.55)]",
    border: "border-[#1a140e]/80",
    borderSoft: "border-[#1a140e]/30",
    background: [
      "radial-gradient(circle at 50% 58%, rgba(255,255,255,0.5) 0 8%, transparent 9% 12%, rgba(90,58,16,0.08) 13% 16%, transparent 17% 22%, rgba(90,58,16,0.06) 23% 26%, transparent 27%)",
      "linear-gradient(118deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.08) 26%, rgba(255,255,255,0) 42%, rgba(255,248,220,0.22) 58%, rgba(70,42,8,0.08) 74%, rgba(255,255,255,0.5) 100%)",
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 1px, rgba(90,58,16,0.045) 1px 3px)",
      "linear-gradient(160deg, #f8e8b8 0%, #e0c06a 30%, #b8862f 54%, #f3dc94 76%, #c9a24a 100%)",
    ].join(","),
  },
  Platinum: {
    face: "text-[#111111] [text-shadow:0_1px_0_rgba(255,255,255,0.8)]",
    border: "border-[#111111]/80",
    borderSoft: "border-[#111111]/30",
    background: [
      "radial-gradient(circle at 50% 58%, rgba(255,255,255,0.7) 0 8%, transparent 9% 12%, rgba(70,96,120,0.06) 13% 16%, transparent 17% 22%, rgba(70,96,120,0.045) 23% 26%, transparent 27%)",
      "linear-gradient(118deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.16) 26%, rgba(255,255,255,0) 42%, rgba(255,255,255,0.34) 58%, rgba(40,60,80,0.05) 74%, rgba(255,255,255,0.72) 100%)",
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.34) 0 1px, rgba(70,96,120,0.04) 1px 3px)",
      "linear-gradient(160deg, #ffffff 0%, #e7eef6 30%, #c5d2e0 54%, #f7fbff 76%, #d5e1ec 100%)",
    ].join(","),
  },
};

function memberYear(iso: string | null): string | null {
  if (!iso) return null;
  const year = new Date(iso).getFullYear();
  if (!Number.isFinite(year)) return null;
  return String(year).slice(-2);
}

function PlatinumCard({
  earned,
  balance,
  name,
  since,
  tier,
}: {
  earned: number | null;
  balance: number | null;
  name: string | null;
  since: string | null;
  tier: RewardTier;
}) {
  const metal = CARD_METAL[tier];
  return (
    <div
      className={`relative mx-auto w-full max-w-lg overflow-hidden rounded-[1rem] shadow-[0_18px_34px_-22px_rgba(30,28,24,0.72),inset_0_1px_0_rgba(255,255,255,0.8)] ${metal.face}`}
      style={{ aspectRatio: "1.586 / 1", containerType: "inline-size", fontFamily: "var(--font-card)" }}
    >
      <div aria-hidden className="absolute inset-0" style={{ background: metal.background }} />
      <div aria-hidden className={`absolute inset-[3.4%] rounded-[0.7rem] border ${metal.border}`} />
      <div aria-hidden className={`absolute inset-[5%] rounded-[0.55rem] border ${metal.borderSoft}`} />

      <div className="relative flex h-full flex-col items-center px-[7%] pt-[6%]">
        <div className="flex w-max max-w-full flex-col items-center">
          <p className="whitespace-nowrap text-center text-[5.6cqw] font-bold leading-none tracking-[0.06em]">
            MACH REWARDS
          </p>
          <p className="mt-[1.2cqw] flex justify-center gap-[0.62em] text-[3.5cqw] font-semibold leading-none">
            {tier.toUpperCase().split("").map((letter, index) => (
              <span key={`${letter}-${index}`}>{letter}</span>
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
        src="/brand/rewards-pilot.jpg?v=55p"
        alt=""
        className="pointer-events-none absolute left-1/2 top-[53%] h-[54%] w-[32%] -translate-x-1/2 -translate-y-1/2 object-cover"
        style={{ clipPath: "ellipse(46% 46% at 50% 50%)" }}
      />

      <div className="absolute right-[8%] top-[38%] -translate-y-1/2 text-right">
        <p className="whitespace-nowrap text-[2.3cqw] font-semibold tracking-[0.12em]">Lifetime Points</p>
        <p className="mt-[0.4cqw] text-[6.2cqw] font-bold leading-none tabular-nums">
          {earned == null ? "—" : earned}
        </p>
      </div>

      <div className="absolute right-[7.5%] top-[60%] flex w-[27%] flex-col items-center">
        <div className="relative flex w-full items-center justify-center">
          <svg viewBox="0 0 140 22" className="absolute inset-0 h-full w-full" aria-hidden>
            <path d="M8 1.5 H132 L138.5 11 L132 20.5 H8 L1.5 11 Z" fill="none" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          <p className="relative px-[0.7em] py-[0.45em] text-[1.85cqw] font-semibold leading-none tracking-[0.14em]">
            MEMBER SINCE
          </p>
        </div>
        <p className="mt-[0.7cqw] text-[3.1cqw] font-bold leading-none tabular-nums">{since ?? "—"}</p>
      </div>

      <p className="absolute bottom-[6.5%] left-[8%] right-[46%] truncate text-[3.3cqw] font-semibold tracking-[0.12em] uppercase">
        {name ?? ""}
      </p>
      <div className="absolute bottom-[6.5%] right-[8%] text-right">
        <p className="whitespace-nowrap text-[2.5cqw] font-semibold leading-none tabular-nums">
          Points Balance: {balance == null ? "—" : balance}
        </p>
        <p className="mt-[0.9cqw] text-[3.3cqw] font-semibold leading-none tabular-nums">
          Value: {balance == null ? "—" : rewardDollars(balance)}
        </p>
      </div>
    </div>
  );
}

function RewardsCardDraft() {
  const touch = useTouchCards();
  const samples: { tier: RewardTier; earned: number; balance: number }[] = [
    { tier: "Green", earned: 40, balance: 40 },
    { tier: "Silver", earned: 240, balance: 180 },
    { tier: "Gold", earned: 860, balance: 610 },
    { tier: "Platinum", earned: 1500, balance: 1240 },
  ];
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full max-w-xl space-y-8">
        <PageMast />
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">Draft</p>
          <h1 className="font-display text-3xl tracking-tight">Card faces</h1>
          <p className="mt-2 text-sm text-muted">Preview only. Not a live account.</p>
        </header>
        {samples.map((sample) => (
          <PlatinumCard
            key={sample.tier}
            tier={sample.tier}
            earned={sample.earned}
            balance={sample.balance}
            name="Jordan Hale"
            since="26"
          />
        ))}
        <div className="overflow-clip rounded-xl bg-border">
          <ul className="grid grid-cols-1 gap-px sm:grid-cols-2">
            {[
              ["Follow on Instagram", "20 points possible", "0 earned", "20 left"],
              ["Run the loop", "10 points possible", "10 earned", "0 left"],
            ].map(([title, possible, earned, left]) => (
              <li key={title} className="[perspective:900px]">
                <FlipCard
                  touch={touch}
                  title={title}
                  possible={possible}
                  earned={earned}
                  left={left}
                  done={left.startsWith("0")}
                  detail={<p>The back stays the light face. Hover, or tap the arrow, to turn it.</p>}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
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

const SILVER =
  "shadow-[inset_0_0_0_1px_rgba(198,204,212,0.95),inset_0_1px_0_rgba(255,255,255,0.9)] bg-surface bg-[linear-gradient(145deg,rgba(255,255,255,0.78),rgba(255,255,255,0.04)_46%,rgba(150,158,168,0.22))] text-fg";
const GREEN =
  "text-[#f6f1e6] shadow-[inset_0_0_0_1px_rgba(231,197,106,0.42),inset_0_1px_0_rgba(255,255,255,0.16)] bg-[#0e4a32] bg-[linear-gradient(165deg,rgba(255,236,190,0.16),transparent_46%,rgba(0,0,0,0.16))]";

function fineHover() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function useTouchCards() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setTouch(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return touch;
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function InstagramCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  function openInstagram(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    window.open("https://www.instagram.com/machrundotcom/", "_blank", "noopener,noreferrer");
  }
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <p className="font-mono text-base tracking-[0.14em]">{code}</p>
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy code"}
        onClick={(event) => void copy(event)}
        className="grid size-8 shrink-0 place-items-center rounded-md text-fg hover:bg-fg/10"
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
      <button
        type="button"
        aria-label="Open Instagram"
        onClick={openInstagram}
        className="grid size-8 shrink-0 place-items-center rounded-md text-fg hover:bg-fg/10"
      >
        <InstagramMark />
      </button>
    </div>
  );
}

function FlipCard({
  title,
  possible,
  earned,
  left,
  done: _done,
  detail,
  href,
  to,
  onOpen,
  touch,
}: {
  title: string;
  possible: string;
  earned: string;
  left: string;
  done: boolean;
  detail: ReactNode;
  href?: string;
  to?: "/" | "/beta" | "/beta-request" | "/review";
  onOpen?: () => void;
  touch: boolean;
}) {
  const navigate = useNavigate();
  const [turned, setTurned] = useState(false);
  const pad = touch ? "pl-4 pr-11 pt-3 pb-12" : "px-4 py-3";
  function enter() {
    if (fineHover()) setTurned(true);
  }
  function leave() {
    if (fineHover()) setTurned(false);
  }
  function press(event: { preventDefault(): void }) {
    if (!fineHover() && !turned) {
      event.preventDefault();
      setTurned(true);
    }
  }
  function flip(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setTurned((value) => !value);
  }
  function go(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    if (to) {
      void navigate({ to });
      return;
    }
    onOpen?.();
  }
  const front = (
    <>
      <p className="text-base font-medium leading-tight tracking-[0.01em] text-[#f6f1e6]">{title}</p>
      <p className="text-sm tabular-nums text-[#e7c56a]">{possible}</p>
      <p className="text-sm tabular-nums text-[#d7cbb6]">{earned}</p>
      <p className="text-sm tabular-nums text-[#d7cbb6]">{left}</p>
    </>
  );
  const faces = (
    <div
      data-fit
      className={`grid h-full w-full [grid-template-rows:1fr] transition-transform duration-500 [transform-style:preserve-3d] ${turned ? "[transform:rotateY(180deg)]" : ""}`}
    >
      <div className={`invisible col-start-1 row-start-1 flex flex-col gap-1 ${pad}`} aria-hidden>
        {front}
      </div>
      <div className={`invisible col-start-1 row-start-1 text-sm leading-snug ${pad}`} aria-hidden>
        {detail}
      </div>
      <div className={`col-start-1 row-start-1 flex h-full flex-col justify-center gap-1 [backface-visibility:hidden] ${pad} ${GREEN}`}>
        {front}
      </div>
      <div
        className={`col-start-1 row-start-1 h-full text-sm leading-snug [backface-visibility:hidden] [transform:rotateY(180deg)] ${pad} ${SILVER}`}
      >
        {detail}
      </div>
    </div>
  );
  const controls = (
    <>
      <button
        type="button"
        aria-label="Flip card"
        onClick={flip}
        className="absolute top-2 right-2 z-10 grid size-8 place-items-center rounded-full bg-[#f6f1e6] text-[#0e4a32] shadow-[0_0_0_1px_rgba(14,74,50,0.2)]"
      >
        <RefreshCw className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={go}
        className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-md bg-[#e7c56a] px-4 py-1.5 text-sm font-medium text-[#072e20]"
      >
        Go
      </button>
    </>
  );
  const className = "block h-full w-full text-left outline-none";
  if (touch) {
    return (
      <div className={`relative ${className}`}>
        {faces}
        {controls}
      </div>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} onMouseEnter={enter} onMouseLeave={leave} onClick={press}>
        {faces}
      </a>
    );
  }
  if (to) {
    return (
      <Link to={to} className={className} onMouseEnter={enter} onMouseLeave={leave} onClick={press}>
        {faces}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onMouseEnter={enter} onMouseLeave={leave} onClick={(event) => {
      press(event);
      if (fineHover() || turned) onOpen?.();
    }}>
      {faces}
    </button>
  );
}

function EarnBingo({
  betaSubmitted,
  betaInvited,
  referralEarned,
  instagramCode,
  instagramEarned,
  loopDone,
  locked,
}: {
  betaSubmitted: number | null;
  betaInvited: boolean | null;
  referralEarned: number | null;
  instagramCode: string | null;
  instagramEarned: number;
  loopDone: boolean;
  locked: boolean;
}) {
  const boardRef = useRef<HTMLUListElement>(null);
  const touch = useTouchCards();
  function scrollToLink() {
    document.getElementById("referral-link")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const submitted = betaSubmitted == null ? null : Math.min(Math.max(betaSubmitted, 0), BETA_PASS_CAP);
  const betaEarned = submitted == null ? null : betaRewardPoints(submitted);
  const betaPossible = BETA_PASS_CAP * BETA_PASS_POINTS;
  const betaDone = betaEarned === betaPossible;
  const instagramPoints = Math.max(0, instagramEarned);

  useEffect(() => {
    const ul = boardRef.current;
    if (!ul) return;
    const fit = () => {
      const cards = [...ul.querySelectorAll<HTMLElement>("[data-fit]")];
      if (cards.length === 0) return;
      for (const card of cards) card.style.minHeight = "0px";
      const max = Math.max(...cards.map((card) => card.getBoundingClientRect().height));
      const next = `${Math.ceil(max)}px`;
      for (const card of cards) card.style.minHeight = next;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [betaSubmitted, betaInvited, referralEarned, instagramCode, instagramEarned, loopDone, locked, touch]);

  return (
    <div className={`overflow-clip rounded-xl bg-border ${locked ? "opacity-60" : ""}`} inert={locked}>
      <ul ref={boardRef} className="grid grid-cols-1 gap-px sm:grid-cols-2 xl:grid-cols-4">
        <li className="[perspective:900px]">
          <FlipCard touch={touch}
            title="Follow on Instagram"
            possible="20 points possible"
            earned={`${instagramPoints} earned`}
            left={`${Math.max(0, 20 - instagramPoints)} left`}
            done={instagramPoints >= 20}
            href="https://www.instagram.com/machrundotcom/"
            detail={
              <>
                <p>
                  Follow @machrundotcom, then send this code in a direct message to that account.
                </p>
                {instagramCode ? <InstagramCode code={instagramCode} /> : null}
                <p className="mt-2">
                  The points post after that message arrives. A second message does not pay again.
                </p>
              </>
            }
          />
        </li>
        <li className="[perspective:900px]">
          <FlipCard touch={touch}
            title="Follow on LinkedIn"
            possible="20 points possible"
            earned="0 earned"
            left="20 left"
            done={false}
            href="https://www.linkedin.com/company/machrun-com/"
            detail={
              <>
                <p>
                  Open the MACH RUN company page on LinkedIn and tap Follow. One follow, one time. That is 20 points.
                </p>
                <p className="mt-2">1 possible attempt</p>
              </>
            }
          />
        </li>
        <li className="[perspective:900px]">
          <FlipCard touch={touch}
            title="First MACH RUN"
            possible="100 points possible"
            earned="0 earned"
            left="100 left"
            done={false}
            to="/"
            detail={
              <>
                <p>
                  Type your household, complete the OODA Loop, execute the MACH RUN. These points are not earned with a Hale Demo run, but your real household numbers.
                </p>
                <p className="mt-2">1 possible attempt</p>
              </>
            }
          />
        </li>
        <li className="[perspective:900px]">
          <FlipCard touch={touch}
            title="Run the loop again."
            possible="10 points possible"
            earned={loopDone ? "10 earned" : "0 earned"}
            left={loopDone ? "0 left" : "10 left"}
            done={loopDone}
            to="/"
            detail={
              <>
                <p>Change your MACH RUN as you iterate and adapt to new information. 10 points earned once a month maximum.</p>
                <p className="mt-2">1 possible attempt a month</p>
              </>
            }
          />
        </li>
        <li className="[perspective:900px]">
          <FlipCard touch={touch}
            title="Refer a friend"
            possible="200 points per friend"
            earned={referralEarned == null ? "— earned" : `${referralEarned} earned`}
            left="Unlimited"
            done={false}
            onOpen={scrollToLink}
            detail={
              <>
                <p>Earn 200 points when a referred friend signs up for a yearly plan.</p>
                <p className="mt-2">Unlimited possible attempts</p>
              </>
            }
          />
        </li>
        <li className="[perspective:900px]">
          {betaInvited === false ? (
            <FlipCard touch={touch}
              title="Beta Test Debrief"
              possible={`${betaPossible} points possible`}
              earned="0 earned"
              left={`${betaPossible} left`}
              done={false}
              to="/beta-request"
              detail={
                <>
                  <p>
                    You are not currently a beta tester. To become a beta tester for MACH RUN and have the chance to receive additional MR points and a free hat, please click here.
                  </p>
                  <p className="mt-2">3 possible attempts</p>
                </>
              }
            />
          ) : (
            <FlipCard touch={touch}
              title="Beta Test Debrief"
              possible={`${betaPossible} points possible`}
              earned={betaEarned == null ? "— earned" : `${betaEarned} earned`}
              left={betaEarned == null ? "— left" : `${betaPossible - betaEarned} left`}
              done={betaDone}
              to="/beta"
              detail={
                <>
                  <p>
                    {betaEarned == null
                      ? "Loading…"
                      : `${betaEarned} of ${betaPossible} earned. ${submitted} of ${BETA_PASS_CAP} feedback forms submitted.`}
                  </p>
                  <p className="mt-2">3 possible attempts</p>
                </>
              }
            />
          )}
        </li>
        <li className="[perspective:900px]">
          <FlipCard touch={touch}
            title="Write a review"
            possible="100 points possible"
            earned="0 earned"
            left="100 left"
            done={false}
            to="/review"
            detail={
              <>
                <p>Rate MACH RUN out of 5 stars, and leave a short review (335 characters max). Thank you!</p>
                <p className="mt-2">1 possible attempt</p>
              </>
            }
          />
        </li>
        <li className="[perspective:900px]">
          <FlipCard touch={touch}
            title="Pass the word"
            possible="20 points possible"
            earned="0 earned"
            left="20 left"
            done={false}
            onOpen={scrollToLink}
            detail={
              <>
                <p>
                  Send machrun.com to one person who is still guessing. A text, an email, or a post. One time.
                </p>
                <p className="mt-2">
                  This is not the referral. That one pays 200 points when they start a yearly plan.
                </p>
                <p className="mt-2">1 possible attempt</p>
              </>
            }
          />
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
  const [ledger, setLedger] = useState<(RewardStanding & { grants: RewardGrant[] }) | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyPoints, setApplyPoints] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyNote, setApplyNote] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instagramCode, setInstagramCode] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isRealUser(user) || accepted !== true) return;
    let live = true;
    void instagramRewardCodeFn()
      .then((row) => {
        if (live) setInstagramCode(row.code);
      })
      .catch(() => {
        if (live) setInstagramCode(null);
      });
    return () => {
      live = false;
    };
  }, [user, accepted]);

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
      setLedger((current) =>
        current
          ? { ...current, earned: result.earned, spent: result.spent, balance: result.balance }
          : current,
      );
      setApplyNote(result.line);
      setApplyOpen(false);
      setApplyPoints(null);
    } catch {
      setApplyError("Those points were not applied. Your balance is unchanged.");
    } finally {
      setApplying(false);
    }
  }

  if (!isRealUser(user) && import.meta.env.DEV) return <RewardsCardDraft />;
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
            <label className="flex items-start gap-3 text-sm leading-relaxed text-fg">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-fg"
              />
              <span>I have read and agree to the Mach Rewards Terms.</span>
            </label>
            {joinError ? <p className="text-sm text-negative">{joinError}</p> : null}
            <PrimaryButton type="submit" disabled={!agreed || joining}>
              {joining ? "Joining…" : "Join Mach Rewards"}
            </PrimaryButton>
          </form>
        ) : null}

        {error ? <p className="text-sm text-negative">{error}</p> : null}

        <section className="w-full rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
          <div className="px-5 py-6 sm:px-6 sm:py-7">
            <PlatinumCard
              earned={ledger == null ? null : ledger.earned}
              balance={ledger == null ? null : ledger.balance}
              name={user?.displayName?.trim() || null}
              since={memberYear(acceptedAt)}
              tier={ledger == null ? "Green" : rewardTier(ledger.earned, acceptedAt)}
            />
            <p className="mt-4 text-center text-sm tabular-nums text-fg">
              Earned {ledger == null ? "—" : ledger.earned} · Spent {ledger == null ? "—" : ledger.spent} · Balance{" "}
              {ledger == null ? "—" : ledger.balance}
            </p>
            <div className={`mt-5 ${accepted === true ? "" : "pointer-events-none opacity-50 select-none"}`}>
              <div className="flex justify-center">
                <PrimaryButton
                  disabled={accepted !== true || ledger == null || ledger.balance <= 0 || applyOpen || applying}
                  onClick={() => {
                    setApplyOpen(true);
                    setApplyPoints(null);
                    setApplyError(null);
                  }}
                >
                  Apply Mach Rewards to your next bill
                </PrimaryButton>
              </div>
              {applyOpen && ledger && accepted === true ? (
                <fieldset className="mt-4 flex flex-col items-center gap-3">
                  <div className="space-y-3">
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
                  </div>
                  {applyError ? <p className="text-sm text-negative">{applyError}</p> : null}
                  <PrimaryButton disabled={applyPoints == null || applying} onClick={() => void onApply()}>
                    {applying ? "Applying…" : "Apply to my next bill"}
                  </PrimaryButton>
                </fieldset>
              ) : null}
              {applyNote ? <p className="mt-3 text-center text-sm text-fg">{applyNote}</p> : null}
            </div>
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
                        {grant.source === "beta"
                          ? "Beta debrief"
                          : grant.source === "instagram"
                            ? "Instagram"
                            : grant.source === "loop"
                              ? "Run the loop again."
                              : "Referred a friend"}
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

        <EarnBingo
          betaSubmitted={betaSubmitted}
          betaInvited={betaInvited}
          referralEarned={
            ledger ? ledger.grants.filter((grant) => grant.source === "referral").reduce((sum, grant) => sum + grant.points, 0) : null
          }
          instagramCode={instagramCode}
          instagramEarned={
            ledger
              ? ledger.grants
                  .filter((grant) => grant.source === "instagram")
                  .reduce((sum, grant) => sum + grant.points, 0)
              : 0
          }
          loopDone={
            ledger
              ? ledger.grants.some(
                  (grant) =>
                    grant.source === "loop" &&
                    grant.date.startsWith(new Date().toISOString().slice(0, 7)),
                )
              : false
          }
          locked={accepted !== true}
        />

        <div className="space-y-3">
          <h2 className="font-display text-2xl text-fg">Referrals</h2>
          <section id="referral-link" className="w-full scroll-mt-6 space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)] sm:p-6">
          <p className="max-w-xl text-base leading-relaxed text-muted">
            When a friend starts a yearly plan, those points land in Mach Rewards. Nothing comes off a bill until you apply them. 10 points is $1.
          </p>
          <ReferralLinkLine code={summary?.code ?? null} locked={accepted !== true} />
          <p className="text-base leading-relaxed text-fg">
            {summary ? referralCountLine(summary.signedUp, summary.yearly) : "Loading your rewards…"}
          </p>
        </section>
        </div>

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
