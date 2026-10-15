import type { Plan, SimResult, YearSnapshot } from "./types";
import { runOutSentence, survivalSentence, type SurvivalBand, type SurvivalScore } from "./monte-carlo-run";

/** Same windows as the on-screen span chips. 5 means the as-of year through five years later. */
export type ChartSpan = 5 | 10 | 20 | "horizon";
export type ChartPdfChoice = "spendable" | "cash" | "net" | "monte";
export type ChartOrientation = "portrait" | "landscape";

const FOOTER = "Illustration only. Not financial advice.";

const GREEN = "0.102 0.420 0.290";
const GREEN_DEEP = "0.102 0.208 0.149";
const RED = "0.722 0.275 0.275";
const INK = "0.102 0.141 0.220";
const MUTED = "0.290 0.349 0.420";
const GOLD = "0.620 0.480 0.120";
const BAND = "0.620 0.860 0.740";
const GRID = "0.820 0.860 0.840";

type LineSeries = { name: string; color: string; values: number[] };

type PdfChart = {
  title: string;
  note: string;
  labels: string[];
  lines: LineSeries[];
  band?: { name: string; low: number[]; high: number[] };
  captions: string[];
};

/** Copy of yearsInView. Do not tighten the end year. */
export function chartYears<T extends { year: number }>(
  asOfDate: string,
  years: readonly T[],
  span: ChartSpan,
): T[] {
  if (span === "horizon") return [...years];
  const startYear = Number(asOfDate.slice(0, 4));
  const sliced = years.filter((year) => year.year >= startYear && year.year <= startYear + span);
  return sliced.length ? sliced : [...years];
}

function pdfEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[–—]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x09\x20-\x7E]/g, "");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function spanLabel(span: ChartSpan): string {
  if (span === "horizon") return "Horizon";
  return `${span}-Year`;
}

function dollarLabel(plan: Plan): string {
  return plan.assumptions.dollars === "real" ? "Today's dollars" : "Future dollars";
}

function deflate(plan: Plan, year: number, value: number): number {
  if (plan.assumptions.dollars !== "real") return value;
  const asOfYear = Number(plan.assumptions.asOfDate.slice(0, 4));
  const inf = plan.assumptions.inflationPct / 100;
  const deflator = (1 + inf) ** (year - asOfYear);
  if (!Number.isFinite(deflator) || deflator === 0) return value;
  return value / deflator;
}

function spendableChart(plan: Plan, years: YearSnapshot[]): PdfChart | null {
  if (years.length < 2) return null;
  const real = plan.assumptions.dollars === "real";
  return {
    title: "Spendable Wealth",
    note: "",
    labels: years.map((year) => String(year.year)),
    lines: [
      {
        name: "Spendable",
        color: GREEN_DEEP,
        values: years.map((year) => Math.round(finite(real ? year.endSpendableReal : year.endSpendable))),
      },
    ],
    captions: [],
  };
}

function cashChart(plan: Plan, years: YearSnapshot[]): PdfChart | null {
  if (years.length < 2) return null;
  const series = (name: string, color: string, pick: (year: YearSnapshot) => number): LineSeries => ({
    name,
    color,
    values: years.map((year) => Math.round(finite(deflate(plan, year.year, pick(year))))),
  });
  return {
    title: "Cash Flow",
    note: "",
    labels: years.map((year) => String(year.year)),
    lines: [
      series("Income", GREEN, (year) => year.income),
      series("Spending", RED, (year) => year.spending),
      series("Contributions", INK, (year) => year.contributions),
      series("Guaranteed", GOLD, (year) => year.guaranteed),
    ],
    captions: [],
  };
}

function netChart(plan: Plan, years: YearSnapshot[]): PdfChart | null {
  if (years.length < 2) return null;
  const real = plan.assumptions.dollars === "real";
  const pick = (nominal: number, today: number) => Math.round(finite(real ? today : nominal));
  return {
    title: "Net Worth",
    note: "",
    labels: years.map((year) => String(year.year)),
    lines: [
      {
        name: "Assets",
        color: GREEN,
        values: years.map((year) => pick(year.endAssets, year.endAssetsReal)),
      },
      {
        name: "Liabilities",
        color: RED,
        values: years.map((year) => -pick(year.endLiabilities, year.endLiabilitiesReal)),
      },
      {
        name: "Net worth",
        color: GREEN_DEEP,
        values: years.map((year) => pick(year.endNetWorth, year.endNetWorthReal)),
      },
    ],
    captions: [],
  };
}

function monteChart(
  plan: Plan,
  bands: SurvivalBand[],
  survival: Pick<SurvivalScore, "score" | "survived" | "paths" | "runOutAge">,
): PdfChart | null {
  if (bands.length < 2) return null;
  const real = plan.assumptions.dollars === "real";
  const age = plan.assumptions.projectionEndAge;
  const ranOut = runOutSentence(survival, age);
  return {
    title: "Monte Carlo Plan Survival",
    note: "",
    labels: bands.map((band) => String(band.year)),
    lines: [
      {
        name: "Middle future",
        color: GREEN_DEEP,
        values: bands.map((band) => finite(real ? band.p50Real : band.p50)),
      },
    ],
    band: {
      name: "8 of 10 futures",
      low: bands.map((band) => finite(real ? band.p10Real : band.p10)),
      high: bands.map((band) => finite(real ? band.p90Real : band.p90)),
    },
    captions: [survivalSentence(survival.score, age), ranOut ?? ""].filter(Boolean),
  };
}

function chartsFor(
  plan: Plan,
  sim: Pick<SimResult, "years">,
  span: ChartSpan,
  picked: ChartPdfChoice[],
  survival: Pick<SurvivalScore, "score" | "survived" | "paths" | "runOutAge" | "bands"> | null,
): PdfChart[] {
  const years = chartYears(plan.assumptions.asOfDate, sim.years, span);
  const note = `${dollarLabel(plan)} - ${spanLabel(span)}`;
  const out: PdfChart[] = [];
  for (const id of picked) {
    const chart =
      id === "spendable"
        ? spendableChart(plan, years)
        : id === "cash"
          ? cashChart(plan, years)
          : id === "net"
            ? netChart(plan, years)
            : survival
              ? monteChart(plan, chartYears(plan.assumptions.asOfDate, survival.bands, span), survival)
              : null;
    if (!chart) continue;
    chart.note = note;
    out.push(chart);
  }
  return out;
}

function compactUsd(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function textOp(font: string, size: number, color: string, x: number, y: number, line: string): string {
  return `BT ${font} ${size} Tf ${color} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfEscape(line)}) Tj ET`;
}

function domain(chart: PdfChart, followBand: boolean): { min: number; max: number } {
  const vals: number[] = [];
  if (chart.band) vals.push(...chart.band.low, ...chart.band.high);
  for (const line of chart.lines) vals.push(...line.values);
  if (!vals.length) vals.push(0, 1);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (!followBand) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (!(max > min)) max = min + 1;
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

function drawChart(chart: PdfChart, left: number, bottom: number, width: number, height: number): string {
  const followBand = Boolean(chart.band);
  const { min, max } = domain(chart, followBand);
  const captionLines = chart.captions.flatMap((line) => wrapText(line, Math.max(24, Math.floor(width / 5.4))));
  const captionH = captionLines.length ? captionLines.length * 11 + 6 : 0;
  const titleY = bottom + height - 16;
  const legendY = bottom + captionH + 4;
  const plotB = legendY + 32;
  const plotT = titleY - 28;
  const plotL = left + 46;
  const plotR = left + width - 8;
  const plotW = Math.max(10, plotR - plotL);
  const plotH = Math.max(10, plotT - plotB);
  const n = chart.labels.length;
  const xAt = (i: number) => plotL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => plotB + ((v - min) / (max - min)) * plotH;
  const ops: string[] = [
    textOp("/F2", 13, GREEN_DEEP, left, titleY, chart.title),
    textOp("/F1", 9, MUTED, left, titleY - 13, chart.note),
  ];

  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4;
    const y = yAt(v);
    ops.push(`q ${GRID} RG 0.4 w ${plotL.toFixed(1)} ${y.toFixed(1)} m ${plotR.toFixed(1)} ${y.toFixed(1)} l S Q`);
    ops.push(textOp("/F1", 7, MUTED, left, y - 2, compactUsd(v)));
  }

  if (chart.band && chart.band.low.length >= 2) {
    const low = chart.band.low;
    const high = chart.band.high;
    const path = [
      `${xAt(0).toFixed(1)} ${yAt(low[0]).toFixed(1)} m`,
      ...low.slice(1).map((v, i) => `${xAt(i + 1).toFixed(1)} ${yAt(v).toFixed(1)} l`),
      ...high.map((v, i) => `${xAt(high.length - 1 - i).toFixed(1)} ${yAt(v).toFixed(1)} l`),
      "h",
    ].join(" ");
    ops.push(`q ${BAND} rg ${path} f Q`);
  }

  for (const line of chart.lines) {
    if (line.values.length < 2) continue;
    const pts = line.values.map((v, i) => `${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`);
    const stroke = [`${pts[0]} m`, ...pts.slice(1).map((p) => `${p} l`)].join(" ");
    ops.push(`q ${line.color} RG 1.6 w ${stroke} S Q`);
  }

  const tickAt = n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1];
  const seen = new Set<number>();
  for (const i of tickAt) {
    if (i < 0 || i >= n || seen.has(i)) continue;
    seen.add(i);
    ops.push(textOp("/F1", 8, MUTED, xAt(i) - 12, plotB - 12, chart.labels[i] ?? ""));
  }

  let lx = left;
  const items = [
    ...(chart.band ? [{ name: chart.band.name, color: BAND }] : []),
    ...chart.lines.map((line) => ({ name: line.name, color: line.color })),
  ];
  for (const item of items) {
    ops.push(`q ${item.color} rg ${lx.toFixed(1)} ${legendY.toFixed(1)} 10 4 re f Q`);
    ops.push(textOp("/F1", 8, INK, lx + 14, legendY, item.name));
    lx += 14 + item.name.length * 4.4 + 14;
  }

  captionLines.forEach((line, index) => {
    ops.push(textOp("/F1", 8, INK, left, bottom + (captionLines.length - 1 - index) * 11, line));
  });
  return ops.join("\n");
}

function pageSize(orientation: ChartOrientation): { w: number; h: number } {
  return orientation === "landscape" ? { w: 792, h: 612 } : { w: 612, h: 792 };
}

function pageSlots(orientation: ChartOrientation, count: number): { left: number; bottom: number; width: number; height: number }[] {
  const { w, h } = pageSize(orientation);
  const margin = 36;
  const footer = 32;
  const width = w - margin * 2;
  if (orientation === "landscape") {
    return [{ left: margin, bottom: footer + 8, width, height: h - margin - footer - 8 }];
  }
  const gap = 16;
  const inner = h - margin - footer - 8;
  const slotH = (inner - gap) / 2;
  const top = { left: margin, bottom: footer + 8 + slotH + gap, width, height: slotH };
  const bottom = { left: margin, bottom: footer + 8, width, height: slotH };
  return count === 1 ? [top] : [top, bottom];
}

function footerOp(width: number, pageNo: number, pageCount: number): string {
  return [
    textOp("/F1", 8, MUTED, 36, 16, FOOTER),
    textOp("/F1", 8, MUTED, width - 88, 16, `${pageNo} of ${pageCount}`),
  ].join("\n");
}

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(n);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function buildChartPdf(input: {
  plan: Plan;
  sim: Pick<SimResult, "years">;
  span: ChartSpan;
  orientation: ChartOrientation;
  charts: ChartPdfChoice[];
  survival?: Pick<SurvivalScore, "score" | "survived" | "paths" | "runOutAge" | "bands"> | null;
}): Uint8Array | null {
  if (!input.sim.years.length || !input.charts.length) return null;
  const charts = chartsFor(input.plan, input.sim, input.span, input.charts, input.survival ?? null);
  if (!charts.length) return null;
  const perPage = input.orientation === "landscape" ? 1 : 2;
  const pages: PdfChart[][] = [];
  for (let i = 0; i < charts.length; i += perPage) pages.push(charts.slice(i, i + perPage));
  const { w, h } = pageSize(input.orientation);
  const streams = pages.map((page, index) => {
    const slots = pageSlots(input.orientation, page.length);
    const ops = page.map((chart, slot) => drawChart(chart, slots[slot].left, slots[slot].bottom, slots[slot].width, slots[slot].height));
    ops.push(footerOp(w, index + 1, pages.length));
    return enc(ops.join("\n"));
  });

  const objs: Uint8Array[] = [];
  const add = (body: Uint8Array) => {
    objs.push(body);
    return objs.length;
  };
  add(enc("<< /Type /Catalog /Pages 2 0 R >>"));
  add(enc("<< /Type /Pages /Kids [] /Count 0 >>"));
  add(enc("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
  add(enc("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"));
  const contentIds = streams.map((stream) =>
    add(concat([enc(`<< /Length ${stream.length} >>\nstream\n`), stream, enc("\nendstream")])),
  );
  const pageIds = contentIds.map((id) =>
    add(
      enc(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents ${id} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
      ),
    ),
  );
  objs[1] = enc(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  );

  const parts: Uint8Array[] = [enc("%PDF-1.4\n")];
  const offsets = [0];
  let pos = parts[0].length;
  for (let i = 0; i < objs.length; i++) {
    offsets.push(pos);
    const obj = concat([enc(`${i + 1} 0 obj\n`), objs[i], enc("\nendobj\n")]);
    parts.push(obj);
    pos += obj.length;
  }
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`;
  parts.push(enc(xref));
  return concat(parts);
}

export function downloadChartPdf(input: Parameters<typeof buildChartPdf>[0]): boolean {
  const bytes = buildChartPdf(input);
  if (!bytes || typeof document === "undefined") return false;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mach-charts.pdf";
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
