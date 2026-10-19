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
import { runOutSentence, survivalSentence, type SurvivalScore } from "@/lib/plan/monte-carlo-run";
import { nestEggTrack, peerRankLine, type PeerBrief } from "@/lib/plan/peers";
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
  survival,
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
    body = `The plan funds spending through age ${plan.assumptions.projectionEndAge} with ${usd(atTerm)} remaining (${unit}).`;
  }

  const ret = sim.retirement;
  let retLine = "";
  if (!ret && !plan.assumptions.retirementGoalDate) {
    retLine = "Set a retirement goal date in Goals to key the Spendable strip.";
  }

  const rank = brief ? peerRankLine(brief) : null;
  const longevityAge = plan.assumptions.projectionEndAge;
  const ranOut = survival ? runOutSentence(survival, longevityAge) : null;
  const egg = nestEggTrack(plan, sim);

  return (
    <div className={cn("@container/bluf flex h-full flex-col rounded-2xl bg-surface px-5 py-5 shadow-[0_1px_2px_rgba(26,35,48,0.05),0_0_0_1px_var(--color-border)] sm:px-6", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        BLUF (Bottom Line Up Front)
      </p>
      <p className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight text-fg sm:text-2xl">
        {egg ? <NestEggHeadline egg={egg} /> : body}
      </p>
      {egg ? (
        <p className="mt-2 text-base leading-snug text-fg">{body}</p>
      ) : null}
      {retLine ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">{retLine}</p>
      ) : null}
      <div className={cn("mt-4 grid items-start gap-3", rank && "@min-[40rem]/bluf:grid-cols-2")}>
          {rank ? (
            <div className="rounded-xl bg-bg px-3.5 py-3">
              <p className="text-sm font-semibold text-fg">
                {rank.title}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-left text-sm leading-snug text-fg">
                {rank.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {survivalUnlocked ? (
            <div className="rounded-xl bg-bg px-3.5 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                Plan Survival
              </p>
              {survival ? (
                <p className="mt-2 text-sm leading-snug text-fg">
                  {survivalSentence(survival.score, longevityAge)}
                  {ranOut ? ` ${ranOut}` : ""}
                </p>
              ) : (
                <p className="mt-2 text-sm leading-snug text-muted">
                  Run Monte Carlo Simulation on the card{" "}
                  <span className="@min-[56rem]/act:hidden">below.</span>
                  <span className="hidden @min-[56rem]/act:inline">to the right.</span>
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-xl bg-bg px-3.5 py-3 text-xs leading-relaxed text-muted">
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
