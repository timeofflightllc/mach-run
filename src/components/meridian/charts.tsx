import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usd, usdCompact } from "@/lib/plan/format";
import { PinToggle } from "@/components/meridian/chart-pin";
import type { Plan, SimResult } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  background: "var(--color-elevated)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-fg)",
};

function formatTip(value: unknown) {
  return usd(Number(value ?? 0));
}

export function WealthChart({
  plan,
  sim,
  pinned,
  onPin,
}: {
  plan: Plan;
  sim: SimResult;
  pinned?: boolean;
  onPin?: () => void;
}) {
  const real = plan.assumptions.dollars === "real";
  const data = sim.years.map((y) => ({
    year: y.year,
    spendable: Math.round(real ? y.endSpendableReal : y.endSpendable),
    netWorth: Math.round(real ? y.endNetWorthReal : y.endNetWorth),
  }));

  return (
    <div className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--color-border)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-lg font-medium text-fg">Spendable wealth</h2>
        {onPin ? <PinToggle pinned={Boolean(pinned)} onToggle={onPin} /> : null}
      </div>
      <p className="mb-4 text-xs text-subtle">
        {real ? "Inflation-adjusted (today's dollars)" : "Future dollars"} ·
        Roth / taxable / TSP marked spendable. Houses and 529s sit in net worth
        only.
      </p>
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
            />
            <YAxis
              tickFormatter={(v) => usdCompact(v)}
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              formatter={formatTip}
              contentStyle={tooltipStyle}
              labelStyle={{ color: "var(--color-fg)" }}
              itemStyle={{ color: "var(--color-muted)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-muted)" }} />
            <Area
              type="monotone"
              dataKey="spendable"
              name="Spendable"
              stroke="var(--color-accent)"
              fill="var(--color-accent)"
              fillOpacity={0.18}
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="netWorth"
              name="Net worth"
              stroke="var(--color-muted)"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 4"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CashChart({
  plan,
  sim,
  pinned,
  onPin,
}: {
  plan: Plan;
  sim: SimResult;
  pinned?: boolean;
  onPin?: () => void;
}) {
  const real = plan.assumptions.dollars === "real";
  const inf = plan.assumptions.inflationPct / 100;
  const asOfYear = Number(plan.assumptions.asOfDate.slice(0, 4));
  const data = sim.years.map((y) => {
    const yearsOut = y.year - asOfYear;
    const deflator = real ? (1 + inf) ** yearsOut : 1;
    return {
      year: y.year,
      income: Math.round(y.income / deflator),
      spending: Math.round(y.spending / deflator),
      guaranteed: Math.round(y.guaranteed / deflator),
      contributions: Math.round(y.contributions / deflator),
    };
  });

  return (
    <div className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--color-border)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-lg font-medium text-fg">Annual cash flow</h2>
        {onPin ? <PinToggle pinned={Boolean(pinned)} onToggle={onPin} /> : null}
      </div>
      <p className="mb-4 text-xs text-subtle">
        Gross income vs spending vs planned contributions. Guaranteed (gold
        line) is pension, other retirement income, military retired pay, VA, and
        Social Security. Salary, bonus, allowance, and other income are earned —
        they drop off when that stage ends.
      </p>
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
            />
            <YAxis
              tickFormatter={(v) => usdCompact(v)}
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              formatter={formatTip}
              contentStyle={tooltipStyle}
              labelStyle={{ color: "var(--color-fg)" }}
              itemStyle={{ color: "var(--color-muted)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-muted)" }} />
            <Area
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="var(--color-positive)"
              fill="var(--color-positive)"
              fillOpacity={0.16}
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="spending"
              name="Spending"
              stroke="var(--color-negative)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="contributions"
              name="Contributions"
              stroke="var(--color-fg)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="guaranteed"
              name="Guaranteed (pension / VA / SS)"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type ChartSpan = 5 | 10 | 20 | "horizon";

const FAKE_NET_WORTH = Array.from({ length: 21 }, (_, i) => {
  const year = 1969 + i;
  const assets = 1_234_000 + i * 123_400;
  const liabilities = Math.max(0, 987_000 - i * 48_500);
  return { year, assets, liabilities, netWorth: assets - liabilities };
});

function yearsInView(sim: SimResult, asOfDate: string, span: ChartSpan) {
  const startYear = Number(asOfDate.slice(0, 4));
  if (span === "horizon") return sim.years;
  const sliced = sim.years.filter(
    (y) => y.year >= startYear && y.year <= startYear + span,
  );
  return sliced.length ? sliced : sim.years;
}

export function NetWorthChart({
  plan,
  sim,
  pinned,
  onPin,
  locked = false,
}: {
  plan: Plan;
  sim: SimResult;
  pinned?: boolean;
  onPin?: () => void;
  locked?: boolean;
}) {
  const real = plan.assumptions.dollars === "real";
  const [span, setSpan] = useState<ChartSpan>(10);
  const years = yearsInView(sim, plan.assumptions.asOfDate, span);
  const hasDebt = years.some((y) => (real ? y.endLiabilitiesReal : y.endLiabilities) > 1);
  const live = years.map((y) => ({
    year: y.year,
    assets: Math.round(real ? y.endAssetsReal : y.endAssets),
    liabilities: Math.round(real ? y.endLiabilitiesReal : y.endLiabilities),
    netWorth: Math.round(real ? y.endNetWorthReal : y.endNetWorth),
  }));
  const data = locked
    ? FAKE_NET_WORTH.slice(0, span === "horizon" ? undefined : span + 1)
    : live;
  const opts: { id: ChartSpan; label: string }[] = [
    { id: 5, label: "5-Year" },
    { id: 10, label: "10-Year" },
    { id: 20, label: "20-Year" },
    { id: "horizon", label: `Horizon (age ${plan.assumptions.projectionEndAge})` },
  ];

  return (
    <div className="relative rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--color-border)] sm:p-5">
      <div className={cn(locked && "pointer-events-none select-none opacity-60")}>
        <h2 className="font-display text-lg font-medium text-fg">Net worth</h2>
        <p className="mb-4 mt-1 text-xs text-subtle">
          {locked
            ? "Sample only — 1969 dollars, made-up balances. Your numbers unlock on Individual Unlimited."
            : `${real ? "Inflation-adjusted (today's dollars)" : "Future dollars"} · Assets minus remaining loans.${!hasDebt ? " No loan on this MACH Run, so assets and net worth overlap." : ""}`}
        </p>
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex rounded-md bg-elevated p-0.5 shadow-[0_0_0_1px_var(--color-border)]">
            {opts.map((o) => (
              <button
                key={String(o.id)}
                type="button"
                aria-pressed={span === o.id}
                onClick={() => setSpan(o.id)}
                className={cn(
                  "h-7 rounded px-2 text-[11px] font-medium leading-none",
                  span === o.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {onPin ? <PinToggle pinned={Boolean(pinned)} onToggle={onPin} /> : null}
        </div>
        <div className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
              />
              <YAxis
                tickFormatter={(v) => usdCompact(v)}
                tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                formatter={formatTip}
                contentStyle={tooltipStyle}
                labelStyle={{ color: "var(--color-fg)" }}
                itemStyle={{ color: "var(--color-muted)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-muted)" }} />
              <Area
                type="monotone"
                dataKey="assets"
                name="Assets"
                stroke="var(--color-positive)"
                fill="var(--color-positive)"
                fillOpacity={0.14}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="liabilities"
                name="Liabilities"
                stroke="var(--color-negative)"
                fill="var(--color-negative)"
                fillOpacity={0.18}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="netWorth"
                name="Net worth"
                stroke="var(--color-accent)"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      {locked ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[#0a1835]/68 p-5">
          <p className="max-w-none px-2 text-center text-xs font-medium leading-relaxed text-fg sm:text-sm">
            <span className="block whitespace-nowrap">
              Unlock Net Worth Calculations, Graphs and Charts with
            </span>
            <Link
              to="/pricing"
              className="text-[#e8c547] underline decoration-[#e8c547]/80 underline-offset-4 hover:text-[#f6e7b0]"
            >
              Individual Unlimited (or Advisor)
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}

