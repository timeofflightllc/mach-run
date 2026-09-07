import { addMonths } from "date-fns";
import { formatMonthYear, iso, monthStart, validIso, dateAtAge, yearlyRateToMonthly } from "./dates.ts";
import { streamBenefitToday, streamWindow } from "./engine.ts";
import { usd } from "./format.ts";
import type { IncomeKind, IncomeStream, Plan } from "./types.ts";

/** Long-Treasury / SPIA-ish measuring stick. Not a product quote. */
export const ZERO_RISK_DISCOUNT_PCT = 4;

const GUARANTEED: IncomeKind[] = [
  "military",
  "va",
  "ss",
  "pension",
  "other_retirement",
];

export function isUsGuaranteedKind(kind: string): boolean {
  return (GUARANTEED as string[]).includes(kind);
}

function kindLabel(kind: IncomeKind, name: string): string {
  const named = name.trim();
  if (named) return named;
  if (kind === "military") return "Military retired pay";
  if (kind === "va") return "VA disability";
  if (kind === "ss") return "Social Security";
  if (kind === "pension") return "Pension";
  return "Other retirement income";
}

function streamColaAnnual(plan: Plan, stream: IncomeStream): number {
  if (stream.colaPct != null && Number.isFinite(stream.colaPct)) return stream.colaPct / 100;
  const d = plan.assumptions.defaultColaPct;
  if (d != null && Number.isFinite(d)) return d / 100;
  return (plan.assumptions.inflationPct || 0) / 100;
}

export type AnnuityLine = {
  id: string;
  kind: IncomeKind;
  label: string;
  start: string;
  alreadyPaying: boolean;
  monthlyToday: number;
  pvToday: number;
};

export type AnnuityEquivalent = {
  discountPct: number;
  throughAge: number;
  lines: AnnuityLine[];
  totalPvToday: number;
};

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function presentValueOfGuaranteedStream(
  plan: Plan,
  stream: IncomeStream,
  discountPct = ZERO_RISK_DISCOUNT_PCT,
): number {
  const asOf = monthStart(plan.assumptions.asOfDate);
  const win = streamWindow(plan, stream);
  const start = monthStart(win.start);
  const end = win.end
    ? monthStart(win.end)
    : validIso(plan.primary.birthDate)
      ? monthStart(iso(dateAtAge(plan.primary.birthDate, plan.assumptions.projectionEndAge)))
      : addMonths(asOf, 12 * Math.max(10, plan.assumptions.projectionEndAge - 40));
  const rf = yearlyRateToMonthly(discountPct / 100);
  const cola = yearlyRateToMonthly(streamColaAnnual(plan, stream));
  let pv = 0;
  const last = end < start ? start : end;
  const horizon = addMonths(asOf, 12 * 80);
  let cursor = start < asOf ? asOf : start;
  while (cursor <= last && cursor <= horizon) {
    const fromAsOf = monthsBetween(asOf, cursor);
    if (fromAsOf < 0) {
      cursor = addMonths(cursor, 1);
      continue;
    }
    const todayAmt = streamBenefitToday(plan, stream, cursor);
    if (todayAmt > 0) {
      const nominal = todayAmt * (1 + cola) ** fromAsOf;
      pv += nominal / (1 + rf) ** fromAsOf;
    }
    cursor = addMonths(cursor, 1);
  }
  return pv;
}

export function guaranteedAnnuityEquivalent(plan: Plan): AnnuityEquivalent | null {
  const asOf = monthStart(plan.assumptions.asOfDate);
  const asOfIso = iso(asOf).slice(0, 7);
  const lines: AnnuityLine[] = [];
  for (const stream of plan.incomes) {
    if (!isUsGuaranteedKind(stream.kind)) continue;
    const today = streamBenefitToday(plan, stream, asOf);
    const win = streamWindow(plan, stream);
    const pv = presentValueOfGuaranteedStream(plan, stream);
    if (pv < 1 && today < 1) continue;
    lines.push({
      id: stream.id,
      kind: stream.kind,
      label: kindLabel(stream.kind, stream.name),
      start: win.start,
      alreadyPaying: win.start.slice(0, 7) <= asOfIso,
      monthlyToday: today,
      pvToday: pv,
    });
  }
  if (!lines.length) return null;
  lines.sort((a, b) => a.start.localeCompare(b.start) || a.label.localeCompare(b.label));
  return {
    discountPct: ZERO_RISK_DISCOUNT_PCT,
    throughAge: plan.assumptions.projectionEndAge,
    lines,
    totalPvToday: lines.reduce((s, l) => s + l.pvToday, 0),
  };
}

export function annuityEquivalentCopy(eq: AnnuityEquivalent): { title: string; body: string } {
  const rows = eq.lines.map((l) => {
    const when = l.alreadyPaying
      ? `already paying`
      : `starts ${formatMonthYear(l.start)}`;
    return `${l.label} (${when}): ${usd(l.pvToday)} equivalent lump sum today.`;
  });
  const stack: string[] = [];
  let running = 0;
  for (const l of eq.lines) {
    running += l.pvToday;
    if (!l.alreadyPaying) {
      stack.push(
        `When ${l.label} starts ${formatMonthYear(l.start)}, guaranteed checks on this run are worth about ${usd(running)} as a lump sum today.`,
      );
    }
  }
  const body = [
    `U.S. guaranteed paychecks (military retired pay, VA, Social Security, pension, other retirement) are not a nest egg you can sell — but they replace what a zero-risk annuity would have to pay. Discounted at ${eq.discountPct}% nominal with your COLA, through age ${eq.throughAge}:`,
    ...rows,
    eq.lines.length > 1 ? `All of them together: ${usd(eq.totalPvToday)}.` : "",
    ...stack,
    "This is a measuring stick, not a product you can buy and not a guarantee. The Treasury and an insurer would price the same check differently.",
  ]
    .filter(Boolean)
    .join("\n");
  return { title: "Guaranteed-paycheck equivalent", body };
}
