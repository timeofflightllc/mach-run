import { useState } from "react";
import { PrimaryButton } from "@/components/ui/field";
import { formatMonthYear, monthStart, validIso } from "@/lib/plan/dates";
import {
  recommendedRetirementCopy,
  type RecommendedRetirement,
} from "@/lib/plan/earliest-retirement";
import { monthlyIncomeAt, startingSpendable } from "@/lib/plan/engine";
import { usd } from "@/lib/plan/format";
import { nestEggTrack, peerRankLine, type PeerBrief } from "@/lib/plan/peers";
import type { Plan, SimResult } from "@/lib/plan/types";

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
  onUseRecommended,
}: {
  plan: Plan;
  sim: SimResult;
  brief?: PeerBrief | null;
  onUseRecommended?: (date: string) => void;
}) {
  const real = plan.assumptions.dollars === "real";
  const atTerm = real ? sim.spendableAtEndReal : sim.spendableAtEnd;
  const unit = real ? "today's dollars" : "nominal";
  const start = startingSpendable(plan);
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
  let retLine = " Set a retirement goal date in Family to key the Spendable strip.";
  if (ret) {
    const pile = usd(real ? ret.spendableReal : ret.spendable);
    const annual = usd(real ? ret.annualIncomeReal : ret.annualIncome);
    const monthly = usd(real ? ret.monthlyIncomeReal : ret.monthlyIncome, true);
    if (ret.now) {
      retLine = ` Retirement goal is this month, so spendable at retirement is the current pile (${pile}). First-year modeled income is ${annual} (${monthly}/mo average).`;
    } else {
      retLine = ` At retirement (${ret.date.slice(0, 7)}) spendable is ${pile} (${unit}). First-year modeled income is ${annual} (${monthly}/mo average).`;
    }
  } else if (plan.assumptions.retirementGoalDate) {
    retLine = "";
  }

  const rank = brief ? peerRankLine(brief) : null;
  const egg = nestEggTrack(plan, sim);

  return (
    <div className="rounded-xl bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--color-border)]">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
        BLUF (Bottom Line Up Front)
      </p>
      <p className="mt-2 font-display text-xl font-medium leading-snug text-fg sm:text-2xl">
        {egg ? <NestEggHeadline egg={egg} /> : body}
      </p>
      {egg ? (
        <p className="mt-2 text-base font-medium leading-snug text-fg">{body}</p>
      ) : null}
      {rank ? (
        <p className="mt-2 text-sm font-medium leading-relaxed text-fg">{rank}</p>
      ) : null}
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Current spendable {usd(start)}. Remaining at age{" "}
        {plan.assumptions.projectionEndAge} is {usd(atTerm)} ({unit}).
        {retLine}
      </p>
      {brief?.recommendedRetirement ? (
        <RecommendedRetirement
          plan={plan}
          rec={brief.recommendedRetirement}
          onUse={onUseRecommended}
        />
      ) : null}
    </div>
  );
}

export function RecommendedRetirement({
  plan,
  rec,
  onUse,
  copy = true,
}: {
  plan: Plan;
  rec: RecommendedRetirement;
  onUse?: (date: string) => void;
  /** Analysis already prints the sentence. The button still sits under that section. */
  copy?: boolean;
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
          {recommendedRetirementCopy(plan, rec)}
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
