import { usd } from "@/lib/plan/format";
import type { Plan, SimResult, YearCap } from "@/lib/plan/types";

function capCopy(cap: YearCap): { label: string; tone: string; title: string } {
  if (cap.kind === "cash") {
    const short = Math.max(0, cap.planned - cap.funded);
    return {
      label: "cash",
      tone: "text-negative",
      title: `${cap.year} — planned ${usd(cap.planned)}. Leftover after tax and spending: ${usd(cap.leftover)}. MACH RUN invested ${usd(cap.funded)}. Short ${usd(short)}. It will not invent cash.`,
    };
  }
  if (cap.kind === "irs") {
    return {
      label: "irs",
      tone: "text-[#e8c547]",
      title: `${cap.year} — IRS annual limit cut ${usd(cap.irsCut)} from planned contributions because “cap to IRS limit” is on. Employee deferral stopped at the legal max. Employer match is extra and is not part of that limit.`,
    };
  }
  return {
    label: "match",
    tone: "text-positive",
    title: `${cap.year} — employer match of ${usd(cap.employerMatch)} is free money on top of take-home, not from leftover paycheck. MACH RUN adds it only on the employee dollars it actually invested.`,
  };
}

export function YearTable({ plan, sim }: { plan: Plan; sim: SimResult }) {
  const real = plan.assumptions.dollars === "real";
  const inf = plan.assumptions.inflationPct / 100;
  const asOfYear = Number(plan.assumptions.asOfDate.slice(0, 4));
  const capsByYear = new Map<number, YearCap[]>();
  for (const cap of sim.yearCaps ?? []) {
    const list = capsByYear.get(cap.year) ?? [];
    list.push(cap);
    capsByYear.set(cap.year, list);
  }

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
      "irsCut",
      "employerMatch",
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
        (y.irsCut ?? 0).toFixed(2),
        (y.employerMatch ?? 0).toFixed(2),
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
    <div className="overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
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
          . MACH RUN invested only the leftover. Hover or tap CASH / IRS / MATCH
          next to a year for that year’s reason.
        </p>
      ) : (
        <p className="border-t border-border px-4 py-3 text-xs text-subtle">
          Identity: income + drawn = tax + spend + saved. Saved is leftover
          paycheck after tax and spending, including the surplus sweep. Hover or
          tap CASH / IRS / MATCH when a year is marked.
        </p>
      )}
      <div className="overflow-x-auto pb-2">
        <table className="w-max min-w-full text-left text-sm">
          <thead className="border-y border-border text-xs uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-4 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Age</th>
              <th className="px-3 py-2 font-medium">Income</th>
              <th className="px-3 py-2 font-medium">Tax</th>
              <th className="px-3 py-2 font-medium">Spend</th>
              <th className="px-3 py-2 font-medium">Saved</th>
              <th className="px-3 py-2 font-medium">Drawn</th>
              <th className="px-3 py-2 pr-5 font-medium">Spendable</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {sim.years.map((y) => (
              <tr
                key={y.year}
                className="border-b border-border/70 last:border-0"
              >
                <td className="whitespace-nowrap px-4 py-2 text-fg">
                  {y.year}
                  {(capsByYear.get(y.year) ?? []).map((cap) => {
                    const copy = capCopy(cap);
                    return (
                      <button
                        key={cap.kind}
                        type="button"
                        title={copy.title}
                        className={`ml-1 cursor-help text-xs uppercase tracking-wider underline decoration-dotted underline-offset-2 ${copy.tone}`}
                      >
                        {copy.label}
                      </button>
                    );
                  })}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted">
                  {plan.primary.birthDate ? y.primaryAge : "—"}/
                  {plan.spouse.birthDate ? y.spouseAge : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-fg">
                  {usd(flow(y.income, y.year))}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted">
                  {usd(flow(y.tax, y.year))}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-fg">
                  {usd(flow(y.spending, y.year))}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-positive">
                  {usd(flow(y.contributions, y.year))}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-negative">
                  {usd(flow(y.withdrawals, y.year))}
                </td>
                <td className="whitespace-nowrap px-3 py-2 pr-5 text-fg">
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
