import { addMonths, addYears, isBefore } from "date-fns";
import { dateAtAge, monthStart, validIso } from "./dates.ts";
import { ensurePlan } from "./defaults.ts";
import { simulate, type HistoryStep } from "./engine.ts";
import { MARKET_YEARS, type MarketYear } from "./history-table.ts";
import type { Plan } from "./types.ts";

export type HistoricalCount = {
  survived: number;
  total: number;
  failedStartYears: number[];
};

/** Plan years from the as-of month through the longevity month, matching simulate. */
export function planSpanYears(plan: Plan): number {
  const asOf = monthStart(plan.assumptions.asOfDate);
  const endDate = validIso(plan.primary.birthDate)
    ? dateAtAge(plan.primary.birthDate, plan.assumptions.projectionEndAge)
    : addYears(asOf, 40);
  let months = 0;
  let cursor = asOf;
  while (!isBefore(endDate, cursor) && months < 1200) {
    months += 1;
    cursor = addMonths(cursor, 1);
  }
  if (months <= 0) return 1;
  return Math.floor((months - 1) / 12) + 1;
}

/**
 * How many real stretches this plan would have survived.
 * `stockPercent` is 0–100. The rest of each investment account is bonds.
 * Cash, real estate, and annuity keep the rates on the plan. No shocks.
 */
export function runHistorical(
  raw: Plan,
  stockPercent: number,
  table: readonly MarketYear[] = MARKET_YEARS,
): HistoricalCount {
  const plan = ensurePlan(raw);
  const span = planSpanYears(plan);
  const share = Number.isFinite(stockPercent) ? Math.min(100, Math.max(0, stockPercent)) / 100 : 0;
  const byYear = new Map(table.map((row) => [row.year, row]));
  const starts = [...table].map((row) => row.year).sort((a, b) => a - b);
  let survived = 0;
  const failedStartYears: number[] = [];
  for (const start of starts) {
    const steps: HistoryStep[] = [];
    let fits = true;
    for (let i = 0; i < span; i++) {
      const row = byYear.get(start + i);
      if (!row) {
        fits = false;
        break;
      }
      steps.push({ stock: row.stock, bond: row.bond, inflation: row.inflation });
    }
    if (!fits) continue;
    const result = simulate(plan, { normalized: true, history: { stockShare: share, steps } });
    if (result.depletedAge == null) survived += 1;
    else failedStartYears.push(start);
  }
  return { survived, total: survived + failedStartYears.length, failedStartYears };
}

/** One line for the Monte Carlo tab. The percent is the one that was run. */
export function historicalSentence(count: HistoricalCount, stockPercent: number): string {
  const pct = formatPercent(stockPercent);
  const noun = count.total === 1 ? "stretch" : "stretches";
  if (count.total === 0) {
    return `No historical stretch covers this plan at ${pct}% stocks.`;
  }
  if (count.failedStartYears.length === 0) {
    return `Survived all ${count.total} historical ${noun} at ${pct}% stocks.`;
  }
  return `Survived ${count.survived} of ${count.total} historical ${noun} at ${pct}% stocks. Failed ${yearList(count.failedStartYears)}.`;
}

function formatPercent(stockPercent: number): string {
  const n = Number.isFinite(stockPercent) ? Math.min(100, Math.max(0, stockPercent)) : 0;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function yearList(years: number[]): string {
  if (years.length <= 1) return String(years[0] ?? "");
  if (years.length === 2) return `${years[0]} and ${years[1]}`;
  return `${years.slice(0, -1).join(", ")}, and ${years[years.length - 1]}`;
}
