import { useRef, useState } from "react";
import { usd } from "@/lib/plan/format";
import { startingNetWorth, startingSpendable } from "@/lib/plan/engine";
import { sustainableRetirementIncome, type SustainableIncome } from "@/lib/plan/sustainable-income";
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

function roomKey(plan: Plan): string {
  return JSON.stringify({ ...plan, assumptions: { ...plan.assumptions, dollars: "nominal" } });
}

export function KpiStrip({ plan, sim }: { plan: Plan; sim: SimResult }) {
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
  const retLabel = !ret
    ? "Spendable at retirement"
    : ret.now
      ? "Spendable at retirement (now)"
      : `Spendable at retirement (${ret.date.slice(0, 7)})`;
  const goal = plan.assumptions.nestEggGoal;
  const goalBasis = real ? spendableAtRet : (ret?.spendableReal ?? null);
  let goalNote: string | null = null;
  if (goal != null && goal > 0 && goalBasis != null) {
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
    </dl>
  );
}
