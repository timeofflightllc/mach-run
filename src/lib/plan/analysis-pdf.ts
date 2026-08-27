import type { PeerBrief } from "./peers";
import type { Plan, SimResult } from "./types";
import { usd } from "./format";
import { OODA_DISCLAIMER } from "./disclaimer";
import { startingNetWorth, startingSpendable } from "./engine";

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

function wrapLine(text: string, max = 88): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function buildLines(brief: PeerBrief, plan: Plan, sim: SimResult): string[] {
  const lines: string[] = [
    "MACH  Measure / Allocate / Compound / Harvest",
    "MACH OODA Financial Analysis*",
    brief.runAt ? `Run ${brief.runAt}` : "",
    "",
    ...wrapLine(OODA_DISCLAIMER),
    "",
    brief.headline,
    "",
  ];
  const blocks = brief.sections?.length
    ? brief.sections
    : brief.paragraphs.map((body) => ({ title: "", body }));
  for (const s of blocks) {
    if (s.title) {
      lines.push(s.title);
      lines.push(...wrapLine(s.body));
    } else {
      lines.push(...wrapLine(s.body));
    }
    lines.push("");
  }
  lines.push(
    `Spendable now: ${usd(startingSpendable(plan))}`,
    `Net worth now: ${usd(startingNetWorth(plan))}`,
    sim.depletedAge != null
      ? `Depletes at age ${sim.depletedAge} (${sim.depletedYear})`
      : `Funds through age ${plan.assumptions.projectionEndAge}`,
    "",
    "* MACH OODA AI analysis is for entertainment purposes only.",
    "It is not financial, tax, legal, or investment advice.",
    "Past performance does not guarantee future returns.",
    "",
    ...wrapLine(OODA_DISCLAIMER),
  );
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === ""));
}

export function downloadAnalysisPdf(brief: PeerBrief, plan: Plan, sim: SimResult) {
  const lines = buildLines(brief, plan, sim);
  const pageW = 612;
  const pageH = 792;
  const margin = 64;
  const leading = 14;
  const perPage = Math.floor((pageH - margin * 2) / leading);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) {
    pages.push(lines.slice(i, i + perPage));
  }

  const objs: string[] = [];
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageIds: number[] = [];
  const fontId = 3;
  objs.push(""); // placeholder pages
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const contentIds: number[] = [];
  for (const page of pages) {
    const cmds = ["BT", "/F1 11 Tf", `${margin} ${pageH - margin} Td`];
    page.forEach((line, i) => {
      if (i > 0) cmds.push(`0 -${leading} Td`);
      cmds.push(`(${pdfEscape(line)}) Tj`);
    });
    cmds.push("ET");
    const stream = cmds.join("\n");
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    contentIds.push(objs.length);
  }

  for (let i = 0; i < pages.length; i++) {
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentIds[i]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    pageIds.push(objs.length);
  }

  objs[1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objs.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mach-ooda-analysis.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
