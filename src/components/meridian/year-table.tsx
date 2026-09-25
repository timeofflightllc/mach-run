import { useEffect, useState } from "react";
import { canDownloadInvestmentAudit } from "@/lib/ops/audit-download-api";
import { buildInvestmentAuditCsv } from "@/lib/plan/audit-csv";
import { simulate } from "@/lib/plan/engine";
import { usd } from "@/lib/plan/format";
import type { LedgerLine, Plan, SimResult, YearCap } from "@/lib/plan/types";

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

const AIR_KIND = [
  ["military", "Military retired pay"],
  ["va", "VA disability"],
  ["ss", "Social Security"],
  ["pension", "Pension"],
  ["other_retirement", "Other retirement"],
] as const;

function airLines(
  byKind: Record<string, number> | undefined,
  withdrawals: number,
  scale: (n: number) => number,
): { label: string; amount: number }[] {
  const rows: { label: string; amount: number }[] = [];
  for (const [kind, label] of AIR_KIND) {
    const raw = byKind?.[kind] ?? 0;
    if (raw > 0.5) rows.push({ label, amount: scale(raw) });
  }
  if (withdrawals > 0.5) {
    rows.push({
      label: "Investment and annuity withdrawals",
      amount: scale(withdrawals),
    });
  }
  return rows;
}

type LedgerTip = {
  year: number;
  x: number;
  y: number;
  mode:
    | "cap"
    | "year"
    | "age"
    | "income"
    | "tax"
    | "spend"
    | "saved"
    | "drawn"
    | "air"
    | "spendable";
};

function sumLabeled(
  groups: LedgerLine[][],
  scale: (n: number) => number,
): { label: string; amount: number }[] {
  const map = new Map<string, { label: string; amount: number }>();
  for (const lines of groups) {
    for (const line of lines) {
      if (line.amount <= 0.005) continue;
      const got = map.get(line.id) ?? { label: line.label, amount: 0 };
      got.amount += line.amount;
      got.label = line.label;
      map.set(line.id, got);
    }
  }
  return [...map.values()]
    .filter((row) => row.amount > 0.5)
    .map((row) => ({ label: row.label, amount: scale(row.amount) }))
    .sort((a, b) => b.amount - a.amount);
}

function LinesTip({
  x,
  y,
  title,
  rows,
  note,
  total,
}: {
  x: number;
  y: number;
  title: string;
  rows: { label: string; amount: number }[];
  note?: string;
  total?: number;
}) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[80] w-96 max-w-[calc(100vw-16px)] rounded-lg border border-border bg-elevated px-3 py-2.5 text-left shadow-lg"
      style={{ left: x, top: y }}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-subtle">
        {title}
      </p>
      {rows.length ? (
        <ul className="mt-1.5 space-y-1 text-sm text-fg">
          {rows.map((row, index) => (
            <li key={`${row.label}-${index}`} className="flex justify-between gap-3">
              <span>{row.label}</span>
              <span className="shrink-0 tabular-nums">{usd(row.amount)}</span>
            </li>
          ))}
          {total != null ? (
            <li className="flex justify-between gap-3 border-t border-border pt-1 font-medium">
              <span>Total</span>
              <span className="tabular-nums">{usd(total)}</span>
            </li>
          ) : null}
        </ul>
      ) : note ? null : (
        <p className="mt-1.5 text-sm text-muted">None this year.</p>
      )}
      {note ? (
        <p className="mt-2 text-xs leading-snug text-muted">{note}</p>
      ) : null}
    </div>
  );
}

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
  const [airTip, setAirTip] = useState<{ x: number; y: number } | null>(null);
  const [auditAllowed, setAuditAllowed] = useState(false);
  const capsByYear = new Map<number, YearCap[]>();
  for (const cap of sim.yearCaps ?? []) {
    const list = capsByYear.get(cap.year) ?? [];
    list.push(cap);
    capsByYear.set(cap.year, list);
  }
  const yearRow = tip ? sim.years.find((y) => y.year === tip.year) : undefined;

  useEffect(() => {
    let cancelled = false;
    canDownloadInvestmentAudit()
      .then((result) => {
        if (!cancelled) setAuditAllowed(Boolean(result?.allowed));
      })
      .catch(() => {
        if (!cancelled) setAuditAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  function dollarsNote() {
    return real ? "Shown in today's dollars." : "Shown in future dollars.";
  }

  function hoverNumber(
    year: number,
    mode: LedgerTip["mode"],
    className: string,
    text: string,
  ) {
    return (
      <button
        type="button"
        onMouseEnter={(e) => showTip(year, mode, e)}
        onMouseMove={(e) => showTip(year, mode, e)}
        onMouseLeave={() => setTip(null)}
        onFocus={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          showTip(year, mode, { clientX: r.right, clientY: r.top });
        }}
        onBlur={() => setTip(null)}
        className={`cursor-help underline decoration-dotted underline-offset-2 ${className}`}
      >
        {text}
      </button>
    );
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
      "air",
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
        y.air == null ? "" : y.air.toFixed(2),
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
    a.download = "mach-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAudit() {
    if (!auditAllowed) return;
    const full = simulate(plan, { audit: true });
    const csv = buildInvestmentAuditCsv(plan, full);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mach-investment-audit.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const capLines = tip?.mode === "cap" ? capReasons(capsByYear.get(tip.year) ?? []) : [];
  const payLines =
    tip?.mode === "income" && yearRow
      ? incomeLines(yearRow.incomeByKind, (n) => flow(n, yearRow.year))
      : [];
  const retirementLines =
    tip?.mode === "air" && yearRow
      ? airLines(yearRow.airByKind, yearRow.airWithdrawals, (n) =>
          flow(n, yearRow.year),
        )
      : [];
  const tipMonths = tip ? sim.months.filter((m) => m.year === tip.year) : [];
  const details = tipMonths.flatMap((m) => (m.detail ? [m.detail] : []));
  const scaleTip = (n: number) => (yearRow ? flow(n, yearRow.year) : n);
  const taxRate = details[0]?.taxRatePct ?? plan.assumptions.ordinaryTaxRatePct;
  const ordinaryTaxable = details.reduce((s, d) => s + d.ordinaryTaxable, 0);
  const ssBenefit = details.reduce((s, d) => s + d.ssBenefit, 0);
  const ssTaxable = details.reduce((s, d) => s + d.ssTaxable, 0);
  const rmdTaxable = details.reduce((s, d) => s + d.rmdTaxable, 0);
  const taxBase = ordinaryTaxable + ssTaxable + rmdTaxable;
  const taxRows: { label: string; amount: number }[] = [];
  if (ordinaryTaxable > 0.5) {
    taxRows.push({ label: "Ordinary income", amount: scaleTip(ordinaryTaxable) });
  }
  if (ssBenefit > 0.5) {
    taxRows.push({
      label: `Social Security taxed (${plan.assumptions.ssTaxablePct}%)`,
      amount: scaleTip(ssTaxable),
    });
  }
  if (rmdTaxable > 0.5) {
    taxRows.push({
      label: "Required minimum distributions",
      amount: scaleTip(rmdTaxable),
    });
  }
  const spendRows = sumLabeled(
    details.map((d) => [
      ...d.spendingLines,
      ...(d.unallocatedSpent > 0.5
        ? [
            {
              id: "unallocated",
              label: "Unallocated surplus (no sweep account)",
              amount: d.unallocatedSpent,
            },
          ]
        : []),
    ]),
    scaleTip,
  );
  const savedRows = sumLabeled(
    details.map((d) => [
      ...d.savedLines,
      ...(d.sweep ? [d.sweep] : []),
      ...d.matchLines,
    ]),
    scaleTip,
  );
  const drawnRows = sumLabeled(
    details.map((d) => d.drawnLines),
    scaleTip,
  );
  const lastDetailMonth = [...tipMonths].reverse().find((m) => m.detail);
  const spendableNominal = lastDetailMonth?.spendableEnd ?? 0;
  const spendableShown = yearRow
    ? real
      ? yearRow.endSpendableReal
      : yearRow.endSpendable
    : 0;
  const spendableScale =
    spendableNominal > 0.5 ? spendableShown / spendableNominal : 1;
  const spendableRows = (lastDetailMonth?.detail?.spendableLines ?? [])
    .filter((line) => Math.abs(line.amount) > 0.5)
    .map((line) => ({
      label: line.label,
      amount: line.amount * spendableScale,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="font-display text-xl font-bold text-fg">Yearly Ledger</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={download}
            className="h-11 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
          >
            Download Ledger CSV
          </button>
          {auditAllowed ? (
            <button
              type="button"
              onClick={downloadAudit}
              className="h-11 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
            >
              Download Full Investment CSV
            </button>
          ) : null}
        </div>
      </div>
      {sim.fundingGaps.length ? (
        <p className="border-t border-border px-4 py-3 text-sm text-muted">
          Identity: income + drawn = tax + spend + saved. Hover{" "}
          <span className="font-bold text-negative">CAPPED</span> for why that
          year was cut. Hover an income amount for the paycheck mix.
        </p>
      ) : (
        <p className="border-t border-border px-4 py-3 text-xs text-subtle">
          Identity: income + drawn = tax + spend + saved. Hover an income amount
          for the mix. Hover{" "}
          <span className="font-bold text-negative">CAPPED</span> when a year is
          marked.
        </p>
      )}
      <p className="border-t border-border px-4 py-2 text-xs text-subtle">
        A.I.R. starts at the retirement date in Family. Before that, the column is blank. It is not part of that equation. It is Actual Income Retired, before tax.
      </p>
      <div className="max-h-[min(42rem,calc(100dvh-var(--mach-header-h,7rem)-4rem))] overflow-auto">
        <table className="ledger-table w-max min-w-full text-left text-sm">
          <thead>
            <tr>
              {(
                [
                  ["Year", "px-4 py-2 font-medium"],
                  ["Age", "px-3 py-2 font-medium"],
                  ["Income", "px-3 py-2 font-medium"],
                  ["Tax", "px-3 py-2 font-medium"],
                  ["Spend", "px-3 py-2 font-medium"],
                  ["Saved", "px-3 py-2 font-medium"],
                  ["Drawn", "px-3 py-2 font-medium"],
                  ["A.I.R.", "px-3 py-2 font-medium"],
                  ["Spendable", "px-3 py-2 pr-5 font-medium"],
                ] as const
              ).map(([label, cls]) => (
                <th
                  key={label}
                  className={cls}
                  onMouseEnter={
                    label === "A.I.R."
                      ? (e) => setAirTip(tipPoint(e))
                      : undefined
                  }
                  onMouseMove={
                    label === "A.I.R."
                      ? (e) => setAirTip(tipPoint(e))
                      : undefined
                  }
                  onMouseLeave={
                    label === "A.I.R." ? () => setAirTip(null) : undefined
                  }
                >
                  {label === "A.I.R." ? (
                    <span className="cursor-help underline decoration-dotted underline-offset-2">
                      {label}
                    </span>
                  ) : (
                    label
                  )}
                </th>
              ))}
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
                    {hoverNumber(y.year, "year", "text-fg", String(y.year))}
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
                    {hoverNumber(
                      y.year,
                      "age",
                      "text-muted",
                      `${plan.primary.birthDate ? y.primaryAge : "—"}/${plan.spouse.birthDate ? y.spouseAge : "—"}`,
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {hoverNumber(y.year, "income", "text-fg", usd(flow(y.income, y.year)))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {hoverNumber(y.year, "tax", "text-muted", usd(flow(y.tax, y.year)))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {hoverNumber(y.year, "spend", "text-fg", usd(flow(y.spending, y.year)))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {hoverNumber(
                      y.year,
                      "saved",
                      "text-positive",
                      usd(flow(y.contributions, y.year)),
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {hoverNumber(
                      y.year,
                      "drawn",
                      "text-negative",
                      usd(flow(y.withdrawals, y.year)),
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {y.air == null
                      ? hoverNumber(y.year, "air", "text-subtle", "—")
                      : hoverNumber(y.year, "air", "text-fg", usd(flow(y.air, y.year)))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 pr-5">
                    {hoverNumber(
                      y.year,
                      "spendable",
                      "text-fg",
                      usd(real ? y.endSpendableReal : y.endSpendable),
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {airTip ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[80] w-80 max-w-[calc(100vw-16px)] rounded-lg border border-border bg-elevated px-3 py-2.5 text-left shadow-lg"
          style={{ left: airTip.x, top: airTip.y }}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-subtle">
            A.I.R.
          </p>
          <p className="mt-1.5 text-sm leading-snug text-fg">
            Actual Income Retired. Starts at the retirement date in Family.
            Military retired pay, VA, Social Security, pension, other
            retirement, plus withdrawals from that month on. Not the job. Not
            the Spendable balance.
          </p>
        </div>
      ) : null}
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
          <p className="mt-2 text-xs leading-snug text-muted">
            Paychecks, required minimum distributions, and employer match for
            this year. {dollarsNote()}
          </p>
        </div>
      ) : null}
      {tip?.mode === "air" ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[80] w-80 max-w-[calc(100vw-16px)] rounded-lg border border-border bg-elevated px-3 py-2.5 text-left shadow-lg"
          style={{ left: tip.x, top: tip.y }}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-subtle">
            {tip.year} Actual Income Retired
          </p>
          {retirementLines.length ? (
            <ul className="mt-1.5 space-y-1 text-sm text-fg">
              {retirementLines.map((row) => (
                <li key={row.label} className="flex justify-between gap-3">
                  <span>{row.label}</span>
                  <span className="tabular-nums">{usd(row.amount)}</span>
                </li>
              ))}
              {yearRow ? (
                <li className="flex justify-between gap-3 border-t border-border pt-1 font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {usd(
                      flow(yearRow.air ?? 0, yearRow.year),
                    )}
                  </span>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-muted">
              {plan.assumptions.retirementGoalDate
                ? `A.I.R. starts ${plan.assumptions.retirementGoalDate.slice(0, 7)}. Nothing is counted before that month.`
                : "Set a retirement date in Family."}
            </p>
          )}
          <p className="mt-2 text-xs leading-snug text-muted">
            Actual Income Retired. Military retired pay, VA, Social Security,
            pension, other retirement, plus withdrawals from the retirement
            month on. Not the job. Not the Spendable balance. {dollarsNote()}
          </p>
        </div>
      ) : null}
      {tip && yearRow && tip.mode === "year" ? (
        <LinesTip
          x={tip.x}
          y={tip.y}
          title={`${tip.year}`}
          rows={[]}
          note={`Calendar year in this MACH RUN. The other columns add up the months in ${tip.year}. Ages are as of the last of those months.`}
        />
      ) : null}
      {tip && yearRow && tip.mode === "age" ? (
        <LinesTip
          x={tip.x}
          y={tip.y}
          title={`${tip.year} ages`}
          rows={[]}
          note={`${plan.primary.name.trim() || "Primary"} ${plan.primary.birthDate ? `is ${yearRow.primaryAge} at the end of ${tip.year}, born ${plan.primary.birthDate}.` : "has no birthday set."} ${plan.spouse.name.trim() || "Spouse"} ${plan.spouse.birthDate ? `is ${yearRow.spouseAge} at the end of ${tip.year}, born ${plan.spouse.birthDate}.` : "has no birthday set."}`}
        />
      ) : null}
      {tip && yearRow && tip.mode === "tax" ? (
        <LinesTip
          x={tip.x}
          y={tip.y}
          title={`${tip.year} tax`}
          rows={taxRows}
          total={flow(yearRow.tax, yearRow.year)}
          note={`Each month, taxable income times the Family tax rate of ${taxRate}%. Ordinary income is taxed in full. Social Security uses the ${plan.assumptions.ssTaxablePct}% taxable share${ssBenefit > 0.5 ? ` of ${usd(scaleTip(ssBenefit))} in benefits` : ""}. Tax-free income is left out. Required minimum distributions are taxed as ordinary income. ${dollarsNote()}`}
        />
      ) : null}
      {tip && yearRow && tip.mode === "spend" ? (
        <LinesTip
          x={tip.x}
          y={tip.y}
          title={`${tip.year} spending`}
          rows={spendRows}
          total={flow(yearRow.spending, yearRow.year)}
          note={`Spending you typed, raised with inflation from the as-of date, plus mortgage and loan payments you marked to include. If Sweep surplus into is blank, leftover paycheck is unallocated surplus and is counted as spent. It is not saved. ${dollarsNote()}`}
        />
      ) : null}
      {tip && yearRow && tip.mode === "saved" ? (
        <LinesTip
          x={tip.x}
          y={tip.y}
          title={`${tip.year} saved`}
          rows={savedRows}
          total={flow(yearRow.contributions, yearRow.year)}
          note={`Dollars actually deposited, plus employer match. Match is not taken from the paycheck, and it is also counted in Income. Sweep is leftover cash sent to the account you picked.${yearRow.irsCut > 0.5 ? ` The IRS cap held back ${usd(flow(yearRow.irsCut, yearRow.year))}.` : ""} ${dollarsNote()}`}
        />
      ) : null}
      {tip && yearRow && tip.mode === "drawn" ? (
        <LinesTip
          x={tip.x}
          y={tip.y}
          title={`${tip.year} drawn`}
          rows={drawnRows}
          total={flow(yearRow.withdrawals, yearRow.year)}
          note={`Cash taken out of spendable accounts. RMDs are required. Other draws cover a short paycheck. Pre-tax accounts and annuity gains can be larger than the shortfall because tax comes out of the withdrawal. ${dollarsNote()}`}
        />
      ) : null}
      {tip && yearRow && tip.mode === "spendable" ? (
        <LinesTip
          x={tip.x}
          y={tip.y}
          title={`${tip.year} spendable`}
          rows={spendableRows}
          total={real ? yearRow.endSpendableReal : yearRow.endSpendable}
          note={`Ending balance of accounts marked spendable. This is not net worth. ${dollarsNote()}`}
        />
      ) : null}
    </div>
  );
}
