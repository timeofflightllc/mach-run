import { usd } from "@/lib/plan/format";
import type { Plan, SimResult } from "@/lib/plan/types";

export function YearTable({ plan, sim }: { plan: Plan; sim: SimResult }) {
  const real = plan.assumptions.dollars === "real";
  const inf = plan.assumptions.inflationPct / 100;
  const asOfYear = Number(plan.assumptions.asOfDate.slice(0, 4));
  const gapYears = new Set(sim.fundingGaps.map((g) => g.year));

  function flow(amount: number, year: number) {
    if (!real) return amount;
    const yearsOut = year - asOfYear;
    return amount / (1 + inf) ** Math.max(0, yearsOut);
  }

  function download() {
    const header = [
      "year",
      "primaryAge",
      "spouseAge",
      "income",
      "tax",
      "spending",
      "contributions",
      "plannedContributions",
      "withdrawals",
      "surplus",
      "guaranteed",
      "endSpendable",
      "endSpendableReal",
      "endNetWorth",
    ];
    const rows = sim.years.map((y) =>
      [
        y.year,
        y.primaryAge,
        y.spouseAge,
        y.income.toFixed(2),
        y.tax.toFixed(2),
        y.spending.toFixed(2),
        y.contributions.toFixed(2),
        y.plannedContributions.toFixed(2),
        y.withdrawals.toFixed(2),
        y.surplus.toFixed(2),
        y.guaranteed.toFixed(2),
        y.endSpendable.toFixed(2),
        y.endSpendableReal.toFixed(2),
        y.endNetWorth.toFixed(2),
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mach-projection.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="font-display text-lg font-medium text-fg">Year ledger</h2>
        <button
          type="button"
          onClick={download}
          className="h-11 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
        >
          Download CSV
        </button>
      </div>
      {sim.fundingGaps.length ? (
        <p className="border-t border-border px-4 py-3 text-sm text-muted">
          Planned contributions exceed leftover cash after tax and spending in{" "}
          {sim.fundingGaps.slice(0, 6).map((g) => g.year).join(", ")}
          {sim.fundingGaps.length > 6
            ? ` (+${sim.fundingGaps.length - 6} more)`
            : ""}
          . MACH invested only the leftover. Cut contribution rules or spending,
          or raise income — the ledger will not create money.
        </p>
      ) : (
        <p className="border-t border-border px-4 py-3 text-xs text-subtle">
          Identity: income + drawn = tax + spend + saved. Saved is leftover
          paycheck after tax and spending, including the surplus sweep.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-y border-border text-xs uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-4 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Age</th>
              <th className="px-3 py-2 font-medium">Income</th>
              <th className="px-3 py-2 font-medium">Tax</th>
              <th className="px-3 py-2 font-medium">Spend</th>
              <th className="px-3 py-2 font-medium">Saved</th>
              <th className="px-3 py-2 font-medium">Drawn</th>
              <th className="px-3 py-2 font-medium">Spendable</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {sim.years.map((y) => (
              <tr
                key={y.year}
                className="border-b border-border/70 last:border-0"
              >
                <td className="px-4 py-2 text-fg">
                  {y.year}
                  {gapYears.has(y.year) ? (
                    <span className="ml-1 text-xs uppercase tracking-wider text-negative">
                      capped
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted">
                  {plan.primary.birthDate ? y.primaryAge : "—"}/
                  {plan.spouse.birthDate ? y.spouseAge : "—"}
                </td>
                <td className="px-3 py-2 text-fg">{usd(flow(y.income, y.year))}</td>
                <td className="px-3 py-2 text-muted">{usd(flow(y.tax, y.year))}</td>
                <td className="px-3 py-2 text-fg">{usd(flow(y.spending, y.year))}</td>
                <td className="px-3 py-2 text-positive">
                  {usd(flow(y.contributions, y.year))}
                </td>
                <td className="px-3 py-2 text-negative">
                  {usd(flow(y.withdrawals, y.year))}
                </td>
                <td className="px-3 py-2 text-fg">
                  {usd(real ? y.endSpendableReal : y.endSpendable)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
