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
  return lines.length ? lines : [""];
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
    const res = await fetch("/brand/mach-run-logo.jpg?v=12");
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { w, h } = jpegSize(bytes);
    return { bytes, w, h };
  } catch {
    return null;
  }
}

type Block =
  | { kind: "space"; h: number }
  | { kind: "rule" }
  | { kind: "display"; text: string; size: number }
  | { kind: "title"; text: string }
  | { kind: "body"; text: string }
  | { kind: "muted"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "metric"; label: string; value: string };

function buildBlocks(brief: PeerBrief, plan: Plan, sim: SimResult): Block[] {
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
    `${SILVER} rg`,
    `0 -14 Td`,
    "(The Supersonic Financial Calculator) Tj",
    "/F1 8 Tf",
    `0 -12 Td`,
    `(${pdfEscape(runAt ? `Run ${runAt}` : "MACH RUN.com")}) Tj`,
    "ET",
    "q",
    `${SILVER} RG`,
    "1.25 w",
    `0 ${y0} m ${PAGE_W} ${y0} l S`,
    "Q",
  );
  return ops.join("\n");
}

function footerOps(pageNo: number, pageCount: number): string {
  return [
    "q",
    `${NAVY} rg`,
    `0 0 ${PAGE_W} ${FOOTER_H} re f`,
    "Q",
    "BT",
    "/F1 8 Tf",
    `${SILVER} rg`,
    "54 16 Td",
    "(MACH RUN.com) Tj",
    "ET",
    "BT",
    "/F1 8 Tf",
    `${SILVER} rg`,
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
): Promise<void> {
  const logoRaw = await loadLogo();
  let logoDraw: { drawW: number; drawH: number } | null = null;
  if (logoRaw) {
    const drawW = 168;
    const drawH = (logoRaw.h / logoRaw.w) * drawW;
    logoDraw = { drawW, drawH };
  }

  const blocks = buildBlocks(brief, plan, sim);
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
        h: 10,
        ops: (y) =>
          `q ${NAVY} RG 0.6 w ${MARGIN_X} ${y + 4} m ${MARGIN_X + contentWidth} ${y + 4} l S Q`,
      });
      continue;
    }
    if (b.kind === "display") {
      pushLines(wrapText(b.text, titleChars), "/F2", b.size, NAVY, b.size + 4, 4);
      continue;
    }
    if (b.kind === "title") {
      pushLines([b.text], "/F2", 12, NAVY, 16, 2);
      continue;
    }
    if (b.kind === "body") {
      pushLines(wrapText(b.text, bodyChars), "/F1", 10, BODY, 13, 2);
      continue;
    }
    if (b.kind === "muted") {
      pushLines(wrapText(b.text, bodyChars), "/F1", 9, MUTED, 12, 2);
      continue;
    }
    if (b.kind === "italic") {
      pushLines(wrapText(b.text, italicChars), "/F3", 8, MUTED, 11, 2);
      continue;
    }
    if (b.kind === "metric") {
      const label = b.label.toUpperCase();
      flow.push({
        h: 16,
        ops: (y) =>
          [
            textOps("/F1", 8, MUTED, MARGIN_X, y, label),
            textOps("/F2", 11, NAVY, MARGIN_X + 130, y, b.value),
          ].join("\n"),
      });
    }
  }

  const bodyTop = PAGE_H - HEADER_H - 22;
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
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const who = plan.primary.name.trim().replace(/[^\w.-]+/g, "_") || "mach-run";
  a.download = `${who}-mach-ooda-analysis.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}