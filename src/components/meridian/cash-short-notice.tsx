import { cashShortYears } from "@/lib/plan/cash-short";
import { usd } from "@/lib/plan/format";
import type { SimResult } from "@/lib/plan/types";

export function CashShortNotice({ sim }: { sim: SimResult }) {
  const rows = cashShortYears(sim);
  if (!rows.length) return null;
  const missed = rows.reduce((sum, row) => sum + row.missed, 0);
  return (
    <div
      className="rounded-lg px-4 py-3 text-sm leading-relaxed text-fg"
      style={{
        background: "color-mix(in oklab, #e8c547 12%, transparent)",
        boxShadow: "0 0 0 1px color-mix(in oklab, #e8c547 45%, transparent)",
      }}
    >
      <p className="font-semibold text-[#e8c547]">
        MACH RUN did not invest the full contribution.
      </p>
      <p className="mt-1">
        You asked to invest {usd(missed)} more than the paycheck had left after
        tax and spending. MACH RUN invested only what was left. It will not take
        money out of your accounts to finish a contribution. Typing a bigger
        contribution does not create the cash.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-[#e8c547]">
              <th className="py-1 pr-3 font-medium">Year</th>
              <th className="py-1 pr-3 text-right font-medium">You asked to invest</th>
              <th className="py-1 pr-3 text-right font-medium">Left after tax and spending</th>
              <th className="py-1 text-right font-medium">Not invested</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-t border-[#e8c547]/25">
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
