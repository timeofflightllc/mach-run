import { usd } from "@/lib/plan/format";
import type { PeerBrief } from "@/lib/plan/peers";
import { nestEggTrack, peerRankLine } from "@/lib/plan/peers";
import type { Plan, SimResult } from "@/lib/plan/types";
import { monthlyIncomeAt, startingSpendable } from "@/lib/plan/engine";
import { monthStart } from "@/lib/plan/dates";

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
}: {
  plan: Plan;
  sim: SimResult;
  brief?: PeerBrief | null;
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
    </div>
  );
}
