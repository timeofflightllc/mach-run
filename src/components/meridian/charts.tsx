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
import type { Plan, SimResult } from "@/lib/plan/types";

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

export function WealthChart({ plan, sim }: { plan: Plan; sim: SimResult }) {
  const real = plan.assumptions.dollars === "real";
  const data = sim.years.map((y) => ({
    year: y.year,
    spendable: Math.round(real ? y.endSpendableReal : y.endSpendable),
    netWorth: Math.round(real ? y.endNetWorthReal : y.endNetWorth),
  }));

  return (
    <div className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--color-border)] sm:p-5">
      <h2 className="font-display text-lg font-medium text-fg">Spendable wealth</h2>
      <p className="mb-4 text-xs text-subtle">
        {real ? "Inflation-adjusted (today's dollars)" : "Nominal dollars"} ·
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

export function CashChart({ plan, sim }: { plan: Plan; sim: SimResult }) {
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
      <h2 className="font-display text-lg font-medium text-fg">Annual cash flow</h2>
      <p className="mb-4 text-xs text-subtle">
        Gross income vs spending vs planned contributions. Guaranteed is
        pension + VA + SS when those kinds are on the run.
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
              name="Guaranteed"
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
