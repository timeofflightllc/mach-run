import type { Plan, SimResult } from "./types";
import type { SurvivalScore } from "./monte-carlo-run";

/** Same windows as the on-screen span chips. 5 means the as-of year through five years later. */
export type ChartSpan = 5 | 10 | 20 | "horizon";
export type ChartPdfChoice = "spendable" | "cash" | "net" | "monte";
export type ChartOrientation = "portrait" | "landscape";

export type ChartPicture = {
  id: ChartPdfChoice;
  jpeg: Uint8Array;
};

const FOOTER = "Illustration only. Not financial advice.";
const GREEN_DEEP = "0.102 0.208 0.149";
const MUTED = "0.290 0.349 0.420";

const TITLES: Record<ChartPdfChoice, string> = {
  spendable: "Spendable Wealth",
  cash: "Cash Flow",
  net: "Net Worth",
  monte: "Monte Carlo Plan Survival",
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

/** Pixel size of the off-screen chart. The PDF scales that picture into the page. */
export function chartCaptureSize(orientation: ChartOrientation): { width: number; height: number } {
  return orientation === "landscape" ? { width: 1400, height: 860 } : { width: 1100, height: 640 };
}

function spanLabel(span: ChartSpan): string {
  if (span === "horizon") return "Horizon";
  return `${span}-Year`;
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

function pageSize(orientation: ChartOrientation): { w: number; h: number } {
  return orientation === "landscape" ? { w: 792, h: 612 } : { w: 612, h: 792 };
}

function pageSlots(
  orientation: ChartOrientation,
  count: number,
): { left: number; bottom: number; width: number; height: number }[] {
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
  const low = { left: margin, bottom: footer + 8, width, height: slotH };
  return count === 1 ? [top] : [top, low];
}

function drawPicture(
  chart: { title: string; note: string },
  imageName: string,
  jpeg: Uint8Array,
  left: number,
  bottom: number,
  width: number,
  height: number,
): string {
  const { w, h } = jpegSize(jpeg);
  const titleY = bottom + height - 16;
  const plotTop = titleY - 18;
  const plotH = Math.max(10, plotTop - bottom);
  const scale = Math.min(width / w, plotH / h);
  const dw = w * scale;
  const dh = h * scale;
  const x = left + (width - dw) / 2;
  const y = bottom + (plotH - dh) / 2;
  return [
    textOp("/F2", 13, GREEN_DEEP, left, titleY, chart.title),
    textOp("/F1", 9, MUTED, left, titleY - 12, chart.note),
    `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${imageName} Do Q`,
  ].join("\n");
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

export function buildChartPdf(input: {
  plan: Plan;
  sim: Pick<SimResult, "years">;
  span: ChartSpan;
  orientation: ChartOrientation;
  charts: ChartPdfChoice[];
  pictures: ChartPicture[];
  survival?: Pick<SurvivalScore, "score" | "survived" | "paths" | "runOutAge" | "bands"> | null;
}): Uint8Array | null {
  if (!input.sim.years.length || !input.charts.length) return null;
  const note = `${dollarLabel(input.plan)} - ${spanLabel(input.span)}`;
  const pages: { title: string; note: string; image: number }[][] = [];
  const pictures = input.charts.flatMap((id) => {
    const picture = input.pictures.find((item) => item.id === id);
    if (!picture || picture.jpeg.length < 4) return [];
    if (id !== "monte" && chartYears(input.plan.assumptions.asOfDate, input.sim.years, input.span).length < 2) {
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
  const streams = pages.map((page, index) => {
    const slots = pageSlots(input.orientation, page.length);
    const ops = page.map((chart, slot) =>
      drawPicture(
        chart,
        `Im${chart.image + 1}`,
        pictures[chart.image].jpeg,
        slots[slot].left,
        slots[slot].bottom,
        slots[slot].width,
        slots[slot].height,
      ),
    );
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
  const imageIds = pictures.map((picture) => add(jpegObject(picture.jpeg)));
  const contentIds = streams.map((stream) =>
    add(concat([enc(`<< /Length ${stream.length} >>\nstream\n`), stream, enc("\nendstream")])),
  );
  const xobjects = imageIds.map((id, index) => `/Im${index + 1} ${id} 0 R`).join(" ");
  const pageIds = contentIds.map((id) =>
    add(
      enc(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents ${id} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xobjects} >> >> >>`,
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
