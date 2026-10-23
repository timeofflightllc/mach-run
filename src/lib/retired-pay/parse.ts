import { LONGEVITY_STEPS, type PayTable } from "./formula.ts";

const GRADE = /\b([EWO])-(\d{1,2})(E)?\b/;

function cellText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function money(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function stepFromHeader(header: string): number | null {
  if (/2\s*or\s*less/i.test(header)) return 0;
  const over = /over\s*(\d+)/i.exec(header);
  if (!over) return null;
  const step = Number(over[1]);
  return (LONGEVITY_STEPS as readonly number[]).includes(step) ? step : null;
}

function rowsOf(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const pattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tableHtml))) {
    const cells: string[] = [];
    const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cell: RegExpExecArray | null;
    while ((cell = cellPattern.exec(match[1]))) cells.push(cellText(cell[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/** Read one DFAS basic-pay page. Returns null when the heading or the grid is missing. */
export function parseBasicPayPage(html: string): PayTable | null {
  const source = html.replace(/&nbsp;|&#160;/gi, " ");
  const heading = /Effective\s+(?:January|April)\s+1,\s*(\d{4})/i.exec(source);
  if (!heading) return null;
  const effectiveYear = Number(heading[1]);
  const rates: PayTable["rates"] = {};
  const tables = source.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? [];
  for (const tableHtml of tables) {
    let steps: Array<number | null> | null = null;
    for (const cells of rowsOf(tableHtml)) {
      const headerSteps = cells.map(stepFromHeader);
      if (headerSteps.some((step) => step != null)) {
        steps = headerSteps;
        continue;
      }
      if (!steps) continue;
      const gradeMatch = GRADE.exec(cells[0] ?? "");
      if (!gradeMatch) continue;
      const grade = `${gradeMatch[1]}-${gradeMatch[2]}${gradeMatch[3] ?? ""}`;
      const row = rates[grade] ?? {};
      cells.forEach((value, index) => {
        const step = steps?.[index];
        if (step == null) return;
        const amount = money(value);
        if (amount == null) return;
        row[step] = amount;
      });
      if (Object.keys(row).length) rates[grade] = row;
    }
  }
  if (Object.keys(rates).length === 0) return null;
  return { effectiveYear, rates };
}

/** Four pages, one year. A mismatch or a miss returns null. */
export function combineBasicPayPages(pages: string[]): PayTable | null {
  const parsed = pages.map(parseBasicPayPage);
  if (parsed.some((page) => page == null)) return null;
  const tables = parsed as PayTable[];
  const year = tables[0].effectiveYear;
  if (tables.some((page) => page.effectiveYear !== year)) return null;
  const rates: PayTable["rates"] = {};
  for (const page of tables) {
    for (const [grade, row] of Object.entries(page.rates)) {
      rates[grade] = { ...rates[grade], ...row };
    }
  }
  return { effectiveYear: year, rates };
}
