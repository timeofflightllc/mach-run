import { useRef, useState } from "react";
import { usd } from "@/lib/plan/format";
import { startingNetWorth, startingSpendable } from "@/lib/plan/engine";
import { sustainableRetirementIncome, type SustainableIncome } from "@/lib/plan/sustainable-income";
import type { Plan, SimResult } from "@/lib/plan/types";

const MONTHLY_TIP =
  "First full year after goal date of Actual Income Retired (A.I.R.) ÷ 12. This is military retired pay, VA, Social Security, pension, and other retirement, plus withdrawals. The line under it is the most those sources together could pay per month and still last to your longevity age. Not the job.";

const ANNUAL_TIP =
  "The first full calendar year of Actual Income Retired (A.I.R.) in the ledger. That is the income your spending is scheduled to take: guaranteed retirement pay plus withdrawals. The line under it is the most those sources together could pay that year and still last to your longevity age. A partial year at the goal date is not this number. Not the job.";

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
  const atTerm = real ? sim.spendableAtEndReal : sim.spendableAtEnd;
  const ranOut = sim.depletedAge != null && sim.depletedYear != null;
  const lastCell = ranOut
    ? {
        label: "Spendable runs out",
        value: `Age ${sim.depletedAge} · ${sim.depletedYear}`,
      }
    : {
        label: "Still funded at",
        value: `Age ${plan.assumptions.projectionEndAge} · ${usd(atTerm)}`,
      };

  const items = [
    {
      label: "Current spendable",
      value: usd(startingSpendable(plan)),
      tip: "Balances marked spendable, as of today. Not grown. A house or other account left unmarked is not included.",
    },
    {
      label: "Current net worth",
      value: usd(startingNetWorth(plan)),
      tip: "Accounts counted in net worth, minus remaining loans.",
    },
    {
      label: "Monthly income in retirement",
      value:
        monthly != null ? (
          <span className="block">
            {usd(monthly, true)}
            {roomAmount != null ? (
              <span className="mt-1 block font-sans text-[13px] font-normal normal-case leading-snug tracking-normal text-muted">
                {usd(roomAmount / 12, true)} the most all retirement sources can pay per month and still last
              </span>
            ) : null}
            {drawnAmount != null ? (
              <span className="mt-1 block font-sans text-[13px] font-normal normal-case leading-snug tracking-normal text-muted">
                {usd(drawnAmount / 12, true)} available for withdrawal from investments without overspending
              </span>
            ) : null}
          </span>
        ) : (
          "—"
        ),
      tip: MONTHLY_TIP,
    },
    {
      label: ret?.incomeYear
        ? `Annual income in retirement (${ret.incomeYear})`
        : "Annual income in retirement",
      value:
        annual != null ? (
          <span className="block">
            {usd(annual)}
            {roomAmount != null ? (
              <span className="mt-1 block font-sans text-[13px] font-normal normal-case leading-snug tracking-normal text-muted">
                {usd(roomAmount)} from all income sources in retirement combined without overspending.
              </span>
            ) : null}
            {drawnAmount != null ? (
              <span className="mt-1 block font-sans text-[13px] font-normal normal-case leading-snug tracking-normal text-muted">
                {usd(drawnAmount)} available for withdrawal from investments without overspending
              </span>
            ) : null}
          </span>
        ) : (
          "—"
        ),
      tip: ANNUAL_TIP,
    },
    {
      label: retLabel,
      value: spendableAtRet != null ? usd(spendableAtRet) : "Set date in Family",
      tip: "Spendable balance the month before the goal date, in this run’s dollars.",
    },
    {
      ...lastCell,
      tip: ranOut
        ? "The month spendable accounts hit zero. Age and year are from this run."
        : "Spendable balance left at the end of the plan.",
    },
  ];

  return (
    <div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border shadow-[0_0_0_1px_var(--color-border)]">
        {items.map((item) => (
          <div key={item.label} className="bg-surface px-3 py-3 sm:px-4 sm:py-4">
            <HoverLabel label={item.label} tip={item.tip} />
            <dd className="mt-1 font-display text-lg font-medium tabular-nums text-fg sm:text-xl">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
