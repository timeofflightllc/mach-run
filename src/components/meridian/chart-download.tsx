import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { hasBalanceSheet } from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import {
  downloadChartPdf,
  type ChartOrientation,
  type ChartPdfChoice,
  type ChartSpan,
} from "@/lib/plan/chart-pdf";
import type { SurvivalScore } from "@/lib/plan/monte-carlo-run";
import type { Plan, SimResult } from "@/lib/plan/types";

const CHOICES: { id: ChartPdfChoice; label: string }[] = [
  { id: "spendable", label: "Spendable Wealth" },
  { id: "cash", label: "Cash Flow" },
  { id: "net", label: "Net Worth" },
  { id: "monte", label: "Monte Carlo Plan Survival" },
];

function spanChoices(endAge: number): { id: ChartSpan; label: string }[] {
  return [
    { id: 5, label: "5-Year" },
    { id: 10, label: "10-Year" },
    { id: 20, label: "20-Year" },
    { id: "horizon", label: `Horizon (age ${endAge})` },
  ];
}

export function ChartDownload({
  plan,
  sim,
  survival = null,
  locked = false,
}: {
  plan: Plan;
  sim: SimResult;
  survival?: SurvivalScore | null;
  locked?: boolean;
}) {
  const ent = useEntitlement();
  const [open, setOpen] = useState(false);
  const monteReady = Boolean(survival && survival.bands.length > 0);
  const [picked, setPicked] = useState<Record<ChartPdfChoice, boolean>>({
    spendable: true,
    cash: true,
    net: true,
    monte: false,
  });
  const [orientation, setOrientation] = useState<ChartOrientation>("portrait");
  const [span, setSpan] = useState<ChartSpan>("horizon");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (locked || ent.pending || !hasBalanceSheet(ent.plan)) return null;

  function openDialog() {
    setPicked({ spendable: true, cash: true, net: true, monte: monteReady });
    setOrientation("portrait");
    setSpan("horizon");
    setError("");
    setOpen(true);
  }

  const chosen = CHOICES.filter((choice) => picked[choice.id] && (choice.id !== "monte" || monteReady)).map(
    (choice) => choice.id,
  );
  const noRun = sim.years.length === 0;

  function download() {
    if (noRun || !chosen.length) return;
    const wrote = downloadChartPdf({
      plan,
      sim,
      span,
      orientation,
      charts: chosen,
      survival: monteReady ? survival : null,
    });
    if (!wrote) {
      setError("Not enough years in that span to draw a chart.");
      return;
    }
    setOpen(false);
  }

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="paper-dialog fixed inset-0 z-[160] grid place-items-center bg-black/60 px-4 py-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chart-download-title"
            onMouseDown={() => setOpen(false)}
          >
            <div
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-[0_0_0_1px_#c8d2de]"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <h2 id="chart-download-title" className="font-display text-lg">
                Download chart
              </h2>
              {noRun ? (
                <p className="mt-3 text-sm leading-relaxed">There is no MACH RUN yet.</p>
              ) : (
                <div className="mt-4 space-y-4 text-sm">
                  <fieldset>
                    <legend className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Charts</legend>
                    <ul className="mt-2 space-y-1.5">
                      {CHOICES.map((choice) => {
                        const disabled = choice.id === "monte" && !monteReady;
                        return (
                          <li key={choice.id}>
                            <label className={`flex items-center gap-2 ${disabled ? "text-slate-400" : ""}`}>
                              <input
                                type="checkbox"
                                checked={!disabled && picked[choice.id]}
                                disabled={disabled}
                                onChange={() =>
                                  setPicked((current) => ({ ...current, [choice.id]: !current[choice.id] }))
                                }
                              />
                              {choice.label}
                            </label>
                            {disabled ? (
                              <p className="pl-6 text-xs text-slate-500">Run Monte Carlo on Takeoff first.</p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                  <fieldset>
                    <legend className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Page</legend>
                    <div className="mt-2 flex gap-4">
                      {(["portrait", "landscape"] as const).map((id) => (
                        <label key={id} className="flex items-center gap-2 capitalize">
                          <input
                            type="radio"
                            name="chart-pdf-orientation"
                            checked={orientation === id}
                            onChange={() => setOrientation(id)}
                          />
                          {id}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Time span</legend>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {spanChoices(plan.assumptions.projectionEndAge).map((choice) => (
                        <label key={String(choice.id)} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="chart-pdf-span"
                            checked={span === choice.id}
                            onChange={() => setSpan(choice.id)}
                          />
                          {choice.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {error ? <p className="text-sm text-slate-700">{error}</p> : null}
                </div>
              )}
              <div className="mt-5 flex items-center justify-end gap-3">
                <button type="button" className="text-sm text-slate-600 hover:text-slate-900" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                {noRun ? null : (
                  <button
                    type="button"
                    disabled={!chosen.length}
                    onClick={download}
                    className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40"
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="shrink-0 text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
      >
        Download chart
      </button>
      {dialog}
    </>
  );
}
