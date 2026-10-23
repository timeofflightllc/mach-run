import { getSql } from "@/lib/db";
import { resolvePayTables } from "./catalog.ts";
import type { PayTable } from "./formula.ts";
import { OFFICIAL_SEED } from "./official-seed.ts";

async function ensureTable(): Promise<void> {
  const sql = await getSql();
  await sql.query(`
    create table if not exists mach_basic_pay (
      year integer primary key,
      rates jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
}

function asTable(year: unknown, rates: unknown): PayTable | null {
  const effectiveYear = Number(year);
  if (!Number.isInteger(effectiveYear)) return null;
  const parsed = typeof rates === "string" ? (JSON.parse(rates) as unknown) : rates;
  if (!parsed || typeof parsed !== "object") return null;
  return { effectiveYear, rates: parsed as PayTable["rates"] };
}

export async function listUploadedTables(): Promise<PayTable[]> {
  await ensureTable();
  const sql = await getSql();
  const rows = await sql.query<{ year: number | string; rates: unknown }>(
    `select year, rates from mach_basic_pay order by year`,
  );
  return rows.flatMap((row) => {
    const table = asTable(row.year, row.rates);
    return table ? [table] : [];
  });
}

/** Newest official table. Never calls DFAS. */
export async function readQuizTable(): Promise<PayTable | null> {
  const tables = await readQuizTables();
  return tables.at(-1) ?? null;
}

/** Every official year on file. Never calls DFAS. */
export async function readQuizTables(): Promise<PayTable[]> {
  try {
    return resolvePayTables(OFFICIAL_SEED, await listUploadedTables());
  } catch {
    return resolvePayTables(OFFICIAL_SEED, []);
  }
}

export async function saveUploadedTable(table: PayTable): Promise<void> {
  await ensureTable();
  const sql = await getSql();
  await sql.query(
    `insert into mach_basic_pay (year, rates, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (year) do update set rates = excluded.rates, updated_at = now()`,
    [table.effectiveYear, JSON.stringify(table.rates)],
  );
}
