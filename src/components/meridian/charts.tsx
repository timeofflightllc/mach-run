import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Customized,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { usd, usdCompact } from "@/lib/plan/format";
import type { SurvivalBand, SurvivalTraces } from "@/lib/plan/monte-carlo-run";
import { PinToggle } from "@/components/meridian/chart-pin";
import type { MonthSnapshot, Plan, SimResult, YearSnapshot } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #c8d2de",
  borderRadius: 8,
  fontSize: 12,
  color: "#1a2330",
};

const chartCard =
  "rounded-xl bg-white p-4 text-slate-800 shadow-[0_0_0_1px_#c8d2de] sm:p-5";

function plotHeight(expanded: boolean, tall?: boolean) {
  if (expanded) return "h-[calc(100svh-12rem)]";
  if (tall) return "h-[32rem] sm:h-[40rem]";
  return "h-64 sm:h-80";
}
const tickFill = "#4b5b6e";
const gridStroke = "#d5dde6";

function useChartExpanded() {
  const [expanded, setExpanded] = useState(false);
  const close = useCallback(() => setExpanded(false), []);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded, close]);
  return { expanded, toggle: () => setExpanded((open) => !open), close };
}

function ChartStage({
  expanded,
  onClose,
  label,
  children,
}: {
  expanded: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  if (!expanded || typeof document === "undefined") return children;
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[#0c1620]/75 p-3 sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatTip(value: unknown) {
  return usd(Number(value ?? 0));
}

type ChartSpan = 5 | 10 | 20 | "horizon";

function spanOptions(endAge: number): { id: ChartSpan; label: string }[] {
  return [
    { id: 5, label: "5-Year" },
    { id: 10, label: "10-Year" },
    { id: 20, label: "20-Year" },
    { id: "horizon", label: `Horizon (age ${endAge})` },
  ];
}

function yearsInView(sim: SimResult, asOfDate: string, span: ChartSpan) {
  const startYear = Number(asOfDate.slice(0, 4));
  if (span === "horizon") return sim.years;
  const sliced = sim.years.filter(
    (y) => y.year >= startYear && y.year <= startYear + span,
  );
  return sliced.length ? sliced : sim.years;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function monthsFromYears(years: YearSnapshot[], spanYears: 5 | 10): MonthSnapshot[] {
  if (!years.length) return [];
  const start = years[0].year;
  const end = Math.min(years[years.length - 1].year, start + spanYears);
  const byYear = new Map(years.map((y) => [y.year, y]));
  const out: MonthSnapshot[] = [];
  let prev = byYear.get(start) ?? years[0];
  for (let year = start; year <= end; year++) {
    const next = byYear.get(year) ?? prev;
    for (let month = 1; month <= 12; month++) {
      const w = month / 12;
      const mix = (a: number, b: number) => a + (b - a) * w;
      out.push({
        date: `${year}-${pad2(month)}-01`,
        year,
        month,
        primaryAge: next.primaryAge,
        spouseAge: next.spouseAge,
        portfolioEnd: mix(prev.endPortfolio, next.endPortfolio),
        portfolioEndReal: mix(prev.endPortfolioReal, next.endPortfolioReal),
        spendableEnd: mix(prev.endSpendable, next.endSpendable),
        spendableEndReal: mix(prev.endSpendableReal, next.endSpendableReal),
        netWorthEnd: mix(prev.endNetWorth, next.endNetWorth),
        netWorthEndReal: mix(prev.endNetWorthReal, next.endNetWorthReal),
        assetsEnd: mix(prev.endAssets, next.endAssets),
        assetsEndReal: mix(prev.endAssetsReal, next.endAssetsReal),
        liabilitiesEnd: mix(prev.endLiabilities, next.endLiabilities),
        liabilitiesEndReal: mix(prev.endLiabilitiesReal, next.endLiabilitiesReal),
        contributions: next.contributions / 12,
        plannedContributions: next.plannedContributions / 12,
        withdrawals: next.withdrawals / 12,
        income: next.income / 12,
        incomeTaxable: 0,
        tax: next.tax / 12,
        spending: next.spending / 12,
        surplus: next.surplus / 12,
        guaranteed: next.guaranteed / 12,
        incomeByKind: {},
        byBucket: { roth: 0, pre_tax: 0, taxable: 0, none: 0 },
      });
    }
    prev = next;
  }
  return out;
}

function monthsInSpan(sim: SimResult, asOfDate: string, years: 5 | 10): MonthSnapshot[] {
  if (sim.months.length) {
    const startY = Number(asOfDate.slice(0, 4));
    const startM = Number(asOfDate.slice(5, 7)) || 1;
    const startIdx = startY * 12 + startM;
    const endIdx = startIdx + years * 12;
    const sliced = sim.months.filter((m) => {
      const i = m.year * 12 + m.month;
      return i >= startIdx && i <= endIdx;
    });
    if (sliced.length) return sliced;
  }
  return monthsFromYears(yearsInView(sim, asOfDate, years), years);
}

function formatCashTip(t: string | number, span: ChartSpan): string {
  if (span !== 10) return formatAxisTick(t, span);
  const [y, q] = String(t).split("-");
  const range: Record<string, string> = {
    Q1: "Jan–Mar",
    Q2: "Apr–Jun",
    Q3: "Jul–Sep",
    Q4: "Oct–Dec",
  };
  return `${q} ${y} · ${range[q] ?? "quarter"}`;
}

function formatAxisTick(t: string | number, span: ChartSpan): string {
  if (span === 20 || span === "horizon") return String(t);
  const raw = String(t);
  if (span === 10) {
    const [y, q] = raw.split("-");
    return `${q} ${y.slice(2)}`;
  }
  const [y, m] = raw.split("-");
  return `${MONTH_SHORT[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

function axisProps(span: ChartSpan) {
  return {
    interval: span === 5 ? 2 : span === 10 ? 1 : ("preserveStartEnd" as const),
    minTickGap: span === 5 ? 8 : 16,
    angle: span === 5 || span === 10 ? -35 : 0,
    textAnchor: span === 5 || span === 10 ? ("end" as const) : ("middle" as const),
    height: span === 5 || span === 10 ? 46 : 28,
  };
}

function ChartSpanBar({
  span,
  endAge,
  onChange,
  pinned,
  onPin,
  expanded,
  onExpand,
}: {
  span: ChartSpan;
  endAge: number;
  onChange: (next: ChartSpan) => void;
  pinned?: boolean;
  onPin?: () => void;
  expanded?: boolean;
  onExpand?: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
      <div className="inline-flex rounded-md bg-slate-100 p-0.5 shadow-[0_0_0_1px_#c8d2de]">
        {spanOptions(endAge).map((o) => (
          <button
            key={String(o.id)}
            type="button"
            aria-pressed={span === o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "h-7 rounded px-2 text-[11px] font-medium leading-none",
              span === o.id ? "bg-accent text-accent-fg" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {onPin ? <PinToggle pinned={Boolean(pinned)} onToggle={onPin} tone="light" /> : null}
      {onExpand ? (
        <button
          type="button"
          aria-pressed={Boolean(expanded)}
          onClick={onExpand}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-slate-100 px-2 text-xs font-medium text-slate-800 shadow-[0_0_0_1px_#94a3b8] hover:bg-slate-200"
        >
          {expanded ? <X className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          {expanded ? "Close" : "Full screen"}
        </button>
      ) : null}
    </div>
  );
}

type WealthPoint = { t: string | number; spendable: number; netWorth: number };

function wealthPoints(plan: Plan, sim: SimResult, span: ChartSpan): WealthPoint[] {
  const real = plan.assumptions.dollars === "real";
  if (span === 5) {
    return monthsInSpan(sim, plan.assumptions.asOfDate, 5).map((m) => ({
      t: `${m.year}-${pad2(m.month)}`,
      spendable: Math.round(real ? m.spendableEndReal : m.spendableEnd),
      netWorth: Math.round(real ? m.netWorthEndReal : m.netWorthEnd),
    }));
  }
  if (span === 10) {
    const byQ = new Map<string, MonthSnapshot>();
    for (const m of monthsInSpan(sim, plan.assumptions.asOfDate, 10)) {
      const q = Math.ceil(m.month / 3);
      byQ.set(`${m.year}-Q${q}`, m);
    }
    return [...byQ.entries()].map(([t, m]) => ({
      t,
      spendable: Math.round(real ? m.spendableEndReal : m.spendableEnd),
      netWorth: Math.round(real ? m.netWorthEndReal : m.netWorthEnd),
    }));
  }
  return yearsInView(sim, plan.assumptions.asOfDate, span).map((y) => ({
    t: y.year,
    spendable: Math.round(real ? y.endSpendableReal : y.endSpendable),
    netWorth: Math.round(real ? y.endNetWorthReal : y.endNetWorth),
  }));
}

type CashPoint = {
  t: string | number;
  income: number;
  spending: number;
  guaranteed: number;
  contributions: number;
};

function cashPoints(plan: Plan, sim: SimResult, span: ChartSpan): CashPoint[] {
  const real = plan.assumptions.dollars === "real";
  const inf = plan.assumptions.inflationPct / 100;
  const asOfYear = Number(plan.assumptions.asOfDate.slice(0, 4));
  const asOfMonth = Number(plan.assumptions.asOfDate.slice(5, 7)) || 1;
  const deflate = (year: number, month: number, value: number) => {
    if (!real) return value;
    const yearsOut = year - asOfYear + (month - asOfMonth) / 12;
    return value / (1 + inf) ** yearsOut;
  };

  if (span === 5) {
    return monthsInSpan(sim, plan.assumptions.asOfDate, 5).map((m) => ({
      t: `${m.year}-${pad2(m.month)}`,
      income: Math.round(deflate(m.year, m.month, m.income) * 12),
      spending: Math.round(deflate(m.year, m.month, m.spending) * 12),
      guaranteed: Math.round(deflate(m.year, m.month, m.guaranteed) * 12),
      contributions: Math.round(deflate(m.year, m.month, m.contributions) * 12),
    }));
  }
  if (span === 10) {
    const buckets = new Map<string, MonthSnapshot[]>();
    for (const m of monthsInSpan(sim, plan.assumptions.asOfDate, 10)) {
      const key = `${m.year}-Q${Math.ceil(m.month / 3)}`;
      const arr = buckets.get(key) ?? [];
      arr.push(m);
      buckets.set(key, arr);
    }
    return [...buckets.entries()].map(([t, arr]) => {
      const sum = (fn: (m: MonthSnapshot) => number) => arr.reduce((s, m) => s + fn(m), 0);
      const scale = 12 / arr.length;
      return {
        t,
        income: Math.round(sum((m) => deflate(m.year, m.month, m.income)) * scale),
        spending: Math.round(sum((m) => deflate(m.year, m.month, m.spending)) * scale),
        guaranteed: Math.round(sum((m) => deflate(m.year, m.month, m.guaranteed)) * scale),
        contributions: Math.round(sum((m) => deflate(m.year, m.month, m.contributions)) * scale),
      };
    });
  }
  return yearsInView(sim, plan.assumptions.asOfDate, span).map((y) => {
    const yearsOut = y.year - asOfYear;
    const deflator = real ? (1 + inf) ** yearsOut : 1;
    return {
      t: y.year,
      income: Math.round(y.income / deflator),
      spending: Math.round(y.spending / deflator),
      guaranteed: Math.round(y.guaranteed / deflator),
      contributions: Math.round(y.contributions / deflator),
    };
  });
}

type NwPoint = { t: string | number; assets: number; liabilities: number; netWorth: number };

function netWorthPoints(plan: Plan, sim: SimResult, span: ChartSpan): NwPoint[] {
  const real = plan.assumptions.dollars === "real";
  if (span === 5) {
    return monthsInSpan(sim, plan.assumptions.asOfDate, 5).map((m) => ({
      t: `${m.year}-${pad2(m.month)}`,
      assets: Math.round(real ? m.assetsEndReal : m.assetsEnd),
      liabilities: Math.round(real ? m.liabilitiesEndReal : m.liabilitiesEnd),
      netWorth: Math.round(real ? m.netWorthEndReal : m.netWorthEnd),
    }));
  }
  if (span === 10) {
    const byQ = new Map<string, MonthSnapshot>();
    for (const m of monthsInSpan(sim, plan.assumptions.asOfDate, 10)) {
      byQ.set(`${m.year}-Q${Math.ceil(m.month / 3)}`, m);
    }
    return [...byQ.entries()].map(([t, m]) => ({
      t,
      assets: Math.round(real ? m.assetsEndReal : m.assetsEnd),
      liabilities: Math.round(real ? m.liabilitiesEndReal : m.liabilitiesEnd),
      netWorth: Math.round(real ? m.netWorthEndReal : m.netWorthEnd),
    }));
  }
  return yearsInView(sim, plan.assumptions.asOfDate, span).map((y) => ({
    t: y.year,
    assets: Math.round(real ? y.endAssetsReal : y.endAssets),
    liabilities: Math.round(real ? y.endLiabilitiesReal : y.endLiabilities),
    netWorth: Math.round(real ? y.endNetWorthReal : y.endNetWorth),
  }));
}

function fakeNetWorthPoints(span: ChartSpan): NwPoint[] {
  if (span === 5) {
    const out: NwPoint[] = [];
    for (let i = 0; i < 5; i++) {
      const a0 = 1_234_000 + i * 123_400;
      const a1 = 1_234_000 + (i + 1) * 123_400;
      const l0 = Math.max(0, 987_000 - i * 48_500);
      const l1 = Math.max(0, 987_000 - (i + 1) * 48_500);
      for (let m = 1; m <= 12; m++) {
        const w = (m - 1) / 12;
        const assets = a0 + (a1 - a0) * w;
        const liabilities = l0 + (l1 - l0) * w;
        out.push({
          t: `${1969 + i}-${pad2(m)}`,
          assets: Math.round(assets),
          liabilities: Math.round(liabilities),
          netWorth: Math.round(assets - liabilities),
        });
      }
    }
    return out;
  }
  if (span === 10) {
    const out: NwPoint[] = [];
    for (let i = 0; i < 10; i++) {
      const year = 1969 + i;
      const assets = 1_234_000 + i * 123_400;
      const liabilities = Math.max(0, 987_000 - i * 48_500);
      for (let q = 1; q <= 4; q++) {
        out.push({
          t: `${year}-Q${q}`,
          assets,
          liabilities,
          netWorth: assets - liabilities,
        });
      }
    }
    return out;
  }
  const years = span === 20 ? 21 : 21;
  return Array.from({ length: years }, (_, i) => {
    const year = 1969 + i;
    const assets = 1_234_000 + i * 123_400;
    const liabilities = Math.max(0, 987_000 - i * 48_500);
    return { t: year, assets, liabilities, netWorth: assets - liabilities };
  });
}

export function WealthChart({
  plan,
  sim,
  pinned,
  onPin,
  tall,
}: {
  plan: Plan;
  sim: SimResult;
  pinned?: boolean;
  onPin?: () => void;
  tall?: boolean;
}) {
  const real = plan.assumptions.dollars === "real";
  const [span, setSpan] = useState<ChartSpan>("horizon");
  const { expanded, toggle, close } = useChartExpanded();
  const data = wealthPoints(plan, sim, span);
  const x = axisProps(span);

  return (
    <ChartStage expanded={expanded} onClose={close} label="Spendable Wealth">
    <div className={cn(chartCard, expanded && "flex h-full min-h-0 flex-1 flex-col")}>
      <h2 className="font-display text-xl font-bold text-slate-900">Spendable Wealth</h2>
      <p className="mb-4 mt-1 text-xs text-slate-600">
        {real ? "Inflation-adjusted (today's dollars)" : "Future dollars"} ·
        Roth / taxable / TSP marked spendable. Houses and 529s sit in net worth
        only.
        {expanded ? " Esc closes this view." : ""}
      </p>
      <ChartSpanBar
        span={span}
        endAge={plan.assumptions.projectionEndAge}
        onChange={setSpan}
        pinned={pinned}
        onPin={onPin}
        expanded={expanded}
        onExpand={toggle}
      />
      <div className={plotHeight(expanded, tall)}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={(t) => formatAxisTick(t, span)}
              tick={{ fill: tickFill, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: gridStroke }}
              interval={x.interval}
              minTickGap={x.minTickGap}
              angle={x.angle}
              textAnchor={x.textAnchor}
              height={x.height}
            />
            <YAxis
              tickFormatter={(v) => usdCompact(v)}
              tick={{ fill: tickFill, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              formatter={formatTip}
              labelFormatter={(t) => formatAxisTick(t as string | number, span)}
              contentStyle={tooltipStyle}
              labelStyle={{ color: "#1a2330" }}
              itemStyle={{ color: "#4b5b6e" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#4b5b6e" }} />
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
              stroke="#4b5b6e"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 4"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
    </ChartStage>
  );
}

export function CashChart({
  plan,
  sim,
  pinned,
  onPin,
  tall,
}: {
  plan: Plan;
  sim: SimResult;
  pinned?: boolean;
  onPin?: () => void;
  tall?: boolean;
}) {
  const real = plan.assumptions.dollars === "real";
  const [span, setSpan] = useState<ChartSpan>("horizon");
  const { expanded, toggle, close } = useChartExpanded();
  const data = cashPoints(plan, sim, span);
  const x = axisProps(span);

  return (
    <ChartStage expanded={expanded} onClose={close} label="Annual Cash Flow">
    <div className={cn(chartCard, expanded && "flex h-full min-h-0 flex-1 flex-col")}>
      <h2 className="font-display text-xl font-bold text-slate-900">Annual Cash Flow</h2>
      <p className="mb-4 mt-1 text-xs text-slate-600">
        Gross income vs spending vs planned contributions. Guaranteed (gold
        line) is pension, other retirement income, military retired pay, VA, and
        Social Security. Salary, bonus, allowance, and other income are earned —
        they drop off when that stage ends.
        {span === 10
          ? " Each point is one quarter. Hover a point for the months."
          : span === 5
            ? " Each point is one month, times 12, so the scale matches the yearly views."
            : ""}
        {expanded ? " Esc closes this view." : ""}
      </p>
      <ChartSpanBar
        span={span}
        endAge={plan.assumptions.projectionEndAge}
        onChange={setSpan}
        pinned={pinned}
        onPin={onPin}
        expanded={expanded}
        onExpand={toggle}
      />
      <div className={plotHeight(expanded, tall)}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={(t) => formatAxisTick(t, span)}
              tick={{ fill: tickFill, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: gridStroke }}
              interval={x.interval}
              minTickGap={x.minTickGap}
              angle={x.angle}
              textAnchor={x.textAnchor}
              height={x.height}
            />
            <YAxis
              tickFormatter={(v) => usdCompact(v)}
              tick={{ fill: tickFill, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              formatter={formatTip}
              labelFormatter={(t) => formatCashTip(t as string | number, span)}
              contentStyle={tooltipStyle}
              labelStyle={{ color: "#1a2330" }}
              itemStyle={{ color: "#4b5b6e" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#4b5b6e" }} />
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
              stroke="#1a2330"
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
    </ChartStage>
  );
}

const NET_WORTH_MIN_KEY = "mach-net-worth-min";

function readNetWorthMin() {
  try {
    return window.localStorage.getItem(NET_WORTH_MIN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeNetWorthMin(min: boolean) {
  try {
    if (min) window.localStorage.setItem(NET_WORTH_MIN_KEY, "1");
    else window.localStorage.removeItem(NET_WORTH_MIN_KEY);
  } catch {
    /* keep the choice for this visit */
  }
}

export function NetWorthChart({
  plan,
  sim,
  pinned,
  onPin,
  locked = false,
  tall,
}: {
  plan: Plan;
  sim: SimResult;
  pinned?: boolean;
  onPin?: () => void;
  locked?: boolean;
  tall?: boolean;
}) {
  const real = plan.assumptions.dollars === "real";
  const [span, setSpan] = useState<ChartSpan>(10);
  const { expanded, toggle, close } = useChartExpanded();
  const [minimized, setMinimized] = useState(readNetWorthMin);
  const live = netWorthPoints(plan, sim, span);
  const data = locked ? fakeNetWorthPoints(span) : live;
  const hasDebt = data.some((d) => d.liabilities > 1);
  const x = axisProps(span);

  if (locked && minimized) {
    return (
      <button
        type="button"
        onClick={() => {
          setMinimized(false);
          writeNetWorthMin(false);
        }}
        className={cn(chartCard, "w-full text-left")}
      >
        <h2 className="font-display text-xl font-bold text-slate-900">Net Worth</h2>
      </button>
    );
  }

  return (
    <ChartStage expanded={expanded} onClose={close} label="Net Worth">
    <div className={cn("relative", chartCard, expanded && "flex h-full min-h-0 flex-1 flex-col")}>
      <div className={cn(locked && "pointer-events-none select-none opacity-60", expanded && "flex min-h-0 flex-1 flex-col")}>
        <h2 className="font-display text-xl font-bold text-slate-900">Net Worth</h2>
        <p className="mb-4 mt-1 text-xs text-slate-600">
          {locked
            ? "Sample only — 1969 dollars, made-up balances. Your numbers unlock on Individual Unlimited."
            : `${real ? "Inflation-adjusted (today's dollars)" : "Future dollars"} · Assets minus remaining loans.${!hasDebt ? " No loan on this MACH Run, so assets and net worth overlap." : ""}`}
          {expanded ? " Esc closes this view." : ""}
        </p>
        <ChartSpanBar
          span={span}
          endAge={plan.assumptions.projectionEndAge}
          onChange={setSpan}
          pinned={pinned}
          onPin={onPin}
          expanded={expanded}
          onExpand={locked ? undefined : toggle}
        />
        <div className={plotHeight(expanded, tall)}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(t) => formatAxisTick(t, span)}
                tick={{ fill: tickFill, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                interval={x.interval}
                minTickGap={x.minTickGap}
                angle={x.angle}
                textAnchor={x.textAnchor}
                height={x.height}
              />
              <YAxis
                tickFormatter={(v) => usdCompact(v)}
                tick={{ fill: tickFill, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                formatter={formatTip}
                labelFormatter={(t) => formatAxisTick(t as string | number, span)}
                contentStyle={tooltipStyle}
                labelStyle={{ color: "#1a2330" }}
                itemStyle={{ color: "#4b5b6e" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#4b5b6e" }} />
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
        <>
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-canopy/70 p-5">
          <p className="max-w-none px-2 text-center text-xs font-medium leading-relaxed text-white sm:text-sm">
            <span className="block whitespace-nowrap">
              Unlock Net Worth Calculations, Graphs and Charts with
            </span>
            <Link
              to="/pricing"
              className="text-[#e8c547] underline decoration-[#e8c547]/80 underline-offset-4 hover:text-[#f6e7b0]"
            >
              Individual Unlimited or Advisor
            </Link>
          </p>
        </div>
        <button
          type="button"
          aria-label="Minimize Net Worth"
          onClick={() => {
            setMinimized(true);
            writeNetWorthMin(true);
          }}
          className="absolute right-2 top-2 z-20 flex h-6 w-6 items-end justify-center rounded-sm border border-slate-500 bg-white pb-[5px] text-slate-900 hover:bg-slate-100"
        >
          <span className="block h-[2px] w-2.5 bg-current" />
        </button>
        </>
      ) : null}
    </div>
    </ChartStage>
  );
}

function atPercent(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const sorted = values.slice().sort((a, b) => a - b);
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - rank) + sorted[hi] * (rank - lo);
}

function innerAt(series: number[][] | null, yearIndex: number): { low: number; high: number } | null {
  if (!series || series.length === 0) return null;
  const values: number[] = [];
  for (const row of series) {
    const value = row[yearIndex];
    if (Number.isFinite(value)) values.push(value);
  }
  if (values.length === 0) return null;
  return { low: atPercent(values, 0.25), high: atPercent(values, 0.75) };
}

export function MonteCarloBandChart({
  bands,
  traces,
  real,
}: {
  bands: SurvivalBand[];
  traces?: SurvivalTraces | null;
  real: boolean;
}) {
  const series = traces ? (real ? traces.real : traces.nominal) : null;
  const years = traces?.years ?? [];
  const data = bands.map((band, index) => {
    const low = real ? band.p10Real : band.p10;
    const mid = real ? band.p50Real : band.p50;
    const high = real ? band.p90Real : band.p90;
    const inner = innerAt(series, index);
    return {
      t: band.year,
      low,
      mid,
      high,
      innerLow: inner?.low ?? low,
      innerHigh: inner?.high ?? high,
      outer: [low, high] as [number, number],
      inner: [inner?.low ?? low, inner?.high ?? high] as [number, number],
    };
  });
  let yDomain: [number, number] | undefined;
  if (data.length > 0) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const row of data) {
      if (row.low < lo) lo = row.low;
      if (row.high > hi) hi = row.high;
    }
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      const span = hi - lo || Math.abs(hi) || 1;
      const pad = span * 0.08;
      const bottom = lo <= span * 0.15 ? 0 : lo - pad;
      yDomain = [bottom, hi + pad];
    }
  }
  return (
    <div className={chartCard}>
      <h2 className="font-display text-xl font-bold text-slate-900">Money left to spend</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">
        Your plan is run 1,000 times. The markets are different each time, so each run is one
        possible future. The chart is how much spendable money is left at the end of the year.
      </p>
      <ul className="mb-4 mt-2 space-y-1 text-sm leading-snug text-slate-600">
        <li>
          <span className="font-semibold text-slate-800">Each thin gray line</span> is one of the
          1,000 futures. They are faded so the green stays easy to read. A few of the strongest
          run off the top. The scale follows the green, not the wildest future.
        </li>
        <li>
          <span className="mr-1.5 inline-block h-2.5 w-4 rounded-sm align-middle" style={{ background: "#8fceb0" }} />
          <span className="font-semibold text-slate-800">Light green</span> is where 8 out of 10
          futures end. One in ten ends above it. One in ten ends below it.
        </li>
        <li>
          <span className="mr-1.5 inline-block h-2.5 w-4 rounded-sm align-middle" style={{ background: "#3a8a58" }} />
          <span className="font-semibold text-slate-800">Dark green</span> is the middle half. Half
          of the futures end inside this darker band.
        </li>
        <li>
          <span className="font-semibold text-slate-800">The dark line</span> is the middle future.
          Half end with more than this. Half end with less.
        </li>
        <li>{real ? "Dollars are today's dollars." : "Dollars are future dollars, not adjusted for inflation."}</li>
      </ul>
      <div className="h-[32rem] sm:h-[40rem]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={(t) => String(t)}
              tick={{ fill: tickFill, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: gridStroke }}
              interval="preserveStartEnd"
              minTickGap={16}
              height={28}
            />
            <YAxis
              tickFormatter={(v) => usdCompact(v)}
              tick={{ fill: tickFill, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={84}
              domain={yDomain ?? ["auto", "auto"]}
              allowDataOverflow
            />
            <Tooltip
              content={({ active, payload, label }) => {
                const row = payload?.[0]?.payload as
                  | { low?: number; mid?: number; high?: number; innerLow?: number; innerHigh?: number }
                  | undefined;
                if (!active || row?.mid == null || row.low == null || row.high == null) return null;
                return (
                  <div style={{ ...tooltipStyle, padding: "8px 10px", maxWidth: 260 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
                    <p style={{ margin: "8px 0 0", fontWeight: 600 }}>Middle future</p>
                    <p style={{ margin: 0 }}>{usd(row.mid)}</p>
                    <p style={{ margin: 0, color: "#4b5b6e" }}>Half end with more. Half end with less.</p>
                    <p style={{ margin: "8px 0 0", fontWeight: 600, color: "#2f6b4a" }}>Dark green, the middle half</p>
                    <p style={{ margin: 0 }}>{usd(row.innerLow ?? row.low)} – {usd(row.innerHigh ?? row.high)}</p>
                    <p style={{ margin: 0, color: "#4b5b6e" }}>Half of the futures end in here.</p>
                    <p style={{ margin: "8px 0 0", fontWeight: 600, color: "#3a8a58" }}>Light green, 8 of 10</p>
                    <p style={{ margin: 0 }}>{usd(row.low)} – {usd(row.high)}</p>
                    <p style={{ margin: 0, color: "#4b5b6e" }}>One in ten ends higher. One in ten ends lower.</p>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#4b5b6e" }} />
            {series && years.length > 0 ? (
              <Customized component={FutureLines} years={years} series={series} />
            ) : null}
            <Area
              type="monotone"
              dataKey="outer"
              name="Light green: 8 of 10 futures"
              stroke="none"
              fill="#3a8a58"
              fillOpacity={0.28}
              isAnimationActive={false}
            />
            {series && series.length > 0 ? (
              <Area
                type="monotone"
                dataKey="inner"
                name="Dark green: the middle half"
                stroke="none"
                fill="#1f6b40"
                fillOpacity={0.45}
                isAnimationActive={false}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="mid"
              name="Middle future"
              stroke="#1a2330"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FutureLines({
  years,
  series,
  xAxisMap,
  yAxisMap,
  offset,
}: {
  years?: number[];
  series?: number[][];
  xAxisMap?: Record<string, { scale: ((value: number) => number) & { bandwidth?: () => number } }>;
  yAxisMap?: Record<string, { scale: (value: number) => number }>;
  offset?: { top: number; left: number; width: number; height: number };
}) {
  const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : undefined;
  const yAxis = yAxisMap ? Object.values(yAxisMap)[0] : undefined;
  if (!xAxis || !yAxis || !years || !series || years.length === 0) return null;
  const x = xAxis.scale;
  const y = yAxis.scale;
  const band = typeof x.bandwidth === "function" ? x.bandwidth() / 2 : 0;
  const pieces: string[] = [];
  for (const row of series) {
    let d = "";
    let started = false;
    for (let i = 0; i < years.length && i < row.length; i++) {
      const px = x(years[i]);
      const py = y(row[i]);
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      d += `${started ? "L" : "M"}${px + band},${py}`;
      started = true;
    }
    if (d) pieces.push(d);
  }
  if (pieces.length === 0) return null;
  const clip =
    offset && offset.width > 0 && offset.height > 0 ? (
      <clipPath id="mc-future-clip">
        <rect x={offset.left} y={offset.top} width={offset.width} height={offset.height} />
      </clipPath>
    ) : null;
  return (
    <g>
      {clip ? <defs>{clip}</defs> : null}
      <g clipPath={clip ? "url(#mc-future-clip)" : undefined}>
        {pieces.map((d, index) => (
          <path key={index} d={d} fill="none" stroke="#8b97a3" strokeWidth={1} strokeOpacity={0.07} />
        ))}
      </g>
    </g>
  );
}
