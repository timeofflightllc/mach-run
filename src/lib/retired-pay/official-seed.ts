import type { PayTable } from "./formula.ts";
import y2019 from "./official/2019.json" with { type: "json" };
import y2020 from "./official/2020.json" with { type: "json" };
import y2023 from "./official/2023.json" with { type: "json" };
import y2024 from "./official/2024.json" with { type: "json" };
import y2025 from "./official/2025.json" with { type: "json" };
import y2026 from "./official/2026.json" with { type: "json" };

function asTable(raw: { effectiveYear: number; rates: PayTable["rates"] }): PayTable {
  return { effectiveYear: raw.effectiveYear, rates: raw.rates };
}

/** Official pages already pulled. A desk upload for the same year wins. */
export const OFFICIAL_SEED: PayTable[] = [
  asTable(y2019),
  asTable(y2020),
  asTable(y2023),
  asTable(y2024),
  asTable(y2025),
  asTable(y2026),
];
