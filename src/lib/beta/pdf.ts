import {
  BETA_SECTIONS,
  betaPlanLabel,
  type BetaAnswers,
} from "./form";
import type { BetaExportRow } from "./export";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 54;
const HEADER_H = 96;
const FOOTER_H = 52;
const NAVY = "0.039 0.094 0.208";
const SILVER = "0.773 0.804 0.839";
const BODY = "0.102 0.141 0.220";
const MUTED = "0.290 0.349 0.420";
const WHITE = "1 1 1";
const GREEN_DEEP = "0.102 0.208 0.149";
const GREEN_MID = "0.141 0.337 0.227";
const GREEN_LINE = "0.290 0.533 0.376";
const SAGE = "0.616 0.729 0.604";
const GOLD = "0.910 0.773 0.278";

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

function pdfEscape(value: string): string {
  return value
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
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  });
}

function textOps(font: string, size: number, color: string, x: number, y: number, line: string): string {
  return `BT ${font} ${size} Tf ${color} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfEscape(line)}) Tj ET`;
}

function jpegSize(bytes: Uint8Array): { w: number; h: number } {
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + len;
  }
  return { w: 887, h: 271 };
}

async function loadLogo(): Promise<{ bytes: Uint8Array; w: number; h: number } | null> {
  try {
    const res = await fetch("/brand/mach-run-logo.jpg?v=23");
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, ...jpegSize(bytes) };
  } catch {
    return null;
  }
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function testedOn(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso || "—";
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

type Line = { h: number; ops: (y: number) => string };

function headerOps(
  pageIndex: number,
  logo: { drawW: number; drawH: number } | null,
  who: string,
): string {
  const y0 = PAGE_H - HEADER_H;
  const ops = ["q", `${NAVY} rg`, `0 ${y0} ${PAGE_W} ${HEADER_H} re f`, "Q"];
  const textLeft = logo ? 54 + logo.drawW + 14 : 54;
  if (logo) {
    ops.push("q", `${logo.drawW} 0 0 ${logo.drawH} 36 ${y0 + (HEADER_H - logo.drawH) / 2} cm`, "/Im1 Do", "Q");
  }
  const continued = pageIndex > 0 ? " (continued)" : "";
  ops.push(
    "BT",
    "/F2 13 Tf",
    `${WHITE} rg`,
    `${textLeft} ${y0 + 58} Td`,
    `(${pdfEscape(`Beta Testing Feedback${continued}`)}) Tj`,
    "/F1 9 Tf",
    `${SAGE} rg`,
    "0 -14 Td",
    "(The Supersonic Retirement Calculator) Tj",
    "/F1 8 Tf",
    `${SILVER} rg`,
    "0 -12 Td",
    `(${pdfEscape(who)}) Tj`,
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
    "BT /F1 8 Tf",
    `${SAGE} rg`,
    "54 28 Td",
    "(Beta feedback on the tool. Not a financial plan.) Tj",
    "ET",
    "BT /F1 8 Tf",
    `${SILVER} rg`,
    "54 14 Td",
    "(MACH RUN.com) Tj",
    "ET",
    "BT /F1 8 Tf",
    `${SILVER} rg`,
    "508 14 Td",
    `(Page ${pageNo} of ${pageCount}) Tj`,
    "ET",
  ].join("\n");
}

function pushText(flow: Line[], lines: string[], font: string, size: number, color: string, leading: number, gapAfter = 0, x = MARGIN_X) {
  lines.forEach((line, index) => {
    flow.push({
      h: leading + (index === lines.length - 1 ? gapAfter : 0),
      ops: (y) => textOps(font, size, color, x, y, line),
    });
  });
}

function answerBlock(flow: Line[], text: string) {
  const body = text.trim();
  if (!body) {
    pushText(flow, ["No write-up."], "/F3", 10, MUTED, 14, 10, MARGIN_X + 12);
    return;
  }
  const lines = wrapText(body, 88);
  lines.forEach((line, index) => {
    const last = index === lines.length - 1;
    flow.push({
      h: 14 + (last ? 12 : 0),
      ops: (y) =>
        [
          `q ${GREEN_LINE} rg ${MARGIN_X} ${y - 2} 2.5 12 re f Q`,
          textOps("/F1", 11, BODY, MARGIN_X + 12, y, line),
        ].join("\n"),
    });
  });
}

function buildFlow(answers: BetaAnswers, row: BetaExportRow): Line[] {
  const flow: Line[] = [];
  const facts = [
    ["Tester", answers.name.trim() || row.name || "—"],
    ["Email", answers.email || row.email || "—"],
    ["Date of testing", testedOn(answers.testedOn)],
    ["Device", answers.device.trim() || "—"],
    ["Plan", betaPlanLabel(answers.plan) || "—"],
    ["Pass", String(row.pass)],
    ["Submitted", `${when(row.submittedAt)} UTC`],
  ];
  for (const [label, value] of facts) {
    const lines = wrapText(value, 62);
    lines.forEach((line, index) => {
      flow.push({
        h: 16,
        ops: (y) =>
          [
            index === 0 ? textOps("/F2", 10, GREEN_MID, MARGIN_X, y, label) : "",
            textOps("/F1", 11, BODY, MARGIN_X + 118, y, line),
          ]
            .filter(Boolean)
            .join("\n"),
      });
    });
  }
  flow.push({ h: 8, ops: () => "" });
  flow.push({
    h: 16,
    ops: (y) =>
      `q ${GOLD} rg ${MARGIN_X} ${y + 4} 22 2.5 re f ${GREEN_LINE} rg ${MARGIN_X + 26} ${y + 4.4} ${PAGE_W - MARGIN_X * 2 - 26} 1.6 re f Q`,
  });

  for (const section of BETA_SECTIONS) {
    const answer = answers.sections[section.key];
    if (section.phase) {
      pushText(flow, [section.phase.toUpperCase()], "/F1", 8, MUTED, 12, 2);
    }
    flow.push({
      h: 22,
      ops: (y) =>
        [
          `q ${GOLD} rg ${MARGIN_X} ${y + 1} 6 6 re f Q`,
          textOps("/F2", 13, GREEN_DEEP, MARGIN_X + 14, y, section.title),
        ].join("\n"),
    });
    if (answer?.notes.trim()) answerBlock(flow, answer.notes);
    section.prompts.forEach((prompt, index) => {
      pushText(flow, wrapText(prompt, 92), "/F3", 10, MUTED, 13, 3);
      answerBlock(flow, answer?.replies[index] ?? "");
    });
  }

  pushText(flow, ["THANK-YOU GIFT"], "/F1", 8, MUTED, 12, 2);
  flow.push({
    h: 22,
    ops: (y) =>
      [
        `q ${GOLD} rg ${MARGIN_X} ${y + 1} 6 6 re f Q`,
        textOps("/F2", 13, GREEN_DEEP, MARGIN_X + 14, y, "Mailing address"),
      ].join("\n"),
  });
  const hat = answers.hat;
  const address = [
    hat.decline ? "Please do not send a hat." : "",
    hat.fullName,
    hat.line1,
    hat.line2,
    [hat.city, hat.state, hat.zip].filter(Boolean).join(", "),
    hat.country,
    hat.notes ? `Delivery notes: ${hat.notes}` : "",
  ].filter((line) => line.trim());
  answerBlock(flow, address.join("\n") || "No address.");
  return flow;
}

export async function downloadBetaPdf(row: BetaExportRow): Promise<void> {
  const logoRaw = await loadLogo();
  const logoDraw = logoRaw
    ? { drawW: 150, drawH: (logoRaw.h / logoRaw.w) * 150 }
    : null;
  const flow = buildFlow(row.answers, row);
  const bodyTop = PAGE_H - HEADER_H - 28;
  const bodyBottom = FOOTER_H + 16;
  const usable = bodyTop - bodyBottom;
  const pages: Line[][] = [];
  let current: Line[] = [];
  let used = 0;
  for (const line of flow) {
    if (used + line.h > usable && current.length) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(line);
    used += line.h;
  }
  if (current.length) pages.push(current);
  if (!pages.length) pages.push([]);

  const who = `${row.name.trim() || row.answers.name.trim() || "Beta tester"} · pass ${row.pass}`.slice(0, 64);
  const streams = pages.map((page, index) => {
    const cmds = [headerOps(index, logoDraw, who)];
    let y = bodyTop;
    for (const line of page) {
      const op = line.ops(y - 11);
      if (op) cmds.push(op);
      y -= line.h;
    }
    cmds.push(footerOps(index + 1, pages.length));
    return enc(cmds.filter(Boolean).join("\n"));
  });

  const objs: Uint8Array[] = [];
  const add = (body: Uint8Array) => {
    objs.push(body);
    return objs.length;
  };
  add(enc("<< /Type /Catalog /Pages 2 0 R >>"));
  add(enc("<< /Type /Pages /Kids [] /Count 0 >>"));
  add(enc("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
  add(enc("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>"));
  add(enc("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>"));

  let imageId: number | null = null;
  if (logoRaw) {
    imageId = add(
      concat([
        enc(
          `<< /Type /XObject /Subtype /Image /Width ${logoRaw.w} /Height ${logoRaw.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoRaw.bytes.length} >>\nstream\n`,
        ),
        logoRaw.bytes,
        enc("\nendstream"),
      ]),
    );
  }

  const contentIds = streams.map((stream) =>
    add(concat([enc(`<< /Length ${stream.length} >>\nstream\n`), stream, enc("\nendstream")])),
  );
  const pageIds: number[] = [];
  const xobj = imageId ? `/XObject << /Im1 ${imageId} 0 R >>` : "";
  const fonts = "/Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>";
  contentIds.forEach((id) => {
    pageIds.push(
      add(
        enc(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${id} 0 R /Resources << ${fonts} ${xobj} >> >>`,
        ),
      ),
    );
  });
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
  for (let i = 1; i <= objs.length; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`;
  parts.push(enc(xref));
  const pdf = concat(parts);
  const copy = new Uint8Array(pdf.byteLength);
  copy.set(pdf);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const slug = (row.name || row.email || "debrief").toLowerCase().replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "");
  link.download = `mach-run-beta-${slug || "debrief"}-pass-${row.pass}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
