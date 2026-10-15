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

export interface AdvisoryAhead {
  id: string;
  name: string;
  /** Same ask every month of the conflict. Null when the months differ. */
  monthly: number | null;
  months: { date: string; asked: number }[];
  period: number;
}

export interface AdvisoryMonth {
  date: string;
  asked: number;
  got: number;
  short: boolean;
  income: number;
  tax: number;
  spending: number;
  leftover: number;
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
      stopDate: string | null;
      year: number;
      laterYears: number;
      months: AdvisoryMonth[];
      lines: string[];
      ahead: AdvisoryAhead[];
      aheadSpan: string;
      notes: string[];
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
  const byDate = new Map(sim.months.map((month) => [month.date, month]));

  const byRule = new Map<string, MonthHit[]>();
  for (const row of rows) {
    const tried = row.eligible ?? row.planned;
    if (tried <= 0.5 && row.invested <= 0.5) continue;
    const month = byDate.get(row.date);
    const list = byRule.get(row.ruleId) ?? [];
    list.push({
      date: row.date,
      asked: tried,
      got: row.invested,
      short: tried > row.invested + 0.5,
      income: month?.income ?? 0,
      tax: month?.tax ?? 0,
      spending: month?.spending ?? 0,
      leftover: month?.surplus ?? 0,
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
    const ahead = aheadAsks(plan, rule.id, shortHits, rows);
    const copy = cashCopy(year, list, later, ahead);
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
        rule.payCadence ?? "",
        rule.payAmount ?? "",
        rule.percentOfIncome ?? "",
        rule.percentOfIncomeId ?? "",
        win.start,
        win.end ?? "",
        rule.stopDate ?? "",
        year,
        Math.round(shown),
        list.filter((hit) => hit.short).length,
      ].join("|"),
      body: copy.body,
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
        stopDate: rule.stopDate ?? null,
        year,
        laterYears: later,
        months: ordered.map((hit) => ({
          date: hit.date,
          asked: hit.asked,
          got: hit.got,
          short: hit.short,
          income: hit.income,
          tax: hit.tax,
          spending: hit.spending,
          leftover: hit.leftover,
        })),
        lines: copy.lines,
        ahead: copy.ahead,
        aheadSpan: monthSpan(shortHits),
        notes: copy.notes,
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
  income: number;
  tax: number;
  spending: number;
  leftover: number;
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

function cashCopy(
  year: number,
  hits: MonthHit[],
  laterYears: number,
  aheadItems: AdvisoryAhead[],
): { body: string; lines: string[]; ahead: AdvisoryAhead[]; notes: string[] } {
  const ordered = [...hits].sort((a, b) => a.date.localeCompare(b.date));
  const short = ordered.filter((hit) => hit.short);
  const covered = ordered.filter((hit) => !hit.short);
  const again =
    laterYears === 0
      ? ""
      : `The same shortfall shows up in ${laterYears} later ${laterYears === 1 ? "year" : "years"}.`;
  const broke = short.length > 0 && short.every((hit) => hit.leftover <= 0.5);
  const sample = short[0] ?? ordered[0];
  const brokeNote = `This is not an IRS limit. Income does not cover taxes and spending, so nothing is left to invest. ${monthLabel(sample.date)}: income ${usd(sample.income)}, tax ${usd(sample.tax)}, spending ${usd(sample.spending)}. MACH RUN will not take this contribution from savings.`;
  const names = aheadItems.map((item) => item.name);
  const ahead = broke ? [] : aheadItems;
  const reason = broke
    ? brokeNote
    : ahead.length
      ? `Tax-qualified contributions are funded first. Paid before this one: ${joinNames(names)}.`
      : "The cash after tax and spending is not enough. Nothing else was funded ahead of this one.";
  const lines = cashLines(year, ordered, covered, short);
  const notes = [broke ? brokeNote : ahead.length ? "" : reason, again].filter(Boolean);
  const body = `${lines.join(" ")}${lines.length ? " " : ""}${reason}${again ? ` ${again}` : ""}`;
  return { body, lines, ahead, notes };
}

function cashLines(
  year: number,
  ordered: MonthHit[],
  covered: MonthHit[],
  short: MonthHit[],
): string[] {
  if (!covered.length) {
    const asked = sumHits(ordered, "asked");
    const got = sumHits(ordered, "got");
    const monthly = ordered[0]?.asked ?? 0;
    const flat = ordered.every((hit) => Math.abs(hit.asked - monthly) < 1);
    const count = ordered.length;
    if (flat && count === 12) {
      return [
        `In ${year} this is ${usd(monthly)} a month, ${usd(asked)} for the year.`,
        `${usd(got)} of that will be invested.`,
      ];
    }
    if (flat && count === 1) {
      return [
        `${monthSpan(ordered)} asks for ${usd(asked)}.`,
        `${usd(got)} of that will be invested.`,
      ];
    }
    if (flat) {
      const unit = count === 2 ? "those two months" : `those ${count} months`;
      return [
        `${monthSpan(ordered)}: ${usd(monthly)} a month, ${usd(asked)} for ${unit}.`,
        `${usd(got)} of that will be invested.`,
      ];
    }
    return [`${monthSpan(ordered)}: ${usd(asked)} asked, ${usd(got)} invested.`];
  }
  return [
    `${monthSpan(covered)} is fully invested (${usd(sumHits(covered, "got"))}).`,
    `${monthSpan(short)} asked ${usd(sumHits(short, "asked"))} and invested ${usd(sumHits(short, "got"))}.`,
  ];
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

function aheadAsks(
  plan: Plan,
  ruleId: string,
  short: MonthHit[],
  rows: { date: string; ruleId: string; invested: number; eligible?: number; planned?: number }[],
): AdvisoryAhead[] {
  const order = fundingRank(plan);
  const mine = order.get(ruleId) ?? 0;
  const nameOf = new Map(
    plan.contributions.map((rule, index) => [
      rule.id,
      rule.label.trim() || `Contribution ${index + 1}`,
    ]),
  );
  const ids: string[] = [];
  for (const hit of short) {
    for (const row of rows) {
      if (row.date !== hit.date || row.invested <= 0.5) continue;
      if ((order.get(row.ruleId) ?? 0) >= mine) continue;
      if (!ids.includes(row.ruleId)) ids.push(row.ruleId);
    }
  }
  ids.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return ids.map((id) => {
    const months = [...short]
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap((hit) => {
        const row = rows.find((item) => item.date === hit.date && item.ruleId === id);
        if (!row) return [];
        return [{ date: hit.date, asked: row.eligible ?? row.planned ?? 0 }];
      });
    const period = months.reduce((sum, month) => sum + month.asked, 0);
    const first = months[0]?.asked ?? 0;
    const flat = months.length > 0 && months.every((month) => Math.abs(month.asked - first) < 1);
    return {
      id,
      name: nameOf.get(id) ?? "Contribution",
      monthly: flat ? first : null,
      months,
      period,
    };
  });
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
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
