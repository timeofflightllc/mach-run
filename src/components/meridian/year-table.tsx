import { useState } from "react";
import { usd } from "@/lib/plan/format";
import type { Plan, SimResult, YearCap } from "@/lib/plan/types";

const KIND_LABEL: Record<string, string> = {
  salary: "Salary / wages",
  bonus: "Bonus",
  allowance: "Allowance",
  pension: "Pension",
  military: "Military retired pay",
  va: "VA disability",
  ss: "Social Security",
  other: "Other income",
  other_retirement: "Other retirement",
  rmd: "Required minimum distribution",
  employer_match: "Employer match",
};

function capReasons(caps: YearCap[]): string[] {
  const lines: string[] = [];
  for (const cap of caps) {
    if (cap.kind === "cash") {
      const short = Math.max(0, cap.planned - cap.funded);
      lines.push(
        `Cash: planned ${usd(cap.planned)}, leftover after tax and spending ${usd(cap.leftover)}. MACH RUN invested ${usd(cap.funded)}. Short ${usd(short)} — it will not invent cash.`,
      );
    } else if (cap.kind === "irs") {
      lines.push(
        `IRS: the annual limit cut ${usd(cap.irsCut)} because “cap to IRS limit” is on. Employee deferral stopped at the legal max.`,
      );
    } else if (cap.kind === "match") {
      lines.push(
        `Match: employer added ${usd(cap.employerMatch)} on top of take-home, only on the employee dollars MACH RUN actually invested.`,
      );
    }
  }
  return lines;
}

function isCapped(caps: YearCap[]): boolean {
  return caps.some((c) => c.kind === "cash" || c.kind === "irs");
}

function incomeLines(
  byKind: Record<string, number> | undefined,
  scale: (n: number) => number,
): { label: string; amount: number }[] {
  const rows: { label: string; amount: number }[] = [];
  for (const [kind, raw] of Object.entries(byKind ?? {})) {
    if (raw <= 0.5) continue;
    rows.push({
      label: KIND_LABEL[kind] ?? kind.replace(/_/g, " "),
      amount: scale(raw),
    });
  }
  rows.sort((a, b) => b.amount - a.amount);
  return rows;
}

type LedgerTip = {
  year: number;
  x: number;
  y: number;
  mode: "cap" | "income";
};

function tipPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
  const pad = 14;
  const width = 320;
  const height = 200;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  if (x + width > window.innerWidth - 8) x = e.clientX - width - pad;
  if (y + height > window.innerHeight - 8) y = e.clientY - height - pad;
  return { x: Math.max(8, x), y: Math.max(8, y) };
}

export function YearTable({ plan, sim }: { plan: Plan; sim: SimResult }) {
  const real = plan.assumptions.dollars === "real";
  const inf = plan.assumptions.inflationPct / 100;
  const asOfYear = Number(plan.assumptions.asOfDate.slice(0, 4));
  const [tip, setTip] = useState<LedgerTip | null>(null);
  const capsByYear = new Map<number, YearCap[]>();
  for (const cap of sim.yearCaps ?? []) {
    const list = capsByYear.get(cap.year) ?? [];
    list.push(cap);
    capsByYear.set(cap.year, list);
  }
  const yearRow = tip ? sim.years.find((y) => y.year === tip.year) : undefined;

  function showTip(
    year: number,
    mode: LedgerTip["mode"],
    e: { clientX: number; clientY: number },
  ) {
    const pt = tipPoint(e);
    setTip({ year, mode, ...pt });
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

  const capLines = tip?.mode === "cap" ? capReasons(capsByYear.get(tip.year) ?? []) : [];
  const payLines =
    tip?.mode === "income" && yearRow
      ? incomeLines(yearRow.incomeByKind, (n) => flow(n, yearRow.year))
      : [];

  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="font-display text-xl font-bold text-fg">Yearly Ledger</h2>
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
          Hover <span className="font-bold text-negative">CAPPED</span> for why
          that year was cut. Hover an income amount for the paycheck mix.
        </p>
      ) : (
        <p className="border-t border-border px-4 py-3 text-xs text-subtle">
          Identity: income + drawn = tax + spend + saved. Hover an income amount
          for the mix. Hover{" "}
          <span className="font-bold text-negative">CAPPED</span> when a year is
          marked.
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
            {sim.years.map((y) => {
              const caps = capsByYear.get(y.year) ?? [];
              const capped = isCapped(caps);
              return (
                <tr
                  key={y.year}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="whitespace-nowrap px-4 py-2 text-fg">
                    {y.year}
                    {capped ? (
                      <button
                        type="button"
                        onMouseEnter={(e) => showTip(y.year, "cap", e)}
                        onMouseMove={(e) => showTip(y.year, "cap", e)}
                        onMouseLeave={() => setTip(null)}
                        onFocus={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          showTip(y.year, "cap", {
                            clientX: r.right,
                            clientY: r.top,
                          });
                        }}
                        onBlur={() => setTip(null)}
                        onClick={(e) => {
                          e.preventDefault();
                          if (tip?.year === y.year && tip.mode === "cap") {
                            setTip(null);
                          } else {
                            showTip(y.year, "cap", e);
                          }
                        }}
                        className="ml-1.5 text-xs font-bold uppercase tracking-wider text-negative underline decoration-dotted underline-offset-2"
                      >
                        CAPPED
                      </button>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">
                    {plan.primary.birthDate ? y.primaryAge : "—"}/
                    {plan.spouse.birthDate ? y.spouseAge : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      onMouseEnter={(e) => showTip(y.year, "income", e)}
                      onMouseMove={(e) => showTip(y.year, "income", e)}
                      onMouseLeave={() => setTip(null)}
                      onFocus={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        showTip(y.year, "income", {
                          clientX: r.right,
                          clientY: r.top,
                        });
                      }}
                      onBlur={() => setTip(null)}
                      className="cursor-help text-fg underline decoration-dotted underline-offset-2"
                    >
                      {usd(flow(y.income, y.year))}
                    </button>
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
              );
            })}
          </tbody>
        </table>
      </div>
      {tip?.mode === "cap" && capLines.length ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[80] w-80 max-w-[calc(100vw-16px)] rounded-lg border border-border bg-elevated px-3 py-2.5 text-left shadow-lg"
          style={{ left: tip.x, top: tip.y }}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-negative">
            {tip.year} capped
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-snug text-fg">
            {capLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {tip?.mode === "income" ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[80] w-72 max-w-[calc(100vw-16px)] rounded-lg border border-border bg-elevated px-3 py-2.5 text-left shadow-lg"
          style={{ left: tip.x, top: tip.y }}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-subtle">
            {tip.year} income
          </p>
          {payLines.length ? (
            <ul className="mt-1.5 space-y-1 text-sm text-fg">
              {payLines.map((row) => (
                <li key={row.label} className="flex justify-between gap-3">
                  <span>{row.label}</span>
                  <span className="tabular-nums">{usd(row.amount)}</span>
                </li>
              ))}
              {yearRow ? (
                <li className="flex justify-between gap-3 border-t border-border pt-1 font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {usd(flow(yearRow.income, yearRow.year))}
                  </span>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-muted">No paychecks this year.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
