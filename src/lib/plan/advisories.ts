import { format } from "date-fns";
import {
  contributionWindow,
  simulate,
  spendingWindow,
  streamWindow,
} from "./engine.ts";
import { monthBefore, monthStart, validIso } from "./dates.ts";
import { isTaxQualified } from "./family-owners.ts";
import { usd } from "./format.ts";
import type { Plan, PlanConfirmation } from "./types.ts";

const EARNED = new Set(["salary", "bonus", "other"]);

export interface AdvisorySide {
  id: string;
  name: string;
  amount: number;
  start: string;
  end: string | null;
}

export interface AdvisoryMonth {
  date: string;
  asked: number;
  got: number;
  short: boolean;
}

export type AdvisoryDetail =
  | {
      kind: "overlap";
      verb: "paid" | "spent";
      overlapStart: string;
      current: AdvisorySide;
      other: AdvisorySide;
    }
  | {
      kind: "cash";
      ruleId: string;
      mode: "fixed" | "percent";
      monthlyAmount: number;
      percent: number | null;
      incomeName: string | null;
      start: string;
      end: string | null;
      year: number;
      laterYears: number;
      months: AdvisoryMonth[];
    };

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
  detail: AdvisoryDetail;
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
        detail: {
          kind: "overlap",
          verb,
          overlapStart: start,
          current: {
            id: later.id,
            name: later.name,
            amount: later.amount,
            start: later.start,
            end: later.end,
          },
          other: {
            id: earlier.id,
            name: earlier.name,
            amount: earlier.amount,
            start: earlier.start,
            end: earlier.end,
          },
        },
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

  const byRule = new Map<string, MonthHit[]>();
  for (const row of rows) {
    const tried = row.eligible ?? row.planned;
    if (tried <= 0.5 && row.invested <= 0.5) continue;
    const list = byRule.get(row.ruleId) ?? [];
    list.push({
      date: row.date,
      asked: tried,
      got: row.invested,
      short: tried > row.invested + 0.5,
    });
    byRule.set(row.ruleId, list);
  }

  const out: Advisory[] = [];
  plan.contributions.forEach((rule, index) => {
    const hits = byRule.get(rule.id);
    if (!hits?.some((hit) => hit.short)) return;
    const byYear = new Map<number, MonthHit[]>();
    for (const hit of hits) {
      const year = Number(hit.date.slice(0, 4));
      const list = byYear.get(year) ?? [];
      list.push(hit);
      byYear.set(year, list);
    }
    const years = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
    const firstIndex = years.findIndex(([, list]) => list.some((hit) => hit.short));
    if (firstIndex < 0) return;
    const [year, list] = years[firstIndex];
    const later = years
      .slice(firstIndex + 1)
      .filter(([, row]) => row.some((hit) => hit.short)).length;
    const win = contributionWindow(plan, rule);
    const name = rule.label.trim() || `Contribution ${index + 1}`;
    const shown = list.reduce((sum, hit) => sum + hit.asked, 0);
    const ordered = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const income =
      rule.amountMode === "percent" && rule.percentOfIncomeId
        ? plan.incomes.find((stream) => stream.id === rule.percentOfIncomeId)
        : undefined;
    const shortHits = list.filter((hit) => hit.short);
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
        year,
        Math.round(shown),
        list.filter((hit) => hit.short).length,
      ].join("|"),
      body: cashSentence(year, list, later, aheadPhrase(plan, rule.id, shortHits, rows)),
      keep: "Keep it",
      endOther: null,
      detail: {
        kind: "cash",
        ruleId: rule.id,
        mode: rule.amountMode === "percent" ? "percent" : "fixed",
        monthlyAmount: rule.monthlyAmount,
        percent: rule.percentOfIncome ?? null,
        incomeName: income?.name.trim() || null,
        start: win.start,
        end: win.end,
        year,
        laterYears: later,
        months: ordered.map((hit) => ({
          date: hit.date,
          asked: hit.asked,
          got: hit.got,
          short: hit.short,
        })),
      },
    });
  });
  return out;
}

interface MonthHit {
  date: string;
  asked: number;
  got: number;
  short: boolean;
}

function sumHits(hits: MonthHit[], key: "asked" | "got"): number {
  return hits.reduce((sum, hit) => sum + hit[key], 0);
}

function monthSpan(hits: MonthHit[]): string {
  const labels = [...hits]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((hit) => ({
      year: Number(hit.date.slice(0, 4)),
      month: Number(hit.date.slice(5, 7)),
      name: format(monthStart(hit.date), "MMMM"),
    }));
  if (!labels.length) return "";
  if (labels.length === 1) return `${labels[0].name} ${labels[0].year}`;
  const sameYear = labels.every((label) => label.year === labels[0].year);
  const contiguous = labels.every(
    (label, index) => index === 0 || label.month === labels[index - 1].month + 1,
  );
  if (sameYear && labels.length === 2) {
    return `${labels[0].name} and ${labels[1].name} ${labels[0].year}`;
  }
  if (sameYear && contiguous) {
    return `${labels[0].name} through ${labels[labels.length - 1].name} ${labels[0].year}`;
  }
  if (sameYear) {
    return `${labels.map((label) => label.name).join(", ")} ${labels[0].year}`;
  }
  return labels.map((label) => `${label.name} ${label.year}`).join(", ");
}

function cashSentence(
  year: number,
  hits: MonthHit[],
  laterYears: number,
  ahead: string,
): string {
  const ordered = [...hits].sort((a, b) => a.date.localeCompare(b.date));
  const short = ordered.filter((hit) => hit.short);
  const covered = ordered.filter((hit) => !hit.short);
  const again =
    laterYears === 0
      ? ""
      : ` The same shortfall shows up in ${laterYears} later ${laterYears === 1 ? "year" : "years"}.`;
  const reason = `The rest is more than income minus taxes minus spending. ${ahead}`;
  if (!covered.length) {
    const asked = sumHits(ordered, "asked");
    const got = sumHits(ordered, "got");
    const monthly = ordered[0]?.asked ?? 0;
    const flat = ordered.every((hit) => Math.abs(hit.asked - monthly) < 1);
    const count = ordered.length;
    if (flat && count === 12) {
      return `In ${year} this is ${usd(monthly)} a month, ${usd(asked)} for the year. ${usd(got)} of that will be invested. ${reason}${again}`;
    }
    if (flat && count === 1) {
      return `${monthSpan(ordered)} asks for ${usd(asked)}. ${usd(got)} of that will be invested. ${reason}${again}`;
    }
    if (flat) {
      const unit = count === 2 ? "those two months" : `those ${count} months`;
      return `${monthSpan(ordered)}: ${usd(monthly)} a month, ${usd(asked)} for ${unit}. ${usd(got)} of that will be invested. ${reason}${again}`;
    }
    return `${monthSpan(ordered)}: ${usd(asked)} asked, ${usd(got)} invested. ${reason}${again}`;
  }
  const missedAsked = sumHits(short, "asked");
  const missedGot = sumHits(short, "got");
  return `${monthSpan(covered)} will be invested (${usd(sumHits(covered, "got"))}). ${monthSpan(short)} asks for ${usd(missedAsked)} and ${usd(missedGot)} of that will be invested. ${reason}${again}`;
}

function fundingRank(plan: Plan): Map<string, number> {
  const ordered = plan.contributions
    .map((rule, index) => {
      const dest = plan.portfolios.find((row) => row.id === rule.portfolioId);
      return { id: rule.id, index, qualified: dest ? isTaxQualified(dest.kind) : false };
    })
    .sort((a, b) => Number(b.qualified) - Number(a.qualified) || a.index - b.index);
  return new Map(ordered.map((row, index) => [row.id, index]));
}

function aheadPhrase(
  plan: Plan,
  ruleId: string,
  short: MonthHit[],
  rows: { date: string; ruleId: string; invested: number }[],
): string {
  const order = fundingRank(plan);
  const mine = order.get(ruleId) ?? 0;
  const nameOf = new Map(
    plan.contributions.map((rule, index) => [
      rule.id,
      rule.label.trim() || `Contribution ${index + 1}`,
    ]),
  );
  const bits: string[] = [];
  const seen = new Set<string>();
  for (const hit of [...short].sort((a, b) => a.date.localeCompare(b.date))) {
    const ahead = rows
      .filter(
        (row) =>
          row.date === hit.date && (order.get(row.ruleId) ?? 0) < mine && row.invested > 0.5,
      )
      .sort((a, b) => (order.get(a.ruleId) ?? 0) - (order.get(b.ruleId) ?? 0));
    const text = ahead
      .map((row) => `${nameOf.get(row.ruleId) ?? "Contribution"} ${usd(row.invested)}`)
      .join(" and ");
    if (seen.has(text)) continue;
    seen.add(text);
    if (!text) bits.push("nothing else was funded ahead of this one");
    else if (short.length === 1) bits.push(text);
    else bits.push(`${monthLabel(hit.date)}: ${text}`);
  }
  if (bits.length === 1 && bits[0] === "nothing else was funded ahead of this one") {
    return "Tax-qualified contributions are funded first. Nothing else was funded ahead of this one.";
  }
  if (bits.length === 1) {
    return `Tax-qualified contributions are funded first. Ahead of this one: ${bits[0]}.`;
  }
  return `Tax-qualified contributions are funded first. Ahead of this one — ${bits.join("; ")}.`;
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
