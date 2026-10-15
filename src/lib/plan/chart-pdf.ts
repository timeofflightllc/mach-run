import type { Plan, SimResult } from "./types";
import type { SurvivalScore } from "./monte-carlo-run";

/** Same windows as the on-screen span chips. 5 means the as-of year through five years later. */
export type ChartSpan = 5 | 10 | 20 | "horizon" | "goal";
export type ChartPdfChoice = "spendable" | "cash" | "net" | "monte";
export type ChartOrientation = "portrait" | "landscape";

export type ChartPicture = {
  id: ChartPdfChoice;
  jpeg: Uint8Array;
};

export type ChartLogo = {
  bytes: Uint8Array;
  w: number;
  h: number;
};

const FOOTER_NOTE =
  "For information purposes only - consult a fiduciary before you make any financial decisions.";
const NAVY = "0.039 0.094 0.208";
const SILVER = "0.773 0.804 0.839";
const SAGE = "0.616 0.729 0.604";
const GOLD = "0.910 0.773 0.278";
const GREEN_MID = "0.141 0.337 0.227";
const GREEN_DEEP = "0.102 0.208 0.149";
const MUTED = "0.290 0.349 0.420";
const WHITE = "1 1 1";

const TITLES: Record<ChartPdfChoice, string> = {
  spendable: "Spendable Wealth",
  cash: "Cash Flow",
  net: "Net Worth",
  monte: "Monte Carlo Plan Survival",
};

/** Last calendar year of a goal chart. Null when the date is missing or invalid. Not past the last simulated year. */
export function chartGoalEnd(
  goalDate: string | null | undefined,
  years: readonly { year: number }[],
): number | null {
  if (!goalDate || !/^\d{4}-\d{2}-\d{2}$/.test(goalDate)) return null;
  const year = Number(goalDate.slice(0, 4));
  const month = Number(goalDate.slice(5, 7));
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  if (!years.length) return year;
  return Math.min(year, years[years.length - 1].year);
}

/** Copy of yearsInView. Do not tighten the end year. */
export function chartYears<T extends { year: number }>(
  asOfDate: string,
  years: readonly T[],
  span: ChartSpan,
  goalDate?: string | null,
): T[] {
  if (span === "horizon") return [...years];
  if (span === "goal") {
    const end = chartGoalEnd(goalDate, years);
    if (end == null) return [];
    const startYear = Number(asOfDate.slice(0, 4));
    return years.filter((year) => year.year >= startYear && year.year <= end);
  }
  const startYear = Number(asOfDate.slice(0, 4));
  const sliced = years.filter((year) => year.year >= startYear && year.year <= startYear + span);
  return sliced.length ? sliced : [...years];
}

/** Pixel size of the off-screen chart. The PDF scales that picture into the page. */
export function chartCaptureSize(orientation: ChartOrientation): { width: number; height: number } {
  return orientation === "landscape" ? { width: 1400, height: 860 } : { width: 1100, height: 640 };
}

function spanLabel(span: ChartSpan, endAge: number): string {
  if (span === "horizon") return `Horizon to age ${endAge}`;
  if (span === "goal") return "To goal";
  return `${span}-Year`;
}

function household(plan: Plan): string {
  const who = [plan.primary.name.trim(), plan.spouse.name.trim()].filter(Boolean).join(" & ");
  if (!who) return "";
  return who.length > 48 ? `${who.slice(0, 47)}...` : who;
}

function chrome(orientation: ChartOrientation) {
  return orientation === "landscape"
    ? { header: 74, footer: 50, marginX: 28, gap: 0 }
    : { header: 96, footer: 54, marginX: 32, gap: 16 };
}

function dollarLabel(plan: Plan): string {
  return plan.assumptions.dollars === "real" ? "Today's dollars" : "Future dollars";
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

function textOp(font: string, size: number, color: string, x: number, y: number, line: string): string {
  return `BT ${font} ${size} Tf ${color} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfEscape(line)}) Tj ET`;
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
    if (len < 2) break;
    i += 2 + len;
  }
  return { w: 1, h: 1 };
}

function resolvedLogo(logo: ChartLogo | null | undefined): ChartLogo | null {
  if (!logo || logo.bytes.length < 4) return null;
  const size = jpegSize(logo.bytes);
  const w = size.w > 1 ? size.w : logo.w;
  const h = size.h > 1 ? size.h : logo.h;
  if (w < 2 || h < 2) return null;
  return { bytes: logo.bytes, w, h };
}

function pageSize(orientation: ChartOrientation): { w: number; h: number } {
  return orientation === "landscape" ? { w: 792, h: 612 } : { w: 612, h: 792 };
}

function pageSlots(
  orientation: ChartOrientation,
  count: number,
): { left: number; bottom: number; width: number; height: number }[] {
  const { w, h } = pageSize(orientation);
  const box = chrome(orientation);
  const left = box.marginX;
  const width = w - box.marginX * 2;
  const top = h - box.header - 14;
  const bottom = box.footer + 14;
  const inner = top - bottom;
  if (orientation === "landscape" || count < 2) {
    return [{ left, bottom, width, height: inner }];
  }
  const slotH = (inner - box.gap) / 2;
  return [
    { left, bottom: bottom + slotH + box.gap, width, height: slotH },
    { left, bottom, width, height: slotH },
  ];
}

function logoBox(logo: ChartLogo | null | undefined, headerH: number, orientation: ChartOrientation) {
  if (!logo || logo.w < 2 || logo.h < 2) return null;
  const maxH = headerH - 20;
  const maxW = orientation === "landscape" ? 132 : 156;
  const scale = Math.min(maxW / logo.w, maxH / logo.h);
  return { drawW: logo.w * scale, drawH: logo.h * scale };
}

function headerOps(
  orientation: ChartOrientation,
  pageIndex: number,
  logo: { drawW: number; drawH: number } | null,
  meta: string,
): string {
  const { w, h } = pageSize(orientation);
  const headerH = chrome(orientation).header;
  const y0 = h - headerH;
  const textLeft = logo ? 28 + logo.drawW + 14 : 32;
  const title = pageIndex > 0 ? "MACH RUN Charts (continued)" : "MACH RUN Charts";
  const titleSize = orientation === "landscape" ? 13 : 15;
  const titleY = y0 + (orientation === "landscape" ? 44 : 58);
  const ops = [
    "q",
    `${NAVY} rg`,
    `0 ${y0} ${w} ${headerH} re f`,
    "Q",
  ];
  if (logo) {
    ops.push(
      "q",
      `${logo.drawW.toFixed(2)} 0 0 ${logo.drawH.toFixed(2)} 28 ${(y0 + (headerH - logo.drawH) / 2).toFixed(2)} cm`,
      "/ImLogo Do",
      "Q",
    );
  }
  ops.push(
    textOp("/F2", titleSize, WHITE, textLeft, titleY, title),
    textOp("/F1", 9, SAGE, textLeft, titleY - 14, "The Supersonic Retirement Calculator"),
    textOp("/F1", 8, SILVER, textLeft, titleY - 26, meta),
    "q",
    `${GOLD} rg`,
    `0 ${y0} ${w} 3 re f`,
    `${GREEN_MID} rg`,
    `0 ${y0 - 6} ${w} 6 re f`,
    "Q",
  );
  return ops.join("\n");
}

function drawPicture(
  chart: { title: string; note: string },
  imageName: string,
  jpeg: Uint8Array,
  left: number,
  bottom: number,
  width: number,
  height: number,
  titleFace: { font: string; size: number },
): string {
  const { w, h } = jpegSize(jpeg);
  const titleY = bottom + height - titleFace.size - 2;
  const noteY = titleY - 12;
  const plotTop = noteY - 8;
  const plotH = Math.max(10, plotTop - bottom);
  const scale = Math.min(width / w, plotH / h);
  const dw = w * scale;
  const dh = h * scale;
  const x = left + (width - dw) / 2;
  const y = plotTop - dh;
  return [
    textOp(titleFace.font, titleFace.size, GREEN_DEEP, left, titleY, chart.title),
    textOp("/F1", 9, MUTED, left, noteY, chart.note),
    `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${imageName} Do Q`,
  ].join("\n");
}

function footerOp(width: number, pageNo: number, pageCount: number, footerH: number): string {
  const label = `Page ${pageNo} of ${pageCount}`;
  const pageX = Math.max(360, width - 28 - label.length * 4.4);
  return [
    "q",
    `${GOLD} rg`,
    `0 ${footerH} ${width} 2.5 re f`,
    `${NAVY} rg`,
    `0 0 ${width} ${footerH} re f`,
    "Q",
    textOp("/F1", 8, GOLD, 28, 32, FOOTER_NOTE),
    textOp("/F1", 8, SAGE, 28, 14, "MACH RUN.com"),
    textOp("/F1", 8, SILVER, pageX, 14, label),
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

function jpegObject(bytes: Uint8Array): Uint8Array {
  const { w, h } = jpegSize(bytes);
  return concat([
    enc(
      `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`,
    ),
    bytes,
    enc("\nendstream"),
  ]);
}

type TitleFont = {
  bytes: Uint8Array;
  name: string;
  bbox: number[];
  ascent: number;
  descent: number;
  capHeight: number;
  widths: number[];
};

function ttfView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function ttfTables(bytes: Uint8Array): Map<string, { offset: number; length: number }> {
  const view = ttfView(bytes);
  const count = view.getUint16(4);
  const tables = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
    tables.set(tag, { offset: view.getUint32(at + 8), length: view.getUint32(at + 12) });
  }
  return tables;
}

function ttfName(bytes: Uint8Array, tables: Map<string, { offset: number; length: number }>): string {
  const table = tables.get("name");
  if (!table) return "BebasNeue-Regular";
  const view = ttfView(bytes);
  const count = view.getUint16(table.offset + 2);
  const storage = table.offset + view.getUint16(table.offset + 4);
  for (let i = 0; i < count; i++) {
    const at = table.offset + 6 + i * 12;
    const platform = view.getUint16(at);
    if (view.getUint16(at + 6) !== 6) continue;
    const length = view.getUint16(at + 8);
    const start = storage + view.getUint16(at + 10);
    let text = "";
    if (platform === 3 || platform === 0) {
      for (let j = 0; j + 1 < length; j += 2) text += String.fromCharCode(view.getUint16(start + j));
    } else {
      for (let j = 0; j < length; j++) text += String.fromCharCode(bytes[start + j]);
    }
    const clean = text.replace(/[^A-Za-z0-9-]/g, "");
    if (clean) return clean;
  }
  return "BebasNeue-Regular";
}

function ttfGlyph(view: DataView, cmap: number, code: number): number {
  const segCount = view.getUint16(cmap + 6) / 2;
  const endAt = cmap + 14;
  const startAt = endAt + segCount * 2 + 2;
  const deltaAt = startAt + segCount * 2;
  const rangeAt = deltaAt + segCount * 2;
  for (let i = 0; i < segCount; i++) {
    const end = view.getUint16(endAt + i * 2);
    if (code > end) continue;
    const start = view.getUint16(startAt + i * 2);
    if (code < start) return 0;
    const delta = view.getInt16(deltaAt + i * 2);
    const range = view.getUint16(rangeAt + i * 2);
    if (range === 0) return (code + delta) & 0xffff;
    const glyph = view.getUint16(rangeAt + i * 2 + range + (code - start) * 2);
    return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
  }
  return 0;
}

/** Bebas Neue, the MACH RUN wordmark face. Null when the file is not a usable TrueType. */
function readTitleFont(bytes: Uint8Array | null | undefined): TitleFont | null {
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] !== 0 || bytes[1] !== 1 || bytes[2] !== 0 || bytes[3] !== 0) return null;
  const tables = ttfTables(bytes);
  const head = tables.get("head");
  const hhea = tables.get("hhea");
  const hmtx = tables.get("hmtx");
  const cmap = tables.get("cmap");
  if (!head || !hhea || !hmtx || !cmap) return null;
  const view = ttfView(bytes);
  const units = view.getUint16(head.offset + 18) || 1000;
  const scale = (n: number) => Math.round((n * 1000) / units);
  const encCount = view.getUint16(cmap.offset + 2);
  let format4 = 0;
  for (let i = 0; i < encCount; i++) {
    const platform = view.getUint16(cmap.offset + 4 + i * 8);
    const encoding = view.getUint16(cmap.offset + 6 + i * 8);
    if (platform === 3 && encoding === 1) format4 = cmap.offset + view.getUint32(cmap.offset + 8 + i * 8);
  }
  if (!format4 || view.getUint16(format4) !== 4) return null;
  const metrics = view.getUint16(hhea.offset + 34);
  const advance = (glyph: number) => {
    const index = Math.min(glyph, Math.max(0, metrics - 1));
    return view.getUint16(hmtx.offset + index * 4);
  };
  const widths = Array.from({ length: 95 }, (_, i) => scale(advance(ttfGlyph(view, format4, 32 + i))));
  const os2 = tables.get("OS/2");
  const ascent = view.getInt16(hhea.offset + 4);
  const cap =
    os2 && os2.length >= 90 && view.getUint16(os2.offset) >= 2 ? view.getInt16(os2.offset + 88) : ascent;
  return {
    bytes,
    name: ttfName(bytes, tables),
    bbox: [
      scale(view.getInt16(head.offset + 36)),
      scale(view.getInt16(head.offset + 38)),
      scale(view.getInt16(head.offset + 40)),
      scale(view.getInt16(head.offset + 42)),
    ],
    ascent: scale(ascent),
    descent: scale(view.getInt16(hhea.offset + 6)),
    capHeight: scale(cap),
    widths,
  };
}

function fontFileObject(bytes: Uint8Array): Uint8Array {
  return concat([
    enc(`<< /Length ${bytes.length} /Length1 ${bytes.length} >>\nstream\n`),
    bytes,
    enc("\nendstream"),
  ]);
}

export function buildChartPdf(input: {
  plan: Plan;
  sim: Pick<SimResult, "years">;
  span: ChartSpan;
  orientation: ChartOrientation;
  charts: ChartPdfChoice[];
  pictures: ChartPicture[];
  logo?: ChartLogo | null;
  /** Bebas Neue file. Chart titles use it. Header and footer stay Helvetica. */
  titleFont?: Uint8Array | null;
  survival?: Pick<SurvivalScore, "score" | "survived" | "paths" | "runOutAge" | "bands"> | null;
}): Uint8Array | null {
  if (!input.sim.years.length || !input.charts.length) return null;
  const who = household(input.plan);
  const lens = `${dollarLabel(input.plan)} | ${spanLabel(input.span, input.plan.assumptions.projectionEndAge)}`;
  const meta = who ? `${who} | ${lens}` : lens;
  const note = lens;
  const pages: { title: string; note: string; image: number }[][] = [];
  const pictures = input.charts.flatMap((id) => {
    const picture = input.pictures.find((item) => item.id === id);
    if (!picture || picture.jpeg.length < 4) return [];
    if (
      id !== "monte" &&
      input.span !== "goal" &&
      chartYears(input.plan.assumptions.asOfDate, input.sim.years, input.span, input.plan.assumptions.retirementGoalDate).length < 2
    ) {
      return [];
    }
    return [{ id, jpeg: picture.jpeg, title: TITLES[id], note }];
  });
  if (!pictures.length) return null;
  const perPage = input.orientation === "landscape" ? 1 : 2;
  for (let i = 0; i < pictures.length; i += perPage) {
    pages.push(
      pictures.slice(i, i + perPage).map((picture, offset) => ({
        title: picture.title,
        note: picture.note,
        image: i + offset,
      })),
    );
  }
  const { w, h } = pageSize(input.orientation);
  const logo = resolvedLogo(input.logo);
  const mark = logoBox(logo, chrome(input.orientation).header, input.orientation);
  const footerH = chrome(input.orientation).footer;
  const embedded = readTitleFont(input.titleFont);
  const titleFace = embedded ? { font: "/F3", size: 20 } : { font: "/F2", size: 13 };
  const streams = pages.map((page, index) => {
    const slots = pageSlots(input.orientation, page.length);
    const ops = [
      headerOps(input.orientation, index, mark, meta),
      ...page.map((chart, slot) =>
        drawPicture(
          chart,
          `Im${chart.image + 1}`,
          pictures[chart.image].jpeg,
          slots[slot].left,
          slots[slot].bottom,
          slots[slot].width,
          slots[slot].height,
          titleFace,
        ),
      ),
      footerOp(w, index + 1, pages.length, footerH),
    ];
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
  let titleFontId = 0;
  if (embedded) {
    const fileId = add(fontFileObject(embedded.bytes));
    const widthsId = add(enc(`[ ${embedded.widths.join(" ")} ]`));
    const descId = add(
      enc(
        `<< /Type /FontDescriptor /FontName /${embedded.name} /Flags 32 /FontBBox [${embedded.bbox.join(" ")}] /ItalicAngle 0 /Ascent ${embedded.ascent} /Descent ${embedded.descent} /CapHeight ${embedded.capHeight} /StemV 80 /FontFile2 ${fileId} 0 R >>`,
      ),
    );
    titleFontId = add(
      enc(
        `<< /Type /Font /Subtype /TrueType /BaseFont /${embedded.name} /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 126 /Widths ${widthsId} 0 R /FontDescriptor ${descId} 0 R >>`,
      ),
    );
  }
  const logoId = logo && mark ? add(jpegObject(logo.bytes)) : 0;
  const imageIds = pictures.map((picture) => add(jpegObject(picture.jpeg)));
  const contentIds = streams.map((stream) =>
    add(concat([enc(`<< /Length ${stream.length} >>\nstream\n`), stream, enc("\nendstream")])),
  );
  const xobjects = [
    logoId ? `/ImLogo ${logoId} 0 R` : "",
    ...imageIds.map((id, index) => `/Im${index + 1} ${id} 0 R`),
  ]
    .filter(Boolean)
    .join(" ");
  const pageIds = contentIds.map((id) =>
    add(
      enc(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents ${id} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R${titleFontId ? ` /F3 ${titleFontId} 0 R` : ""} >> /XObject << ${xobjects} >> >> >>`,
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

async function loadLogo(): Promise<ChartLogo | null> {
  if (typeof fetch === "undefined") return null;
  try {
    const res = await fetch("/brand/mach-run-logo.jpg?v=23");
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { w, h } = jpegSize(bytes);
    if (w < 2 || h < 2 || bytes.length < 4) return null;
    return { bytes, w, h };
  } catch {
    return null;
  }
}

async function loadTitleFont(): Promise<Uint8Array | null> {
  if (typeof fetch === "undefined") return null;
  try {
    const res = await fetch("/brand/BebasNeue-Regular.ttf");
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return readTitleFont(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

export async function downloadChartPdf(input: Parameters<typeof buildChartPdf>[0]): Promise<boolean> {
  const bytes = buildChartPdf({
    ...input,
    logo: input.logo ?? (await loadLogo()),
    titleFont: input.titleFont ?? (await loadTitleFont()),
  });
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
