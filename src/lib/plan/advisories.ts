import { format } from "date-fns";
import {
  contributionWindow,
  simulate,
  spendingWindow,
  streamWindow,
} from "./engine.ts";
import { monthBefore, monthStart, validIso } from "./dates.ts";
import { usd } from "./format.ts";
import type { Plan, PlanConfirmation } from "./types.ts";

const EARNED = new Set(["salary", "bonus", "other"]);

export interface Advisory {
  id: string;
  cardId: string;
  step: "income" | "spending" | "contributions";
  kind: "overlap" | "cash";
  name: string;
  fingerprint: string;
  body: string;
  keep: string;
  /** Set the other block's end to the month before this one starts. */
  endOther: {
    kind: "income" | "spending";
    id: string;
    endDate: string;
  } | null;
}

interface Windowed {
  id: string;
  name: string;
  start: string;
  end: string | null;
  amount: number;
}

function monthLabel(iso: string): string {
  if (!validIso(iso)) return iso;
  return format(monthStart(iso), "MMM yyyy");
}

/** First month both windows cover, or null. A blank end stays open. */
export function overlapMonth(
  a: { start: string; end: string | null },
  b: { start: string; end: string | null },
): string | null {
  if (!validIso(a.start) || !validIso(b.start)) return null;
  const start = a.start > b.start ? a.start : b.start;
  const end =
    a.end && b.end ? (a.end < b.end ? a.end : b.end) : (a.end ?? b.end);
  if (end && start.slice(0, 7) > end.slice(0, 7)) return null;
  return start;
}

function pairFingerprint(later: Windowed, earlier: Windowed): string {
  return [
    later.id,
    earlier.id,
    later.start,
    later.end ?? "",
    later.amount,
    earlier.start,
    earlier.end ?? "",
    earlier.amount,
  ].join("|");
}

function overlaps(rows: Windowed[], step: "income" | "spending"): Advisory[] {
  const out: Advisory[] = [];
  for (let i = 0; i < rows.length; i++) {
    const later = rows[i];
    if (later.amount <= 0) continue;
    for (let j = 0; j < i; j++) {
      const earlier = rows[j];
      if (earlier.amount <= 0) continue;
      const start = overlapMonth(later, earlier);
      if (!start) continue;
      const endDate = monthBefore(later.start);
      const canEnd =
        Boolean(endDate) &&
        validIso(earlier.start) &&
        endDate.slice(0, 7) >= earlier.start.slice(0, 7);
      const verb = step === "income" ? "paid" : "spent";
      out.push({
        id: `${step}:${later.id}:${earlier.id}`,
        cardId: `card-${step}-${later.id}`,
        step,
        kind: "overlap",
        name: later.name,
        fingerprint: pairFingerprint(later, earlier),
        body: `This overlaps ${earlier.name} from ${monthLabel(start)} on. Both amounts will be ${verb} each month.`,
        keep: "Keep both",
        endOther: canEnd
          ? { kind: step, id: earlier.id, endDate }
          : null,
      });
      break;
    }
  }
  return out;
}

function incomeRows(plan: Plan): Windowed[] {
  const rows: Windowed[] = [];
  plan.incomes.forEach((stream, index) => {
    if (!EARNED.has(stream.kind)) return;
    const win = streamWindow(plan, stream);
    rows.push({
      id: stream.id,
      name: stream.name.trim() || `Income ${index + 1}`,
      start: win.start,
      end: win.end,
      amount: stream.monthlyAmount,
    });
  });
  return rows;
}

function spendingRows(plan: Plan): Windowed[] {
  return plan.spending.map((phase, index) => {
    const win = spendingWindow(plan, phase);
    return {
      id: phase.id,
      name: phase.label.trim() || `Spending ${index + 1}`,
      start: win.start,
      end: win.end,
      amount: phase.monthlyAmount,
    };
  });
}

function cashAdvisories(plan: Plan): Advisory[] {
  const active = plan.contributions.some((rule) => {
    if (rule.amountMode === "percent") return (rule.percentOfIncome ?? 0) > 0;
    return rule.monthlyAmount > 0;
  });
  if (!active) return [];
  let sim;
  try {
    sim = simulate(plan, { audit: true });
  } catch {
    return [];
  }
  const rows = sim.audit?.contributions ?? [];
  if (!rows.length) return [];

  const leftoverByDate = new Map<string, number>();
  for (const month of sim.months) {
    leftoverByDate.set(month.date, month.income - month.tax - month.spending);
  }
  const askedByDate = new Map<string, number>();
  for (const row of rows) {
    askedByDate.set(row.date, (askedByDate.get(row.date) ?? 0) + row.planned);
  }
  const shortDates = new Set<string>();
  for (const [date, asked] of askedByDate) {
    const leftover = leftoverByDate.get(date) ?? 0;
    if (asked > Math.max(0, leftover) + 1) shortDates.add(date);
  }

  const byRule = new Map<string, Map<number, { asked: number; got: number }>>();
  for (const row of rows) {
    if (!shortDates.has(row.date)) continue;
    if (row.planned <= row.invested + 0.5) continue;
    const year = Number(row.date.slice(0, 4));
    let years = byRule.get(row.ruleId);
    if (!years) {
      years = new Map();
      byRule.set(row.ruleId, years);
    }
    const bucket = years.get(year) ?? { asked: 0, got: 0 };
    bucket.asked += row.planned;
    bucket.got += row.invested;
    years.set(year, bucket);
  }

  const out: Advisory[] = [];
  plan.contributions.forEach((rule, index) => {
    const years = byRule.get(rule.id);
    if (!years) return;
    const ordered = [...years.entries()].sort((a, b) => a[0] - b[0]);
    const first = ordered.find(([, bucket]) => bucket.asked > bucket.got + 1);
    if (!first) return;
    const [year, bucket] = first;
    const later = ordered.filter(([y, row]) => y !== year && row.asked > row.got + 1).length;
    const win = contributionWindow(plan, rule);
    const name = rule.label.trim() || `Contribution ${index + 1}`;
    const again =
      later === 0 ? "" : ` This also happens in ${later} later ${later === 1 ? "year" : "years"}.`;
    out.push({
      id: `cash:${rule.id}`,
      cardId: `card-contributions-${rule.id}`,
      step: "contributions",
      kind: "cash",
      name,
      fingerprint: [
        rule.id,
        rule.amountMode ?? "fixed",
        rule.monthlyAmount,
        rule.percentOfIncome ?? "",
        rule.percentOfIncomeId ?? "",
        win.start,
        win.end ?? "",
        Math.round(bucket.asked),
        Math.round(bucket.got),
      ].join("|"),
      body: `In ${year} you asked to invest ${usd(bucket.asked)}. ${usd(bucket.got)} of that will be invested. The rest is more than income minus taxes minus spending, after the contributions above this one.${again}`,
      keep: "Keep it",
      endOther: null,
    });
  });
  return out;
}

let cachedKey = "";
let cached: Advisory[] = [];

function planKey(plan: Plan): string {
  return JSON.stringify({
    incomes: plan.incomes,
    spending: plan.spending,
    contributions: plan.contributions,
    portfolios: plan.portfolios,
    liabilities: plan.liabilities,
    assumptions: plan.assumptions,
    primary: plan.primary,
    spouse: plan.spouse,
    children: plan.children,
    stages: plan.stages,
  });
}

/** Every prompt the household has not already kept. */
export function openAdvisories(plan: Plan): Advisory[] {
  const key = planKey(plan);
  if (key !== cachedKey) {
    cachedKey = key;
    cached = [
      ...overlaps(incomeRows(plan), "income"),
      ...overlaps(spendingRows(plan), "spending"),
      ...cashAdvisories(plan),
    ];
  }
  const kept = new Map(
    (plan.confirmations ?? []).map((row) => [row.id, row.fingerprint]),
  );
  return cached.filter((row) => kept.get(row.id) !== row.fingerprint);
}

export function keptConfirmation(
  plan: Plan,
  advisory: Advisory,
): PlanConfirmation {
  return { id: advisory.id, fingerprint: advisory.fingerprint };
}
