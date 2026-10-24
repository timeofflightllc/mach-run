import type { PayTable } from "./formula.ts";
import historical from "./official/historical.json" with { type: "json" };
import y2019 from "./official/2019.json" with { type: "json" };
import y2020 from "./official/2020.json" with { type: "json" };
import y2023 from "./official/2023.json" with { type: "json" };
import y2024 from "./official/2024.json" with { type: "json" };
import y2025 from "./official/2025.json" with { type: "json" };
import y2026 from "./official/2026.json" with { type: "json" };

function asTable(raw: {
  effectiveYear: number;
  effectiveMonth?: number;
  rates: PayTable["rates"];
}): PayTable {
  return {
    effectiveYear: raw.effectiveYear,
    effectiveMonth: raw.effectiveMonth,
    rates: raw.rates,
  };
}

function start(table: PayTable): number {
  return table.effectiveYear * 12 + (table.effectiveMonth ?? 1);
}

/** Official DFAS scales. A desk upload for the same year replaces every scale in that year. */
export const OFFICIAL_SEED: PayTable[] = [
  ...(historical as unknown as PayTable[]),
  asTable(y2019),
  asTable(y2020),
  asTable(y2023),
  asTable(y2024),
  asTable(y2025),
  asTable(y2026),
].sort((a, b) => start(a) - start(b));
