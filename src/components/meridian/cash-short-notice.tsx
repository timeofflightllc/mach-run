import { cashShortYears } from "@/lib/plan/cash-short";
import { cashAdvisoryStillOpen } from "@/components/meridian/advisory-note";
import { usd } from "@/lib/plan/format";
import type { Plan, SimResult } from "@/lib/plan/types";

export function CashShortNotice({ sim, plan }: { sim: SimResult; plan: Plan }) {
  const rows = cashShortYears(sim);
  if (!rows.length || !cashAdvisoryStillOpen(plan)) return null;
  const missed = rows.reduce((sum, row) => sum + row.missed, 0);
  return (
    <div className="rounded-xl bg-[#f3f0e8] px-4 py-3 text-sm leading-relaxed text-[#1a2330]">
      <p className="font-semibold text-[#1a2330]">
        MACH RUN did not invest the full contribution.
      </p>
      <p className="mt-1">
        You asked to invest {usd(missed)} more than income minus taxes minus
        spending. MACH RUN invested only what was left. It will not take money
        out of your accounts to finish a contribution. Typing a bigger
        contribution does not create the cash.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-[#3d4a54]">
              <th className="py-1 pr-3 font-medium">Year</th>
              <th className="py-1 pr-3 text-right font-medium">You asked to invest</th>
              <th className="py-1 pr-3 text-right font-medium">Leftover after tax and spending</th>
              <th className="py-1 text-right font-medium">Not invested</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-t border-[#d5d0c6]">
                <td className="py-1 pr-3 tabular-nums">{row.year}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{usd(row.asked, true)}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{usd(row.left, true)}</td>
                <td className="py-1 text-right tabular-nums">{usd(row.missed, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3">
        Fix it in Income, Spending, or Contributions so the amount you ask to
        invest fits in what is left. Then hit Calculate.
      </p>
    </div>
  );
}
