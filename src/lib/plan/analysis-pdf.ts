import type { PeerBrief } from "./peers";
import type { Plan, SimResult } from "./types";
import { usd } from "./format";
import { OODA_DISCLAIMER } from "./disclaimer";
import { startingNetWorth, startingSpendable } from "./engine";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 54;
const HEADER_H = 102;
const FOOTER_H = 40;
const NAVY = "0.039 0.094 0.208"; // #0a1835
const SILVER = "0.773 0.804 0.839"; // #c5cdd6
const BODY = "0.102 0.141 0.220"; // #1a2438
const MUTED = "0.290 0.349 0.420";
const WHITE = "1 1 1";
const GREEN_DEEP = "0.102 0.208 0.149"; // #1a3526
const GREEN_MID = "0.141 0.337 0.227"; // #24563a
const GREEN_LINE = "0.290 0.533 0.376"; // #4a8860
const SAGE = "0.616 0.729 0.604"; // #9dba9a
const SAGE_WASH = "0.925 0.957 0.933";
const GOLD = "0.910 0.773 0.278"; // #e8c547
const GOLD_INK = "0.420 0.340 0.080";

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
  return text.split(/\n/).flatMap((para) => {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > maxChars) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  });
}

function jpegSize(bytes: Uint8Array): { w: number; h: number } {
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        h: (bytes[i + 5] << 8) | bytes[i + 6],
        w: (bytes[i + 7] << 8) | bytes[i + 8],
      };
    }
    i += 2 + len;
  }
  return { w: 761, h: 268 };
}

async function loadLogo(): Promise<{ bytes: Uint8Array; w: number; h: number } | null> {
  try {
    const res = await fetch("/brand/mach-run-logo.jpg?v=20");
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { w, h } = jpegSize(bytes);
    return { bytes, w, h };
  } catch {
    return null;
  }
}

type ChartSeries = {
  name: string;
  color: string;
  values: number[];
  fill?: boolean;
  dash?: boolean;
};

type ChartSpec = {
  title: string;
  note: string;
  labels: string[];
  series: ChartSeries[];
};

type Block =
  | { kind: "space"; h: number }
  | { kind: "rule" }
  | { kind: "display"; text: string; size: number }
  | { kind: "title"; text: string }
  | { kind: "body"; text: string }
  | { kind: "muted"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "metric"; label: string; value: string }
  | { kind: "chart"; chart: ChartSpec };

const CHART_H = 168;
const RED = "0.722 0.275 0.275";

function compactUsd(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(a >= 10_000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(a)}`;
}

function horizonYears(sim: SimResult) {
  return sim.years.length ? sim.years : [];
}

function yearLabels(years: { year: number }[]): string[] {
  if (!years.length) return [];
  return years.map((y) => String(y.year));
}

function wealthChart(plan: Plan, sim: SimResult): ChartSpec | null {
  const years = horizonYears(sim);
  if (years.length < 2) return null;
  const real = plan.assumptions.dollars === "real";
  return {
    title: "Spendable wealth — horizon",
    note: real ? "Today's dollars" : "Future dollars",
    labels: yearLabels(years),
    series: [
      {
        name: "Spendable",
        color: GREEN_LINE,
        values: years.map((y) => (real ? y.endSpendableReal : y.endSpendable)),
        fill: true,
      },
      {
        name: "Net worth",
        color: MUTED,
        values: years.map((y) => (real ? y.endNetWorthReal : y.endNetWorth)),
        dash: true,
      },
    ],
  };
}

function cashChart(plan: Plan, sim: SimResult): ChartSpec | null {
  const years = horizonYears(sim);
  if (years.length < 2) return null;
  const real = plan.assumptions.dollars === "real";
  const inf = plan.assumptions.inflationPct / 100;
  const asOfYear = Number(plan.assumptions.asOfDate.slice(0, 4));
  const scale = (year: number, v: number) =>
    real ? v / (1 + inf) ** Math.max(0, year - asOfYear) : v;
  return {
    title: "Annual cash flow — horizon",
    note: real ? "Today's dollars, annual" : "Future dollars, annual",
    labels: yearLabels(years),
    series: [
      {
        name: "Income",
        color: GREEN_LINE,
        values: years.map((y) => scale(y.year, y.income)),
        fill: true,
      },
      {
        name: "Spending",
        color: RED,
        values: years.map((y) => scale(y.year, y.spending)),
      },
      {
        name: "Contributions",
        color: BODY,
        values: years.map((y) => scale(y.year, y.contributions)),
      },
      {
        name: "Guaranteed",
        color: GOLD,
        values: years.map((y) => scale(y.year, y.guaranteed)),
      },
    ],
  };
}

function netWorthChart(plan: Plan, sim: SimResult): ChartSpec | null {
  const years = horizonYears(sim);
  if (years.length < 2) return null;
  const real = plan.assumptions.dollars === "real";
  return {
    title: "Net worth — horizon",
    note: real ? "Today's dollars · assets minus loans" : "Future dollars · assets minus loans",
    labels: yearLabels(years),
    series: [
      {
        name: "Assets",
        color: GREEN_MID,
        values: years.map((y) => (real ? y.endAssetsReal : y.endAssets)),
        fill: true,
      },
      {
        name: "Liabilities",
        color: RED,
        values: years.map((y) => (real ? y.endLiabilitiesReal : y.endLiabilities)),
      },
      {
        name: "Net worth",
        color: GREEN_DEEP,
        values: years.map((y) => (real ? y.endNetWorthReal : y.endNetWorth)),
      },
    ],
  };
}

function chartOps(chart: ChartSpec, yTop: number, contentWidth: number): string {
  const boxH = CHART_H - 10;
  const boxY = yTop - boxH + 8;
  const plotL = MARGIN_X + 46;
  const plotR = MARGIN_X + contentWidth - 10;
  const plotB = boxY + 28;
  const plotT = boxY + boxH - 28;
  const plotW = plotR - plotL;
  const plotH = plotT - plotB;
  const n = Math.max(chart.labels.length, 1);
  const allVals = chart.series.flatMap((s) => s.values);
  let min = Math.min(0, ...allVals);
  let max = Math.max(0, ...allVals);
  if (max <= min) max = min + 1;
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;
  const xAt = (i: number) => plotL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => plotB + ((v - min) / (max - min)) * plotH;

  const ops: string[] = [
    "q",
    `${SAGE_WASH} rg`,
    `${MARGIN_X} ${boxY} ${contentWidth} ${boxH} re f`,
    `${GREEN_LINE} rg`,
    `${MARGIN_X} ${boxY} 3 ${boxH} re f`,
    "Q",
    textOps("/F2", 11, GREEN_DEEP, MARGIN_X + 12, boxY + boxH - 16, chart.title),
    textOps("/F1", 8, MUTED, MARGIN_X + 12, boxY + boxH - 26, chart.note),
  ];

  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = min + ((max - min) * i) / ticks;
    const y = yAt(v);
    ops.push(`q 0.82 0.86 0.84 RG 0.4 w ${plotL.toFixed(1)} ${y.toFixed(1)} m ${plotR.toFixed(1)} ${y.toFixed(1)} l S Q`);
    ops.push(textOps("/F1", 7, MUTED, MARGIN_X + 10, y - 2, compactUsd(v)));
  }

  for (const s of chart.series) {
    if (s.values.length < 2) continue;
    const pts = s.values.map((v, i) => `${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`);
    if (s.fill) {
      const fillPath = [
        `${xAt(0).toFixed(1)} ${plotB.toFixed(1)} m`,
        ...s.values.map((v, i) => `${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)} l`),
        `${xAt(s.values.length - 1).toFixed(1)} ${plotB.toFixed(1)} l`,
        "h",
      ].join(" ");
      ops.push(`q 0.78 0.88 0.80 rg ${fillPath} f Q`);
    }
    const line = [`${pts[0]} m`, ...pts.slice(1).map((p) => `${p} l`)].join(" ");
    const dash = s.dash ? "[4 3] 0 d" : "[] 0 d";
    ops.push(`q ${s.color} RG 1.4 w ${dash} ${line} S Q`);
  }

  const tickIdx = n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1];
  const seen = new Set<number>();
  for (const i of tickIdx) {
    if (i < 0 || i >= n || seen.has(i)) continue;
    seen.add(i);
    ops.push(textOps("/F1", 7, MUTED, xAt(i) - 12, plotB - 12, chart.labels[i] ?? ""));
  }

  let lx = MARGIN_X + 12;
  const ly = boxY + 10;
  for (const s of chart.series) {
    ops.push(`q ${s.color} rg ${lx} ${ly} 8 3 re f Q`);
    ops.push(textOps("/F1", 7, BODY, lx + 11, ly, s.name));
    lx += 8 + 11 + s.name.length * 4.2 + 10;
  }

  return ops.join("\n");
}

function buildBlocks(
  brief: PeerBrief,
  plan: Plan,
  sim: SimResult,
  includeNetWorth: boolean,
): Block[] {
  const who = [plan.primary.name.trim(), plan.spouse.name.trim()].filter(Boolean).join(" & ");
  const blocks: Block[] = [
    { kind: "italic", text: OODA_DISCLAIMER },
    { kind: "space", h: 10 },
    { kind: "display", text: brief.headline, size: 16 },
    { kind: "space", h: 8 },
    {
      kind: "metric",
      label: "Spendable now",
      value: usd(startingSpendable(plan)),
    },
    {
      kind: "metric",
      label: "Net worth now",
      value: usd(startingNetWorth(plan)),
    },
    {
      kind: "metric",
      label: "Horizon",
      value:
        sim.depletedAge != null
          ? `Depletes at age ${sim.depletedAge} (${sim.depletedYear})`
          : `Funds through age ${plan.assumptions.projectionEndAge}`,
    },
    { kind: "space", h: 6 },
    { kind: "rule" },
    { kind: "space", h: 8 },
  ];
  const radar: Array<ChartSpec | null> = [wealthChart(plan, sim), cashChart(plan, sim)];
  if (includeNetWorth) radar.push(netWorthChart(plan, sim));
  const charts = radar.filter((c): c is ChartSpec => Boolean(c));
  if (charts.length) {
    blocks.push({ kind: "title", text: "Financial Radar — horizon" });
    blocks.push({
      kind: "muted",
      text: includeNetWorth
        ? "Spendable wealth, annual cash flow, and net worth across the full projection."
        : "Spendable wealth and annual cash flow across the full projection.",
    });
    blocks.push({ kind: "space", h: 4 });
    for (const chart of charts) {
      blocks.push({ kind: "chart", chart });
      blocks.push({ kind: "space", h: 8 });
    }
    blocks.push({ kind: "rule" });
    blocks.push({ kind: "space", h: 8 });
  }
  const sections = brief.sections?.length
    ? brief.sections
    : brief.paragraphs.map((body) => ({ title: "", body }));
  for (const s of sections) {
    if (s.title) blocks.push({ kind: "title", text: s.title });
    blocks.push({ kind: "body", text: s.body });
    blocks.push({ kind: "space", h: 8 });
  }
  if (who) {
    blocks.push({ kind: "muted", text: `Prepared for ${who}.` });
  }
  blocks.push({ kind: "space", h: 10 });
  blocks.push({ kind: "rule" });
  blocks.push({ kind: "space", h: 8 });
  blocks.push({ kind: "italic", text: OODA_DISCLAIMER });
  return blocks;
}

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function headerOps(
  pageIndex: number,
  logo: { drawW: number; drawH: number } | null,
  runAt: string,
): string {
  const y0 = PAGE_H - HEADER_H;
  const ops: string[] = [
    "q",
    `${NAVY} rg`,
    `0 ${y0} ${PAGE_W} ${HEADER_H} re f`,
    "Q",
  ];
  const textLeft = logo ? 54 + logo.drawW + 14 : 54;
  if (logo) {
    ops.push(
      "q",
      `${logo.drawW} 0 0 ${logo.drawH} 36 ${y0 + (HEADER_H - logo.drawH) / 2} cm`,
      "/Im1 Do",
      "Q",
    );
  } else {
    ops.push(
      "BT",
      "/F2 18 Tf",
      `${WHITE} rg`,
      `36 ${y0 + 58} Td`,
      "(MACH RUN) Tj",
      "ET",
    );
  }
  const continued = pageIndex > 0 ? " (continued)" : "";
  ops.push(
    "BT",
    "/F2 13 Tf",
    `${WHITE} rg`,
    `${textLeft} ${y0 + 62} Td`,
    `(${pdfEscape(`MACH OODA Financial Analysis${continued}`)}) Tj`,
    "/F1 9 Tf",
    `${SAGE} rg`,
    `0 -14 Td`,
    "(The Supersonic Financial Calculator) Tj",
    "/F1 8 Tf",
    `${SILVER} rg`,
    `0 -12 Td`,
    `(${pdfEscape(runAt ? `Run ${runAt}` : "MACH RUN.com")}) Tj`,
    "ET",
    "q",
    `${GOLD} rg`,
    `0 ${y0} ${PAGE_W} 3 re f`,
    `${GREEN_MID} rg`,
    `0 ${y0 - 6} ${PAGE_W} 6 re f`,
    "Q",
  );
  return ops.join("\n");
}

function footerOps(pageNo: number, pageCount: number): string {
  return [
    "q",
    `${GOLD} rg`,
    `0 ${FOOTER_H} ${PAGE_W} 2.5 re f`,
    `${NAVY} rg`,
    `0 0 ${PAGE_W} ${FOOTER_H} re f`,
    "Q",
    "BT",
    "/F1 8 Tf",
    `${SAGE} rg`,
    "54 16 Td",
    "(MACH RUN.com) Tj",
    "ET",
    "BT",
    "/F1 8 Tf",
    `${GOLD} rg`,
    "196 16 Td",
    "(For entertainment purposes only) Tj",
    "ET",
    "BT",
    "/F1 8 Tf",
    `${SILVER} rg`,
    "508 16 Td",
    `(Page ${pageNo} of ${pageCount}) Tj`,
    "ET",
  ].join("\n");
}

function textOps(
  font: string,
  size: number,
  color: string,
  x: number,
  y: number,
  line: string,
): string {
  return `BT ${font} ${size} Tf ${color} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfEscape(line)}) Tj ET`;
}

export async function downloadAnalysisPdf(
  brief: PeerBrief,
  plan: Plan,
  sim: SimResult,
  opts?: { includeNetWorth?: boolean },
): Promise<void> {
  const logoRaw = await loadLogo();
  let logoDraw: { drawW: number; drawH: number } | null = null;
  if (logoRaw) {
    const drawW = 168;
    const drawH = (logoRaw.h / logoRaw.w) * drawW;
    logoDraw = { drawW, drawH };
  }

  const blocks = buildBlocks(brief, plan, sim, Boolean(opts?.includeNetWorth));
  const contentWidth = PAGE_W - MARGIN_X * 2;
  const bodyChars = 92;
  const titleChars = 72;
  const italicChars = 98;

  type Line = { h: number; ops: (y: number) => string };
  const flow: Line[] = [];

  function pushLines(
    lines: string[],
    font: string,
    size: number,
    color: string,
    leading: number,
    gapAfter = 0,
  ) {
    lines.forEach((line, i) => {
      flow.push({
        h: leading + (i === lines.length - 1 ? gapAfter : 0),
        ops: (y) => textOps(font, size, color, MARGIN_X, y, line),
      });
    });
  }

  for (const b of blocks) {
    if (b.kind === "space") {
      flow.push({ h: b.h, ops: () => "" });
      continue;
    }
    if (b.kind === "rule") {
      flow.push({
        h: 12,
        ops: (y) =>
          [
            `q ${GOLD} rg ${MARGIN_X} ${y + 3} 22 2.5 re f`,
            `${GREEN_LINE} rg ${MARGIN_X + 26} ${y + 3.4} ${contentWidth - 26} 1.6 re f Q`,
          ].join(" "),
      });
      continue;
    }
    if (b.kind === "display") {
      pushLines(wrapText(b.text, titleChars), "/F2", b.size, GREEN_DEEP, b.size + 4, 4);
      continue;
    }
    if (b.kind === "title") {
      const title = b.text;
      flow.push({
        h: 18,
        ops: (y) =>
          [
            `q ${GOLD} rg ${MARGIN_X} ${y + 1} 6 6 re f Q`,
            textOps("/F2", 12, GREEN_MID, MARGIN_X + 12, y, title),
          ].join("\n"),
      });
      continue;
    }
    if (b.kind === "body") {
      pushLines(wrapText(b.text, bodyChars), "/F1", 10, BODY, 13, 2);
      continue;
    }
    if (b.kind === "muted") {
      pushLines(wrapText(b.text, bodyChars), "/F1", 9, GREEN_MID, 12, 2);
      continue;
    }
    if (b.kind === "italic") {
      const lines = wrapText(b.text, italicChars);
      lines.forEach((line, i) => {
        flow.push({
          h: 11 + (i === lines.length - 1 ? 2 : 0),
          ops: (y) =>
            [
              i === 0 ? `q ${GOLD} rg ${MARGIN_X - 8} ${y - 2} 2.2 12 re f Q` : "",
              textOps("/F3", 8, MUTED, MARGIN_X, y, line),
            ]
              .filter(Boolean)
              .join("\n"),
        });
      });
      continue;
    }
    if (b.kind === "metric") {
      const label = b.label.toUpperCase();
      flow.push({
        h: 20,
        ops: (y) =>
          [
            `q ${SAGE_WASH} rg ${MARGIN_X} ${y - 5} ${contentWidth} 18 re f`,
            `${GOLD} rg ${MARGIN_X} ${y - 5} 3 18 re f Q`,
            textOps("/F1", 8, GOLD_INK, MARGIN_X + 10, y, label),
            textOps("/F2", 11, GREEN_DEEP, MARGIN_X + 130, y, b.value),
          ].join("\n"),
      });
      continue;
    }
    if (b.kind === "chart") {
      const chart = b.chart;
      flow.push({
        h: CHART_H,
        ops: (y) => chartOps(chart, y, contentWidth),
      });
    }
  }

  const bodyTop = PAGE_H - HEADER_H - 28;
  const bodyBottom = FOOTER_H + 18;
  const pages: Line[][] = [];
  let cur: Line[] = [];
  let yUsed = 0;
  const usable = bodyTop - bodyBottom;
  for (const line of flow) {
    if (yUsed + line.h > usable && cur.length) {
      pages.push(cur);
      cur = [];
      yUsed = 0;
    }
    cur.push(line);
    yUsed += line.h;
  }
  if (cur.length) pages.push(cur);
  if (!pages.length) pages.push([]);

  const runAt = brief.runAt ?? "";
  const contentStreams: Uint8Array[] = pages.map((pageLines, pi) => {
    const cmds: string[] = [headerOps(pi, logoDraw, runAt)];
    let y = bodyTop;
    for (const line of pageLines) {
      const op = line.ops(y - 10);
      if (op) cmds.push(op);
      y -= line.h;
    }
    cmds.push(footerOps(pi + 1, pages.length));
    const stream = cmds.filter(Boolean).join("\n");
    return enc(stream);
  });

  const objs: Uint8Array[] = [];
  const addObj = (body: Uint8Array) => {
    objs.push(body);
    return objs.length;
  };

  addObj(enc("<< /Type /Catalog /Pages 2 0 R >>"));
  addObj(enc("<< /Type /Pages /Kids [] /Count 0 >>"));
  addObj(enc("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
  addObj(enc("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>"));
  addObj(enc("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>"));
  const f1 = 3;
  const f2 = 4;
  const f3 = 5;

  let imgId: number | null = null;
  if (logoRaw) {
    imgId = addObj(
      concat([
        enc(
          `<< /Type /XObject /Subtype /Image /Width ${logoRaw.w} /Height ${logoRaw.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoRaw.bytes.length} >>\nstream\n`,
        ),
        logoRaw.bytes,
        enc("\nendstream"),
      ]),
    );
  }

  const contentIds: number[] = [];
  for (const stream of contentStreams) {
    contentIds.push(
      addObj(
        concat([
          enc(`<< /Length ${stream.length} >>\nstream\n`),
          stream,
          enc("\nendstream"),
        ]),
      ),
    );
  }

  const pageIds: number[] = [];
  const xobj = imgId ? `/XObject << /Im1 ${imgId} 0 R >>` : "";
  const fonts = `/Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >>`;
  for (let i = 0; i < pages.length; i++) {
    pageIds.push(
      addObj(
        enc(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentIds[i]} 0 R /Resources << ${fonts} ${xobj} >> >>`,
        ),
      ),
    );
  }

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
  const xrefStart = pos;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(enc(xref));

  const pdf = concat(parts);
  const copy = new Uint8Array(pdf.byteLength);
  copy.set(pdf);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const who = plan.primary.name.trim().replace(/[^\w.-]+/g, "_") || "mach-run";
  a.download = `${who}-mach-ooda-analysis.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}