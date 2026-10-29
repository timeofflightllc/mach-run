import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PrimaryButton } from "@/components/ui/field";
import { formatMonthYear, monthStart, validIso } from "@/lib/plan/dates";
import {
  recommendedRetirementBluf,
  recommendedRetirementCopy,
  type RecommendedRetirement,
} from "@/lib/plan/earliest-retirement";
import { monthlyIncomeAt } from "@/lib/plan/engine";
import { usd } from "@/lib/plan/format";
import type { SurvivalScore } from "@/lib/plan/monte-carlo-run";
import { nestEggTrack, peerBriefing, peerRankLine, type PeerBrief, type PeerMark } from "@/lib/plan/peers";
import type { Plan, SimResult } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

export function NestEggHeadline({
  egg,
}: {
  egg: NonNullable<ReturnType<typeof nestEggTrack>>;
}) {
  const byAge = egg.targetAge != null ? ` (age ${egg.targetAge})` : "";
  const mark = (word: string) => (
    <span className="font-bold underline decoration-2 underline-offset-[3px]">
      {word}
    </span>
  );
  if (egg.onTrack) {
    return (
      <>
        You {mark("are")} on track for {usd(egg.goal)} by {egg.targetYear}
        {byAge}.
      </>
    );
  }
  return (
    <>
      You are {mark("not")} on track for {usd(egg.goal)} by {egg.targetYear}
      {byAge}.
    </>
  );
}

export function Verdict({
  plan,
  sim,
  brief,
  survival: _survival,
  survivalUnlocked = false,
  className,
}: {
  plan: Plan;
  sim: SimResult;
  brief?: PeerBrief | null;
  survival?: SurvivalScore | null;
  /** Individual Unlimited or Advisor. Free and Individual do not get the run. */
  survivalUnlocked?: boolean;
  className?: string;
}) {
  const real = plan.assumptions.dollars === "real";
  const atTerm = real ? sim.spendableAtEndReal : sim.spendableAtEnd;
  const unit = real ? "today's dollars" : "nominal";
  const incomeNow = monthlyIncomeAt(plan, monthStart(plan.assumptions.asOfDate));
  const hasIncome =
    incomeNow > 0 ||
    plan.incomes.some((i) => i.monthlyAmount > 0 || (i.ssPia ?? 0) > 0) ||
    sim.years.some((y) => y.income > 1);

  let body: string;
  if (!hasIncome) {
    body = `No income on the run yet. Add a named paycheck under Income — amount, start, and end — and hit Calculate.`;
  } else if (sim.depletedAge != null) {
    body = `Spendable accounts run out at age ${sim.depletedAge} (${sim.depletedYear}). Raise income, extend a stage, or cut spending before that date.`;
  } else {
    body = `Your current plan funds spending through age ${plan.assumptions.projectionEndAge} with ${usd(atTerm)} remaining (${unit}).`;
  }

  const ret = sim.retirement;
  let retLine = "";
  if (!ret && !plan.assumptions.retirementGoalDate) {
    retLine = "Set a retirement goal date in Goals to key the Spendable strip.";
  }

  const rank = brief ? peerRankLine(brief) : null;
  const egg = nestEggTrack(plan, sim);

  return (
    <div className={cn("@container/bluf flex h-full flex-col rounded-xl bg-white px-5 py-5 shadow-[0_0_0_1px_#d5d0c6] sm:px-6", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d4a54]">
        BLUF (Bottom Line Up Front)
      </p>
      <p className="mt-2 font-sans text-[1.15rem] font-medium leading-snug text-[#1a2330] sm:text-[1.65rem] sm:leading-tight">
        {egg ? <NestEggHeadline egg={egg} /> : body}
      </p>
      {egg ? (
        <p className="mt-2 text-sm leading-snug text-[#1a2330] sm:text-base">{body}</p>
      ) : null}
      {retLine ? (
        <p className="mt-3 text-sm leading-relaxed text-[#3d4a54]">{retLine}</p>
      ) : null}
      {rank && brief ? <PeerRankBlock rank={rank} plan={plan} brief={brief} /> : null}
      {survivalUnlocked ? null : (
        <p className="mt-4 rounded-xl bg-[#f3f0e8] px-3.5 py-3 text-xs leading-relaxed text-[#3d4a54]">
          <Link
            to="/pricing"
            className="font-medium text-accent underline underline-offset-2 hover:text-fg"
          >
            Upgrade
          </Link>{" "}
          <span>to access Plan Survival (Monte Carlo Simulations)</span>
        </p>
      )}
    </div>
  );
}

const PEER_ZONES = [
  { width: "69%", light: "color-mix(in srgb, #7eb6ea 42%, white)", ink: "#7eb6ea" },
  { width: "20%", light: "color-mix(in srgb, #6ecfc4 42%, white)", ink: "#6ecfc4" },
  { width: "11%", light: "color-mix(in srgb, #3caf62 42%, white)", ink: "#3caf62" },
];

function PeerMeter({ mark }: { mark: PeerMark }) {
  const pct = Math.min(100, Math.max(0, mark.percentile));
  const tick = Math.min(98, Math.max(2, pct));
  return (
    <div>
      <p className="min-w-0 text-xs leading-snug text-[#3d4a54]">
        <span className="font-semibold text-[#1a2330]">{mark.name}</span>
        <span> · {mark.group}</span>
      </p>
      <div
        className="relative mt-1 pt-6"
        role="img"
        aria-label={`${mark.name}: ${mark.place} of ${mark.group}`}
      >
        <div className="relative h-5 overflow-hidden rounded-full">
          <div className="absolute inset-0 flex">
            {PEER_ZONES.map((zone) => (
              <div key={zone.light} style={{ width: zone.width, background: zone.light }} />
            ))}
          </div>
          {pct > 0 ? (
            <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
              <div className="flex h-full" style={{ width: `${10000 / pct}%` }}>
                {PEER_ZONES.map((zone) => (
                  <div key={zone.ink} style={{ width: zone.width, background: zone.ink }} />
                ))}
              </div>
            </div>
          ) : null}
          <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[#1a1a1a]" style={{ left: `${tick}%` }} />
        </div>
        <div
          className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${tick}%` }}
        >
          <span className="whitespace-nowrap text-[11px] font-semibold leading-none text-[#1a2330]">
            {mark.place}
          </span>
          <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true" className="mt-[5px]">
            <polygon points="6,8 0.5,0 11.5,0" fill="#1a1a1a" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function PeerRankBlock({
  rank,
  plan,
  brief,
}: {
  rank: NonNullable<ReturnType<typeof peerRankLine>>;
  plan: Plan;
  brief: PeerBrief;
}) {
  const briefing = peerBriefing(plan, brief, rank.marks);
  return (
    <div className="mt-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d4a54]">{rank.title}</p>
      {briefing ? <p className="mt-1 text-sm font-medium leading-snug text-[#1a2330]">{briefing}</p> : null}
      <div className="mt-3 space-y-4">
        {rank.marks.map((mark) => (
          <PeerMeter key={mark.name} mark={mark} />
        ))}
      </div>
    </div>
  );
}

export function RecommendedRetirement({
  plan,
  rec,
  onUse,
  copy = true,
  bluf = false,
}: {
  plan: Plan;
  rec: RecommendedRetirement;
  onUse?: (date: string) => void;
  /** Analysis already prints the sentence. The button still sits under that section. */
  copy?: boolean;
  /** One line in the BLUF. The long note stays in the analysis. */
  bluf?: boolean;
}) {
  const [ask, setAsk] = useState(false);
  const goal = plan.assumptions.retirementGoalDate;
  const same =
    Boolean(rec.date) &&
    Boolean(goal && validIso(goal) && goal.slice(0, 7) === rec.date?.slice(0, 7));
  const canUse = Boolean(rec.date && onUse && !same);

  return (
    <div className={copy ? "mt-3" : "mt-2"}>
      {copy ? (
        <p className="text-sm font-medium leading-relaxed text-fg">
          {bluf ? recommendedRetirementBluf(plan, rec) : recommendedRetirementCopy(plan, rec)}
        </p>
      ) : null}
      {canUse && !ask ? (
        <PrimaryButton
          className="mt-2 h-9 w-auto px-3 text-sm"
          onClick={() => setAsk(true)}
        >
          Use this recommended retirement date
        </PrimaryButton>
      ) : null}
      {canUse && ask && rec.date ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm leading-relaxed text-fg">
            Set the retirement goal date in Observe to {formatMonthYear(rec.date)} and re-run
            this MACH RUN on that date?
          </p>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              className="h-9 w-auto px-3 text-sm"
              onClick={() => {
                setAsk(false);
                onUse?.(rec.date as string);
              }}
            >
              Re-run the MACH RUN
            </PrimaryButton>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted hover:text-fg"
              onClick={() => setAsk(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
