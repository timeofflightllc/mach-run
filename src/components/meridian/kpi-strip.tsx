import { usd } from "@/lib/plan/format";
import { startingNetWorth, startingSpendable } from "@/lib/plan/engine";
import type { Plan, SimResult } from "@/lib/plan/types";

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
    },
    lastCell,
  ];

  return (
    <div className="@container flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border shadow-[0_0_0_1px_var(--color-border)]">
        {items.map((item) => (
          <div key={item.label} className="bg-surface px-3 py-3 sm:px-4 sm:py-4">
            <dt className="text-[13px] font-medium uppercase tracking-wider text-subtle">
              {item.label}
            </dt>
            <dd className="mt-1 font-display text-lg font-medium tabular-nums text-fg sm:text-xl">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {ret?.now ? (
        <p className="text-xs text-subtle">
          Retirement goal is the as-of month, so spendable-at-retirement matches
          current spendable. Monthly income is the first-year average (annual ÷
          12), not the first calendar month. Set a future date in Family if you
          meant a later retirement.
        </p>
      ) : (
        <p className="text-xs text-subtle">
          Retirement income is modeled pay in the first twelve months from the
          goal date (pension, wages, SS, VA). Monthly is that year ÷ 12.
        </p>
      )}
    </div>
  );
}
