import type { SimResult } from "./types.ts";

export interface CashShortYear {
  year: number;
  asked: number;
  left: number;
  missed: number;
}

/** Years where the contribution request is bigger than income − tax − spending. */
export function cashShortYears(sim: SimResult): CashShortYear[] {
  const rows: CashShortYear[] = [];
  for (const cap of sim.yearCaps ?? []) {
    if (cap.kind !== "cash") continue;
    const asked = Math.max(0, cap.planned - cap.employerMatch);
    const left = Math.max(0, cap.leftover);
    const missed = Math.max(0, asked - left);
    if (missed <= 1) continue;
    rows.push({ year: cap.year, asked, left, missed });
  }
  return rows;
}
