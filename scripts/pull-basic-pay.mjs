/**
 * One-time pull of official DFAS basic-pay HTML from the Internet Archive.
 * Writes src/lib/retired-pay/official/YYYY.json. The quiz does not call this.
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { combineBasicPayPages } from "../src/lib/retired-pay/parse.ts";

const curl = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/lib/retired-pay/official");

const PAGES = {
  CO: "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/CO/",
  CO_FE: "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/CO_FE/",
  WO: "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/WO/",
  EM: "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/EM/",
};

const CHECK_2026 = {
  "E-1": [0, 2407.2],
  "E-7": [20, 6245.7],
  "O-5": [0, 7295.4],
  "W-2": [20, 7437],
};

async function curlText(url) {
  const { stdout } = await curl(
    "curl",
    ["-fsSL", "--compressed", "--retry", "2", "--max-time", "70", "-A", "Mozilla/5.0", url],
    { maxBuffer: 20 * 1024 * 1024, encoding: "utf8" },
  );
  return stdout;
}

async function cdx(url) {
  const api =
    "https://web.archive.org/cdx/search/cdx?url=" +
    encodeURIComponent(url) +
    "&output=json&fl=timestamp,statuscode,original&filter=statuscode:200";
  const rows = JSON.parse(await curlText(api));
  return rows.slice(1).map((row) => ({ timestamp: row[0], original: row[2] }));
}

function pickByCrawlYear(captures) {
  const byYear = new Map();
  for (const row of captures) {
    const year = row.timestamp.slice(0, 4);
    const month = Number(row.timestamp.slice(4, 6));
    const current = byYear.get(year);
    if (!current) {
      byYear.set(year, row);
      continue;
    }
    const currentMonth = Number(current.timestamp.slice(4, 6));
    const preferNew =
      (month >= 2 && currentMonth < 2) ||
      ((month >= 2) === (currentMonth >= 2) && row.timestamp > current.timestamp);
    if (preferNew) byYear.set(year, row);
  }
  return [...byYear.values()];
}

async function download(capture) {
  const url = `https://web.archive.org/web/${capture.timestamp}/${capture.original}`;
  try {
    const text = await curlText(url);
    return /Effective\s+January\s+1,\s*\d{4}/i.test(text) ? text : null;
  } catch {
    return null;
  }
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

const selected = {};
for (const [key, url] of Object.entries(PAGES)) {
  selected[key] = pickByCrawlYear(await cdx(url));
  console.log(key, selected[key].map((row) => row.timestamp).join(" "));
}

const jobs = [];
for (const key of Object.keys(PAGES)) {
  for (const capture of selected[key]) jobs.push({ key, capture });
}

const html = { CO: new Map(), CO_FE: new Map(), WO: new Map(), EM: new Map() };
await pool(jobs, 3, async (job) => {
  const text = await download(job.capture);
  const year = job.capture.timestamp.slice(0, 4);
  console.log(job.key, year, text ? `ok ${text.length}` : "miss");
  if (text) html[job.key].set(year, text);
});

const crawlYears = [...new Set(Object.values(html).flatMap((map) => [...map.keys()]))].sort();
const landed = [];
const skipped = [
  "Before 2020: the four official HTML pages are not in the archive together. 2019 has officer and enlisted HTML only, so that year is skipped. PDF-only years are skipped.",
];
await mkdir(OUT, { recursive: true });

for (const crawlYear of crawlYears) {
  const pages = ["CO", "CO_FE", "WO", "EM"].map((key) => html[key].get(crawlYear) ?? null);
  if (pages.some((page) => page == null)) {
    skipped.push(`${crawlYear} crawl: a page was missing or unreadable.`);
    continue;
  }
  const table = combineBasicPayPages(pages);
  if (!table) {
    skipped.push(`${crawlYear} crawl: the parser rejected the four pages.`);
    continue;
  }
  await writeFile(join(OUT, `${table.effectiveYear}.json`), JSON.stringify(table));
  landed.push(`${table.effectiveYear} from the ${crawlYear} crawl.`);
  console.log("wrote", table.effectiveYear, Object.keys(table.rates).length);
}

const table2026 = JSON.parse(await readFile(join(OUT, "2026.json"), "utf8"));
for (const [grade, [step, expected]] of Object.entries(CHECK_2026)) {
  const got = table2026.rates[grade]?.[String(step)] ?? table2026.rates[grade]?.[step];
  if (got !== expected) {
    console.error(`2026 check failed ${grade} step ${step}: ${got} !== ${expected}`);
    process.exit(1);
  }
}

const note = [
  "Official DFAS basic-pay tables.",
  "Parsed from Internet Archive snapshots of the four DFAS pages. No retyped chart.",
  "",
  "Landed",
  ...landed.map((line) => `- ${line}`),
  "",
  "Skipped",
  ...skipped.map((line) => `- ${line}`),
  "",
  "2026 check: E-1 at 2 or less is 2407.20, E-7 over 20 is 6245.70, O-5 at 2 or less is 7295.40, W-2 over 20 is 7437.00.",
  "",
].join("\n");
await writeFile(join(OUT, "YEARS.md"), note);
console.log(note);
