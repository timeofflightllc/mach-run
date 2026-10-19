import { useEffect, useRef, useState, type ReactNode } from "react";
import { DateInput, MoneyInput } from "@/components/ui/field";
import { usd } from "@/lib/plan/format";
import { startingNetWorth, startingSpendable } from "@/lib/plan/engine";
import { extraMonthlyToReach, incomeGap } from "@/lib/plan/income-goal";
import { nestEggTrack } from "@/lib/plan/peers";
import { cashParkedYears, cashShortYears, paycheckGapNote } from "@/lib/plan/cash-short";
import { annuityDrawnNominal, sustainableRetirementIncome, type SustainableIncome } from "@/lib/plan/sustainable-income";
import { usePlanStore } from "@/lib/plan/store";
import type { Plan, SimResult } from "@/lib/plan/types";

const GUARANTEED_LABELS: [string, string][] = [
  ["military", "military retirement"],
  ["va", "VA"],
  ["ss", "Social Security"],
  ["pension", "pension"],
  ["other_retirement", "other retirement"],
];

function sourceList(sources: string[]): string {
  if (sources.length <= 1) return sources[0] ?? "";
  if (sources.length === 2) return `${sources[0]} and ${sources[1]}`;
  return `${sources.slice(0, -1).join(", ")}, and ${sources[sources.length - 1]}`;
}

function guaranteedAtGoal(plan: Plan, sim: SimResult): { monthly: number; sources: string[] } | null {
  const yearNum = sim.retirement?.incomeYear;
  if (yearNum == null) return null;
  const year = sim.years.find((row) => row.year === yearNum);
  if (!year || year.air == null) return null;
  const infl = plan.assumptions.inflationPct / 100;
  const asOfYear = Number(plan.assumptions.asOfDate.slice(0, 4));
  const yearsOut = Math.max(0, year.year - (Number.isFinite(asOfYear) ? asOfYear : year.year));
  const sources: string[] = [];
  let nominal = 0;
  for (const [kind, label] of GUARANTEED_LABELS) {
    const amount = year.airByKind[kind] ?? 0;
    if (amount > 1) {
      nominal += amount;
      sources.push(label);
    }
  }
  const annuity = annuityDrawnNominal(plan, sim, year.year);
  if (annuity > 1) {
    nominal += annuity;
    sources.push(plan.portfolios.filter((row) => row.kind === "annuity").length > 1 ? "annuities" : "annuity");
  }
  const monthly = Math.round(nominal / (1 + infl) ** yearsOut / 12);
  if (monthly < 1 || sources.length === 0) return null;
  return { monthly, sources };
}

const ANNUAL_TIP =
  "The first full calendar year of Actual Income Retired (A.I.R.) in the ledger. That is the income your spending is scheduled to take: guaranteed retirement pay plus withdrawals.";

function HoverLabel({ label, tip }: { label: string; tip?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  if (!tip) {
    return <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</dt>;
  }
  return (
    <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
      <button
        type="button"
        className="cursor-help border-0 bg-transparent p-0 text-left font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-muted underline decoration-dotted decoration-muted/70 underline-offset-[3px]"
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
  longevityAge,
  extraSave,
  includeGuaranteed,
  onIncludeGuaranteed,
  onExecute,
  onArmExecute,
}: {
  sim: SimResult;
  view: "nest" | "income";
  setView: (next: "nest" | "income") => void;
  egg: ReturnType<typeof nestEggTrack>;
  gap: ReturnType<typeof incomeGap>;
  canPay: number | null;
  payShort: number | null;
  payFill: number;
  longevityAge: number;
  extraSave: number | null;
  includeGuaranteed: boolean;
  onIncludeGuaranteed: (next: boolean) => void;
  onExecute?: () => void;
  onArmExecute?: () => void;
}) {
  const live = usePlanStore((s) => s.plan);
  const patchAssumptions = usePlanStore((s) => s.patchAssumptions);
  const [editing, setEditing] = useState(false);
  const canceling = useRef(false);
  const [dateDraft, setDateDraft] = useState<string | null>(live.assumptions.retirementGoalDate);
  const [incomeDraft, setIncomeDraft] = useState(live.assumptions.incomeGoalMonthly ?? 0);
  const [nestDraft, setNestDraft] = useState(live.assumptions.nestEggGoal ?? 0);
  const dateRef = useRef(dateDraft);
  const incomeRef = useRef(incomeDraft);
  const nestRef = useRef(nestDraft);
  const viewRef = useRef(view);
  const guaranteed = guaranteedAtGoal(live, sim);
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
  function closeEdit() {
    const date = live.assumptions.retirementGoalDate;
    dateRef.current = date;
    setDateDraft(date);
    const income = live.assumptions.incomeGoalMonthly ?? 0;
    incomeRef.current = income;
    setIncomeDraft(income);
    const nest = live.assumptions.nestEggGoal ?? 0;
    nestRef.current = nest;
    setNestDraft(nest);
    setEditing(false);
  }
  const showForm = editing || !(view === "nest" ? egg : gap);
  return (
    <div className="mt-5 border-t border-border pt-5">
      <div className="inline-flex max-w-full flex-wrap rounded-full bg-bg p-1">
        {(
          [
            ["nest", "Retirement Nest Egg Goal"],
            ["income", "Monthly Retirement Income Goal"],
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
                  ? "h-8 whitespace-nowrap rounded-full bg-surface px-3 text-xs font-medium leading-none text-fg shadow-[0_1px_2px_rgba(26,35,48,0.08)]"
                  : "h-8 whitespace-nowrap rounded-full px-3 text-xs font-medium leading-none text-muted hover:text-fg"
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      {view === "income" ? (
        <div className="mt-2 flex items-start gap-2">
          <div
            className="inline-flex shrink-0 rounded-full bg-bg p-1"
            role="group"
            aria-label="Include guaranteed retirement income starting on Retirement Goal Date"
          >
            {(
              [
                ["yes", "YES"],
                ["no", "NO"],
              ] as const
            ).map(([id, label]) => {
              const on = includeGuaranteed === (id === "yes");
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onIncludeGuaranteed(id === "yes")}
                  className={
                    on
                      ? "h-7 rounded-full bg-surface px-2.5 text-[11px] font-medium leading-none text-fg shadow-[0_1px_2px_rgba(26,35,48,0.08)]"
                      : "h-7 rounded-full px-2.5 text-[11px] font-medium leading-none text-muted hover:text-fg"
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span className="text-sm leading-5 text-fg">
            Include guaranteed retirement income starting on Retirement Goal Date.
            <span className="mt-0.5 block text-xs leading-snug text-muted">
              Non-investment sources such as military, VA, Social Security, pension, and annuity, etc.
            </span>
          </span>
        </div>
      ) : null}
      {!showForm && view === "nest" && egg ? (
        <NestEggBar egg={egg} sim={sim} onEdit={() => setEditing(true)} />
      ) : !showForm && gap ? (
        <MonthlyPayBar
          gap={gap}
          canPay={canPay}
          payShort={payShort}
          payFill={payFill}
          longevityAge={longevityAge}
          extraSave={extraSave}
          includeGuaranteed={includeGuaranteed}
          onEdit={() => setEditing(true)}
        />
      ) : (
        <div
          className="mt-2 flex flex-col"
          onBlur={(event) => {
            if (canceling.current) return;
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) return;
            flushGoal();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (!(event.target instanceof HTMLInputElement)) return;
            event.preventDefault();
            onArmExecute?.();
            flushGoal();
            setEditing(false);
            onExecute?.();
          }}
        >
          <p className="text-sm leading-5 text-muted">
            {editing
              ? "Change the date or the goal, then Execute MACH RUN."
              : "Add the retirement date and the goal, then Execute MACH RUN."}
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="h-4 truncate text-xs font-medium tracking-wide text-muted">Retirement goal date</span>
              <DateInput
                value={dateDraft}
                onValue={(v) => {
                  const next = v === "" ? null : v;
                  dateRef.current = next;
                  setDateDraft(next);
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium leading-snug tracking-wide text-muted">
                {view === "income" ? "Desired Monthly Income In Retirement From Nest Egg" : "Nest egg goal"}
              </span>
              {view === "income" ? (
                <div className="flex items-center gap-3">
                  <div className="w-40 shrink-0">
                    <MoneyInput
                      value={incomeDraft}
                      onValue={(n) => {
                        incomeRef.current = n;
                        setIncomeDraft(n);
                      }}
                      className="max-w-none"
                    />
                  </div>
                  {guaranteed ? (
                    <p className="min-w-0 text-sm leading-snug text-muted">
                      plus {usd(guaranteed.monthly)} guaranteed a month from {sourceList(guaranteed.sources)}.
                    </p>
                  ) : null}
                </div>
              ) : (
                <MoneyInput
                  value={nestDraft}
                  onValue={(n) => {
                    nestRef.current = n;
                    setNestDraft(n);
                  }}
                />
              )}
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {onExecute ? (
              <button
                type="button"
                data-mach-execute=""
                onMouseDown={() => onArmExecute?.()}
                onClick={() => {
                  flushGoal();
                  setEditing(false);
                  onExecute();
                }}
                className="h-9 w-fit rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
              >
                Execute MACH RUN
              </button>
            ) : null}
            {editing ? (
              <button
                type="button"
                onMouseDown={() => {
                  canceling.current = true;
                }}
                onClick={() => {
                  closeEdit();
                  canceling.current = false;
                }}
                className="h-9 w-fit rounded-lg px-3 text-sm font-medium text-muted hover:text-fg"
              >
                Cancel
              </button>
            ) : null}
          </div>
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
  longevityAge,
  extraSave,
  includeGuaranteed,
  onEdit,
}: {
  gap: NonNullable<ReturnType<typeof incomeGap>>;
  canPay: number | null;
  payShort: number | null;
  payFill: number;
  longevityAge: number;
  extraSave: number | null;
  includeGuaranteed: boolean;
  onEdit?: () => void;
}) {
  const take = canPay ?? gap.projected;
  const meets = payShort == null || payShort <= 1;
  const spare = payShort != null && payShort < -1 ? -payShort : 0;
  const from = includeGuaranteed
    ? "from all sources (investments withdrawals and guaranteed income)"
    : "from only investment withdrawals";
  const status = `A withdrawal of ${usd(take)} a month lasts through age ${longevityAge}.`;
  const note = meets
    ? spare > 1
      ? `That meets the ${usd(gap.wanted)} goal, with ${usd(spare)} a month to spare.`
      : `That meets the ${usd(gap.wanted)} goal.`
    : extraSave != null && extraSave > 0
      ? `That is ${usd(payShort)} a month short of the ${usd(gap.wanted)} goal. Invest about ${usd(extraSave)} more a month until then.`
      : `That is ${usd(payShort)} a month short of the ${usd(gap.wanted)} goal.`;
  return (
    <GoalReadout
      title="Monthly pay at retirement"
      left={
        <>
          <span className="tabular-nums">{usd(take)}</span> a month {from}
        </>
      }
      right={`${usd(gap.wanted)} goal`}
      aria={`${usd(take)} a month ${from}, through age ${longevityAge}, of the ${usd(gap.wanted)} goal`}
      fill={payFill}
      status={status}
      note={note}
      action={onEdit ? <EditGoalButton label="Edit Monthly Retirement Income Goal" onClick={onEdit} /> : null}
    />
  );
}

function roomKey(plan: Plan): string {
  return JSON.stringify({ ...plan, assumptions: { ...plan.assumptions, dollars: "nominal" } });
}

function NestEggBar({
  egg,
  sim,
  onEdit,
}: {
  egg: NonNullable<ReturnType<typeof nestEggTrack>>;
  sim: SimResult;
  onEdit?: () => void;
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
    <GoalReadout
      title="Nest egg at the retirement goal"
      left={`${usd(projected)} projected`}
      right={`${usd(egg.goal)} goal`}
      aria={`${usd(projected)} of the ${usd(egg.goal)} goal in ${egg.targetYear}`}
      fill={fill}
      status={status}
      note={lever}
      action={onEdit ? <EditGoalButton label="Edit Retirement Nest Egg Goal" onClick={onEdit} /> : null}
    />
  );
}

function EditGoalButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 h-9 w-fit rounded-full border border-border bg-surface px-3.5 text-sm font-medium text-fg hover:bg-bg"
    >
      {label}
    </button>
  );
}

function GoalReadout({
  title,
  left,
  right,
  aria,
  fill,
  status,
  note,
  action,
}: {
  title: string;
  left: ReactNode;
  right: string;
  aria: string;
  fill: number;
  status: string;
  note: string | null;
  action?: ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-col">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{title}</p>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <span className="min-w-0 font-display text-xl font-semibold leading-snug tracking-tight text-fg">{left}</span>
        <span className="shrink-0 pt-1 text-sm tabular-nums text-muted">{right}</span>
      </div>
      <div className="mt-3 h-5 overflow-hidden rounded-full bg-[#d7eadc]" role="img" aria-label={aria}>
        <div className="h-full rounded-full bg-[#3a8a58]" style={{ width: `${Math.min(100, Math.max(0, fill))}%` }} />
      </div>
      <p className="mt-3 text-sm leading-5 text-fg">{status}</p>
      {note ? <p className="mt-1 text-sm leading-5 text-muted">{note}</p> : null}
      {action}
    </div>
  );
}

export function KpiStrip({
  plan,
  sim,
  onExecute,
  onArmExecute,
}: {
  plan: Plan;
  sim: SimResult;
  onExecute?: () => void;
  onArmExecute?: () => void;
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
    roomCache.current = { key, value: sustainableRetirementIncome(plan, sim) };
  }
  const room = roomCache.current.value;
  const drawnAmount = room ? (real ? room.withdrawalReal : room.withdrawalNominal) : null;
  const gap = incomeGap(plan, sim);
  const [includeGuaranteed, setIncludeGuaranteed] = useState(false);
  const airYear = ret?.incomeYear != null ? sim.years.find((row) => row.year === ret.incomeYear) : undefined;
  const scheduledAccounts =
    airYear && airYear.air != null
      ? (() => {
          const infl = plan.assumptions.inflationPct / 100;
          const asOfYear = Number(plan.assumptions.asOfDate.slice(0, 4));
          const yearsOut = Math.max(0, airYear.year - (Number.isFinite(asOfYear) ? asOfYear : airYear.year));
          const annuity = annuityDrawnNominal(plan, sim, airYear.year);
          return Math.max(0, airYear.airWithdrawals - annuity) / (1 + infl) ** yearsOut / 12;
        })()
      : null;
  const sustainableAll = room && room.real > 0 ? room.real / 12 : (gap?.projected ?? null);
  const sustainableAccounts = room ? Math.max(0, room.withdrawalReal - room.annuityReal) / 12 : scheduledAccounts;
  const canPay = gap ? (includeGuaranteed ? sustainableAll : sustainableAccounts) : null;
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
  const saveCache = useRef<Map<string, number | null>>(new Map());
  const [saveReady, setSaveReady] = useState(0);
  const accountsKey = `${key}|a|${gap?.wanted ?? 0}|${Math.round(sustainableAccounts ?? -1)}`;
  const allKey = `${key}|g|${gap?.wanted ?? 0}|${Math.round(sustainableAll ?? -1)}`;
  const planRef = useRef(plan);
  planRef.current = plan;
  const wantedRef = useRef(gap?.wanted ?? 0);
  wantedRef.current = gap?.wanted ?? 0;
  const includeRef = useRef(includeGuaranteed);
  includeRef.current = includeGuaranteed;
  useEffect(() => {
    const wanted = wantedRef.current;
    const active = includeRef.current;
    const jobs: { id: string; include: boolean; already: number }[] = [];
    if (
      !active &&
      sustainableAccounts != null &&
      wanted - sustainableAccounts > 1 &&
      !saveCache.current.has(accountsKey)
    ) {
      jobs.push({ id: accountsKey, include: false, already: sustainableAccounts });
    }
    if (
      active &&
      sustainableAll != null &&
      wanted - sustainableAll > 1 &&
      !saveCache.current.has(allKey)
    ) {
      jobs.push({ id: allKey, include: true, already: sustainableAll });
    }
    if (jobs.length === 0) return;
    let cancel = false;
    const timer = window.setTimeout(() => {
      const job = jobs[0];
      if (!job || cancel) return;
      saveCache.current.set(job.id, extraMonthlyToReach(planRef.current, wanted, job.include, job.already));
      if (!cancel) setSaveReady((n) => n + 1);
    }, 400);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [includeGuaranteed, accountsKey, allKey, sustainableAccounts, sustainableAll]);
  const activeKey = includeGuaranteed ? allKey : accountsKey;
  const extraSave =
    payShort != null && payShort > 1 ? (saveReady >= 0 ? (saveCache.current.get(activeKey) ?? null) : null) : 0;
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
    <dl className="@container/kpi rounded-2xl bg-surface px-5 py-5 shadow-[0_1px_2px_rgba(26,35,48,0.05),0_0_0_1px_var(--color-border)] sm:px-6">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 @min-[40rem]/kpi:grid-cols-2">
        <div>
          <HoverLabel
            label="Current spendable"
            tip="Balances marked spendable, as of today. Not grown. A house or other account left unmarked is not included."
          />
          <dd className="mt-1 font-display text-xl font-semibold tabular-nums tracking-tight text-fg sm:text-2xl">
            {usd(startingSpendable(plan))}
          </dd>
        </div>
        <div>
          <HoverLabel
            label="Current net worth"
            tip="Accounts counted in net worth, minus remaining loans."
          />
          <dd className="mt-1 font-display text-xl font-semibold tabular-nums tracking-tight text-fg sm:text-2xl">
            {usd(startingNetWorth(plan))}
          </dd>
        </div>
        <div>
          <HoverLabel
            label={retLabel}
            tip="Spendable balance the month before the goal date, in this run’s dollars."
          />
          <dd className="mt-1 font-display text-xl font-semibold tabular-nums tracking-tight text-fg sm:text-2xl">
            {spendableAtRet != null ? usd(spendableAtRet) : "Set date in Goals"}
          </dd>
          {goalNote ? (
            <p className="mt-1 font-sans text-[13px] font-normal normal-case leading-snug tracking-normal text-muted">
              {goalNote}
            </p>
          ) : null}
        </div>
        <div>
          <HoverLabel label={payLabel} tip={payTip} />
          <dd className="mt-1 font-display text-xl font-semibold tabular-nums tracking-tight text-fg sm:text-2xl">
            {annual != null ? (
              <span className="block">
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span>{usd(annual)}</span>
                  <span className="font-sans text-sm font-normal normal-case tracking-normal text-muted">a year</span>
                </span>
                {monthly != null ? (
                  <span className="mt-0.5 block font-sans text-sm font-normal normal-case tracking-normal text-muted">
                    {usd(monthly, true)} a month
                  </span>
                ) : null}
              </span>
            ) : (
              "—"
            )}
          </dd>
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
        longevityAge={plan.assumptions.projectionEndAge}
        extraSave={extraSave}
        includeGuaranteed={includeGuaranteed}
        onIncludeGuaranteed={setIncludeGuaranteed}
        onExecute={onExecute}
        onArmExecute={onArmExecute}
      />
    </dl>
  );
}
