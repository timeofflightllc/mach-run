import { useEffect, useRef, useState } from "react";
import { DateInput, Field, MoneyInput } from "@/components/ui/field";
import { usd } from "@/lib/plan/format";
import { startingNetWorth, startingSpendable } from "@/lib/plan/engine";
import { incomeGap, spendableWithExtraSave } from "@/lib/plan/income-goal";
import { nestEggTrack } from "@/lib/plan/peers";
import { cashParkedYears, cashShortYears, paycheckGapNote } from "@/lib/plan/cash-short";
import { sustainableRetirementIncome, type SustainableIncome } from "@/lib/plan/sustainable-income";
import { usePlanStore } from "@/lib/plan/store";
import type { Plan, SimResult } from "@/lib/plan/types";

const ANNUAL_TIP =
  "The first full calendar year of Actual Income Retired (A.I.R.) in the ledger. That is the income your spending is scheduled to take: guaranteed retirement pay plus withdrawals.";

function HoverLabel({ label, tip }: { label: string; tip?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  if (!tip) {
    return <dt className="text-[13px] font-medium uppercase tracking-wider text-subtle">{label}</dt>;
  }
  return (
    <dt className="text-[13px] font-medium uppercase tracking-wider text-subtle">
      <button
        type="button"
        className="cursor-help border-0 bg-transparent p-0 text-left font-sans text-[13px] font-medium uppercase tracking-wider text-subtle underline decoration-dotted underline-offset-2"
        onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setPos(null)}
        onFocus={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ x: r.left, y: r.bottom });
        }}
        onBlur={() => setPos(null)}
      >
        {label}
      </button>
      {pos ? (
        <p
          role="tooltip"
          className="pointer-events-none fixed z-[80] w-72 max-w-[calc(100vw-16px)] rounded-lg border border-border bg-elevated px-3 py-2.5 text-left text-sm font-normal normal-case leading-snug tracking-normal text-fg shadow-lg"
          style={{ left: Math.min(pos.x + 12, window.innerWidth - 300), top: pos.y + 14 }}
        >
          {tip}
        </p>
      ) : null}
    </dt>
  );
}

function GoalScore({
  sim,
  view,
  setView,
  egg,
  gap,
  canPay,
  payShort,
  payFill,
  bump,
  onExecute,
}: {
  sim: SimResult;
  view: "nest" | "income";
  setView: (next: "nest" | "income") => void;
  egg: ReturnType<typeof nestEggTrack>;
  gap: ReturnType<typeof incomeGap>;
  canPay: number | null;
  payShort: number | null;
  payFill: number;
  bump: number | null;
  onExecute?: () => void;
}) {
  const live = usePlanStore((s) => s.plan);
  const patchAssumptions = usePlanStore((s) => s.patchAssumptions);
  const ready = view === "nest" ? Boolean(egg) : Boolean(gap);
  const [dateDraft, setDateDraft] = useState<string | null>(live.assumptions.retirementGoalDate);
  const [incomeDraft, setIncomeDraft] = useState(live.assumptions.incomeGoalMonthly ?? 0);
  const [nestDraft, setNestDraft] = useState(live.assumptions.nestEggGoal ?? 0);
  const dateRef = useRef(dateDraft);
  const incomeRef = useRef(incomeDraft);
  const nestRef = useRef(nestDraft);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    dateRef.current = live.assumptions.retirementGoalDate;
    setDateDraft(live.assumptions.retirementGoalDate);
  }, [live.assumptions.retirementGoalDate]);
  useEffect(() => {
    const next = live.assumptions.incomeGoalMonthly ?? 0;
    incomeRef.current = next;
    setIncomeDraft(next);
  }, [live.assumptions.incomeGoalMonthly]);
  useEffect(() => {
    const next = live.assumptions.nestEggGoal ?? 0;
    nestRef.current = next;
    setNestDraft(next);
  }, [live.assumptions.nestEggGoal]);
  function flushGoal() {
    const date = dateRef.current && /^\d{4}-\d{2}-\d{2}$/.test(dateRef.current) ? dateRef.current : null;
    const amount = viewRef.current === "income" ? incomeRef.current : nestRef.current;
    if (!date || !(amount > 0)) return;
    if (viewRef.current === "income") {
      if (
        date === (live.assumptions.retirementGoalDate ?? null) &&
        amount === (live.assumptions.incomeGoalMonthly ?? null) &&
        live.assumptions.goalMode === "income"
      ) {
        return;
      }
      patchAssumptions({ retirementGoalDate: date, incomeGoalMonthly: amount, goalMode: "income" });
      return;
    }
    if (
      date === (live.assumptions.retirementGoalDate ?? null) &&
      amount === (live.assumptions.nestEggGoal ?? null) &&
      live.assumptions.goalMode !== "income"
    ) {
      return;
    }
    patchAssumptions({ retirementGoalDate: date, nestEggGoal: amount, goalMode: "nest" });
  }
  return (
    <div className="mt-px bg-surface px-3 py-3 sm:px-4">
      <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
        {(
          [
            ["nest", "Nest egg"],
            ["income", "Monthly pay"],
          ] as const
        ).map(([id, label]) => {
          const on = view === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => setView(id)}
              className={
                on
                  ? "h-7 rounded-md bg-white px-2.5 text-xs font-medium text-fg shadow-sm"
                  : "h-7 rounded-md px-2.5 text-xs font-medium text-muted"
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      {ready && view === "nest" && egg ? (
        <NestEggBar egg={egg} sim={sim} />
      ) : ready && gap ? (
        <MonthlyPayBar gap={gap} canPay={canPay} payShort={payShort} payFill={payFill} bump={bump} />
      ) : (
        <div
          className="mt-3 flex flex-col gap-3"
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) return;
            flushGoal();
          }}
        >
          <p className="text-sm leading-snug text-muted">
            Add the retirement date and the goal, then Execute MACH RUN.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Retirement goal date" className="w-full min-w-0 max-w-xs">
              <DateInput
                value={dateDraft}
                onValue={(v) => {
                  const next = v === "" ? null : v;
                  dateRef.current = next;
                  setDateDraft(next);
                }}
              />
            </Field>
            {view === "income" ? (
              <Field label="Wanted each month (today $)" className="w-full min-w-0 max-w-52">
                <MoneyInput
                  value={incomeDraft}
                  onValue={(n) => {
                    incomeRef.current = n;
                    setIncomeDraft(n);
                  }}
                />
              </Field>
            ) : (
              <Field label="Nest egg goal (today $)" className="w-full min-w-0 max-w-52">
                <MoneyInput
                  value={nestDraft}
                  onValue={(n) => {
                    nestRef.current = n;
                    setNestDraft(n);
                  }}
                />
              </Field>
            )}
          </div>
          {onExecute ? (
            <button
              type="button"
              onClick={() => {
                flushGoal();
                onExecute();
              }}
              className="h-10 w-fit rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
            >
              Execute MACH RUN
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MonthlyPayBar({
  gap,
  canPay,
  payShort,
  payFill,
  bump,
}: {
  gap: NonNullable<ReturnType<typeof incomeGap>>;
  canPay: number | null;
  payShort: number | null;
  payFill: number;
  bump: number | null;
}) {
  return (
    <>
      <p className="mt-2 text-[13px] font-medium uppercase tracking-wider text-subtle">
        Monthly pay at retirement
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-3 text-sm font-medium tabular-nums text-fg">
        <span>{usd(canPay ?? gap.projected)} can pay</span>
        <span>{usd(gap.wanted)} wanted</span>
      </div>
      <div
        className="mt-1.5 h-4 overflow-hidden rounded-full bg-slate-200"
        role="img"
        aria-label={`${usd(canPay ?? gap.projected)} a month the accounts can pay, of the ${usd(gap.wanted)} wanted`}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${payFill}%` }} />
      </div>
      <p className="mt-2 text-sm font-medium leading-snug text-fg">
        {payShort != null && payShort > 1
          ? `Short ${usd(payShort)} a month, in today's dollars.`
          : payShort != null && payShort < -1
            ? `${usd(-payShort)} a month of room, in today's dollars.`
            : "On the monthly paycheck you asked for."}
      </p>
      {canPay != null && Math.abs(canPay - gap.projected) > 1 ? (
        <p className="mt-1 text-sm leading-snug text-muted">
          Spending entered on this run draws {usd(gap.projected)} a month. The accounts can pay more and still last.
        </p>
      ) : null}
      {bump != null && bump > 1 ? (
        <p className="mt-1 text-sm leading-snug text-muted">
          Another $100 a month from now until the goal date adds about {usd(Math.round(bump / 100) * 100)} to
          spendable wealth then.
        </p>
      ) : null}
    </>
  );
}

function roomKey(plan: Plan): string {
  return JSON.stringify({ ...plan, assumptions: { ...plan.assumptions, dollars: "nominal" } });
}

function NestEggBar({
  egg,
  sim,
}: {
  egg: NonNullable<ReturnType<typeof nestEggTrack>>;
  sim: SimResult;
}) {
  const projected = Math.max(0, egg.projected);
  const fill = egg.goal > 0 ? Math.min(100, (projected / egg.goal) * 100) : 0;
  const short = Math.max(0, egg.goal - egg.projected);
  const early = egg.hitYear != null && egg.hitYear < egg.targetYear;
  const blocked = paycheckGapNote(
    cashShortYears(sim).map((row) => row.year),
    cashParkedYears(sim, egg.targetYear),
  );
  let status: string;
  if (!egg.onTrack) status = `${usd(short)} short of the goal in ${egg.targetYear}.`;
  else if (early) {
    status = `You clear ${usd(egg.goal)} in ${egg.hitYear}${egg.hitAge != null ? ` (age ${egg.hitAge})` : ""}.`;
  } else status = `On the ${usd(egg.goal)} goal in ${egg.targetYear}.`;
  const lever = !egg.onTrack
    ? blocked ??
      `About ${usd(egg.extraMonthly, true)} more a month, on top of what you already save, closes it by ${egg.targetYear}.`
    : null;
  return (
    <>
      <p className="mt-2 text-[13px] font-medium uppercase tracking-wider text-subtle">
        Nest egg at the retirement goal
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-3 text-sm font-medium tabular-nums text-fg">
        <span>{usd(projected)} projected</span>
        <span>{usd(egg.goal)} goal</span>
      </div>
      <div
        className="mt-1.5 h-4 overflow-hidden rounded-full bg-slate-200"
        role="img"
        aria-label={`${usd(projected)} of the ${usd(egg.goal)} goal in ${egg.targetYear}`}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${fill}%` }} />
      </div>
      <p className="mt-2 text-sm font-medium leading-snug text-fg">{status}</p>
      {lever ? <p className="mt-1 text-sm leading-snug text-muted">{lever}</p> : null}
    </>
  );
}

export function KpiStrip({
  plan,
  sim,
  onExecute,
}: {
  plan: Plan;
  sim: SimResult;
  onExecute?: () => void;
}) {
  const real = plan.assumptions.dollars === "real";
  const ret = sim.retirement;
  const spendableAtRet = ret
    ? real
      ? ret.spendableReal
      : ret.spendable
    : null;
  const annual = ret ? (real ? ret.annualIncomeReal : ret.annualIncome) : null;
  const monthly = ret ? (real ? ret.monthlyIncomeReal : ret.monthlyIncome) : null;
  const roomCache = useRef<{ key: string; value: SustainableIncome | null } | null>(null);
  const key = roomKey(plan);
  if (!roomCache.current || roomCache.current.key !== key) {
    roomCache.current = { key, value: sustainableRetirementIncome(plan) };
  }
  const room = roomCache.current.value;
  const roomAmount = room ? (real ? room.real : room.nominal) : null;
  const drawnAmount = room ? (real ? room.withdrawalReal : room.withdrawalNominal) : null;
  const gap = incomeGap(plan, sim);
  const canPay = gap ? (room && room.real > 0 ? room.real / 12 : gap.projected) : null;
  const payShort = gap && canPay != null ? gap.wanted - canPay : null;
  const payFill =
    gap && canPay != null && gap.wanted > 0
      ? Math.min(100, Math.max(0, (canPay / gap.wanted) * 100))
      : 0;
  const egg = nestEggTrack(
    { ...plan, assumptions: { ...plan.assumptions, goalMode: "nest" } },
    sim,
  );
  const savedView = plan.assumptions.goalMode === "income" ? "income" : "nest";
  const [view, setView] = useState<"nest" | "income">(savedView);
  const [syncedView, setSyncedView] = useState(savedView);
  if (syncedView !== savedView) {
    setSyncedView(savedView);
    setView(savedView);
  }
  const bumpCache = useRef<{ key: string; added: number | null } | null>(null);
  if (payShort != null && payShort > 1) {
    if (!bumpCache.current || bumpCache.current.key !== key) {
      const raised = spendableWithExtraSave(plan, 100);
      const base = sim.retirement?.spendableReal ?? null;
      bumpCache.current = {
        key,
        added: raised != null && base != null ? raised - base : null,
      };
    }
  }
  const bump = payShort != null && payShort > 1 ? bumpCache.current?.added ?? null : null;
  const retLabel = !ret
    ? "Spendable at retirement"
    : ret.now
      ? "Spendable at retirement (now)"
      : `Spendable at retirement (${ret.date.slice(0, 7)})`;
  const goal = plan.assumptions.nestEggGoal;
  const goalBasis = real ? spendableAtRet : (ret?.spendableReal ?? null);
  let goalNote: string | null = null;
  if (plan.assumptions.goalMode !== "income" && goal != null && goal > 0 && goalBasis != null) {
    const gap = goal - goalBasis;
    const where = real ? "" : " in today's dollars";
    if (gap > 1) goalNote = `${usd(gap)} under the ${usd(goal)} goal${where}`;
    else if (gap < -1) goalNote = `${usd(-gap)} over the ${usd(goal)} goal${where}`;
    else goalNote = `On the ${usd(goal)} goal${where}`;
  }
  let roomNote: string | null = null;
  if (annual != null && roomAmount != null) {
    const roomLeft = roomAmount - annual;
    if (roomLeft > 1) roomNote = `${usd(roomLeft)} a year of room left, and the money still lasts`;
    else if (roomLeft < -1) roomNote = `${usd(-roomLeft)} a year over what still lasts`;
    else roomNote = "No unused room. This is what still lasts.";
  }
  const payTip = [
    ANNUAL_TIP,
    drawnAmount != null
      ? `${usd(drawnAmount)} available for withdrawal from investments without overspending.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const payLabel = ret?.incomeYear ? `Retirement pay (${ret.incomeYear})` : "Retirement pay";

  return (
    <dl className="@container/kpi overflow-hidden rounded-xl bg-border shadow-[0_0_0_1px_var(--color-border)]">
      <div className="grid grid-cols-2 gap-px">
        <div className="bg-surface px-3 py-3 sm:px-4">
          <HoverLabel
            label="Current spendable"
            tip="Balances marked spendable, as of today. Not grown. A house or other account left unmarked is not included."
          />
          <dd className="mt-1 font-display text-lg font-medium tabular-nums text-fg sm:text-xl">
            {usd(startingSpendable(plan))}
          </dd>
        </div>
        <div className="bg-surface px-3 py-3 sm:px-4">
          <HoverLabel
            label="Current net worth"
            tip="Accounts counted in net worth, minus remaining loans."
          />
          <dd className="mt-1 font-display text-lg font-medium tabular-nums text-fg sm:text-xl">
            {usd(startingNetWorth(plan))}
          </dd>
        </div>
      </div>
      <div className="mt-px grid grid-cols-1 gap-px @min-[28rem]/kpi:grid-cols-2">
        <div className="bg-surface px-3 py-3 sm:px-4">
          <HoverLabel
            label={retLabel}
            tip="Spendable balance the month before the goal date, in this run’s dollars."
          />
          <dd className="mt-1 font-display text-lg font-medium tabular-nums text-fg sm:text-xl">
            {spendableAtRet != null ? usd(spendableAtRet) : "Set date in Family"}
          </dd>
          {goalNote ? (
            <p className="mt-1 font-sans text-[13px] font-normal normal-case leading-snug tracking-normal text-muted">
              {goalNote}
            </p>
          ) : null}
        </div>
        <div className="bg-surface px-3 py-3 sm:px-4">
          <HoverLabel label={payLabel} tip={payTip} />
          <dd className="mt-1 font-display text-lg font-medium tabular-nums text-fg sm:text-xl">
            {annual != null ? (
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span>{usd(annual)}</span>
                <span className="font-sans text-sm font-normal normal-case tracking-normal text-muted">a year</span>
                {monthly != null ? (
                  <>
                    <span className="font-sans text-sm font-normal text-muted">·</span>
                    <span>{usd(monthly, true)}</span>
                    <span className="font-sans text-sm font-normal normal-case tracking-normal text-muted">a month</span>
                  </>
                ) : null}
              </span>
            ) : (
              "—"
            )}
          </dd>
          {roomNote ? (
            <p className="mt-1 font-sans text-[13px] font-normal normal-case leading-snug tracking-normal text-muted">
              {roomNote}
            </p>
          ) : null}
        </div>
      </div>
      <GoalScore
        sim={sim}
        view={view}
        setView={setView}
        egg={egg}
        gap={gap}
        canPay={canPay}
        payShort={payShort}
        payFill={payFill}
        bump={bump}
        onExecute={onExecute}
      />
    </dl>
  );
}
