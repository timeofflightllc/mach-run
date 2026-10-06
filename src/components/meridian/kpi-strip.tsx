import { useState } from "react";
import { usd } from "@/lib/plan/format";
import { startingNetWorth, startingSpendable } from "@/lib/plan/engine";
import type { Plan, SimResult } from "@/lib/plan/types";

const MONTHLY_TIP =
  "Retirement income is modeled pay in the first twelve months from the goal date (pension, wages, SS, VA). Monthly is that year ÷ 12.";

function HoverLabel({ label, tip }: { label: string; tip?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  if (!tip) {
    return <dt className="text-[13px] font-medium uppercase tracking-wider text-subtle">{label}</dt>;
  }
  return (
    <dt className="text-[13px] font-medium uppercase tracking-wider text-subtle">
      <button
        type="button"
        className="cursor-help text-left underline decoration-dotted underline-offset-2"
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
    { label: "Current spendable", value: usd(startingSpendable(plan)) },
    { label: "Current net worth", value: usd(startingNetWorth(plan)) },
    {
      label: retLabel,
      value: spendableAtRet != null ? usd(spendableAtRet) : "Set date in Family",
    },
    {
      label: "Annual income in retirement",
      value: annual != null ? usd(annual) : "—",
    },
    {
      label: "Monthly income in retirement",
      value: monthly != null ? usd(monthly, true) : "—",
      tip: MONTHLY_TIP,
    },
    lastCell,
  ];

  return (
    <div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border shadow-[0_0_0_1px_var(--color-border)]">
        {items.map((item) => (
          <div key={item.label} className="bg-surface px-3 py-3 sm:px-4 sm:py-4">
            <HoverLabel label={item.label} tip={"tip" in item ? item.tip : undefined} />
            <dd className="mt-1 font-display text-lg font-medium tabular-nums text-fg sm:text-xl">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
