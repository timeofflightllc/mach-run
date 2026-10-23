import { combineBasicPayPages, parseBasicPayPage } from "./parse.ts";
import type { PayTable } from "./formula.ts";

export const PAY_PAGES = [
  ["officers", "Officers"],
  ["prior", "Prior enlisted"],
  ["warrant", "Warrant"],
  ["enlisted", "Enlisted"],
] as const;

export type PayPageId = (typeof PAY_PAGES)[number][0];

/** Grades the quiz can ask for. A page set that lacks one is not saved. */
export const REQUIRED_GRADES = [
  ...Array.from({ length: 9 }, (_, i) => `E-${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `W-${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `O-${i + 1}`),
  "O-1E",
  "O-2E",
  "O-3E",
];

const MAX_HTML = 1_000_000;

export type PayUpload =
  | { ok: true; table: PayTable; spot: number }
  | { ok: false; error: string };

export type PayFiles = Record<PayPageId, string>;

/** Read four official DFAS pages. Nothing is saved here. */
export function parsePayUpload(files: PayFiles): PayUpload {
  const html: string[] = [];
  for (const [id, label] of PAY_PAGES) {
    const page = files[id] ?? "";
    if (page.length > MAX_HTML) return { ok: false, error: `${label} is too large.` };
    if (!page.trim()) return { ok: false, error: `${label} is missing.` };
    if (!parseBasicPayPage(page)) return { ok: false, error: `${label} is not an official basic-pay page.` };
    html.push(page);
  }
  const table = combineBasicPayPages(html);
  if (!table) return { ok: false, error: "The four pages are not one year." };
  const missing = REQUIRED_GRADES.find((grade) => {
    const row = table.rates[grade];
    return !row || Object.keys(row).length === 0;
  });
  if (missing) return { ok: false, error: `Missing ${missing}.` };
  const spot = table.rates["E-7"]?.[20];
  if (spot == null) return { ok: false, error: "Enlisted has no E-7 over-20 rate." };
  return { ok: true, table, spot };
}

/** A rejected upload leaves the stored years alone. */
export function commitUpload(existing: PayTable[], upload: PayUpload): PayTable[] {
  if (!upload.ok) return existing;
  return [
    ...existing.filter((table) => table.effectiveYear !== upload.table.effectiveYear),
    upload.table,
  ];
}

/** Newest year. An uploaded year replaces the seed for that same year. */
export function resolvePayTable(seed: PayTable[], uploaded: PayTable[]): PayTable | null {
  const years = resolvePayTables(seed, uploaded);
  return years.at(-1) ?? null;
}

/** Every stored year, oldest first. An uploaded year replaces the seed for that same year. */
export function resolvePayTables(seed: PayTable[], uploaded: PayTable[]): PayTable[] {
  const byYear = new Map<number, PayTable>();
  for (const table of seed) byYear.set(table.effectiveYear, table);
  for (const table of uploaded) byYear.set(table.effectiveYear, table);
  return [...byYear.values()].sort((a, b) => a.effectiveYear - b.effectiveYear);
}

export type PayYearRow = {
  year: number;
  source: "seed" | "uploaded";
  inUse: boolean;
};

export function listPayYears(seed: PayTable[], uploaded: PayTable[]): PayYearRow[] {
  const uploadedYears = new Set(uploaded.map((table) => table.effectiveYear));
  const inUse = resolvePayTable(seed, uploaded)?.effectiveYear ?? null;
  const years = new Set<number>([...seed.map((table) => table.effectiveYear), ...uploadedYears]);
  return [...years]
    .sort((a, b) => b - a)
    .map((year) => ({
      year,
      source: uploadedYears.has(year) ? "uploaded" : "seed",
      inUse: year === inUse,
    }));
}
