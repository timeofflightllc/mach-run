import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import type { SwingName } from "@/lib/plan/monte-carlo";
import { runOutSentence, survivalSentence, type SurvivalScore } from "@/lib/plan/monte-carlo-run";
import { cn } from "@/lib/utils";
import { MachOrbit } from "@/components/meridian/mach-orbit";
import { useBoydQuotes } from "@/components/meridian/use-boyd-quotes";

export type SurvivalView = {
  runId: number;
  status: "idle" | "running" | "ready" | "empty";
  score: SurvivalScore | null;
  swing: SwingName;
  open: boolean;
  /** Bumps once per Monte Carlo start. The quote stays until the next bump. */
  pass: number;
  /** 0 to 1 while status is running. The button fill. */
  progress: number;
};

const card =
  "relative rounded-xl bg-white p-4 text-slate-800 shadow-[0_0_0_1px_#c8d2de] sm:p-5";

const CHOICES: { id: SwingName; label: string }[] = [
  { id: "calm", label: "Calm" },
  { id: "typical", label: "Typical" },
  { id: "rough", label: "Rough" },
];

function SurvivalTitle() {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
      Plan Survival
      <span className="mt-0.5 block tracking-[0.14em]">(Monte Carlo Simulation)</span>
    </p>
  );
}

function BoydQuote({
  quotes,
  pass,
  show,
}: {
  quotes: string[];
  pass: number;
  show: boolean;
}) {
  const picked = useRef<{ pass: number; line: string } | null>(null);
  if (pass > 0 && quotes.length > 0 && picked.current?.pass !== pass) {
    const line = quotes[Math.floor(Math.random() * quotes.length)] ?? "";
    if (line) picked.current = { pass, line };
  }
  const line = picked.current?.pass === pass ? picked.current.line : "";
  if (!show || !line) return null;

  return (
    <div className="mt-4 flex min-h-32 flex-col items-center justify-center rounded-lg border border-[#e4d5c4] bg-[#f7f1e6] px-4 py-5 text-center">
      <span aria-hidden="true" className="font-serif text-6xl leading-none text-[#d05838]">
        “
      </span>
      <p className="mt-1 max-w-xl font-display text-lg leading-snug text-slate-900">{line}</p>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        John Boyd
      </p>
    </div>
  );
}

function RunMonteCarloButton({
  running,
  progress,
  onClick,
}: {
  running: boolean;
  progress: number;
  onClick?: () => void;
}) {
  const label = "Run Monte Carlo Simulation";
  const width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  if (!running) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="mt-3 h-10 w-full rounded-lg bg-slate-900 text-sm font-medium text-white hover:bg-slate-800"
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="@container relative mt-3 h-10 w-full overflow-hidden rounded-lg border border-slate-900 bg-white text-sm font-medium text-slate-900"
    >
      <span className="flex h-full items-center justify-center">{label}</span>
      <span className="absolute inset-y-0 left-0 overflow-hidden bg-slate-900 text-white" style={{ width }}>
        <span className="flex h-full w-[100cqw] items-center justify-center">{label}</span>
      </span>
    </button>
  );
}

export function PlanSurvival({
  locked,
  view,
  onSwing,
  onRun,
  onClose,
  onOpen,
}: {
  locked: boolean;
  view: SurvivalView | null;
  onSwing?: (swing: SwingName) => void;
  onRun?: () => void;
  onClose?: () => void;
  onOpen?: () => void;
}) {
  const quotes = useBoydQuotes();
  if (locked) {
    return (
      <div className={card}>
        <SurvivalTitle />
        <div className="relative mt-3">
          <div className="pointer-events-none select-none opacity-60">
            <p className="text-sm font-medium leading-relaxed text-slate-900">
              {survivalSentence(85)}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Sample only. Your 1,000 futures unlock on Individual Unlimited.
            </p>
          </div>
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-canopy/70 p-5">
            <p className="max-w-none px-2 text-center text-xs font-medium leading-relaxed text-white sm:text-sm">
              <span className="block">Unlock Plan Survival with</span>
              <Link
                to="/pricing"
                className="text-[#e8c547] underline decoration-[#e8c547]/80 underline-offset-4 hover:text-[#f6e7b0]"
              >
                Individual Unlimited or Advisor
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (!view) {
    return (
      <div className={card}>
        <SurvivalTitle />
        <p className="mt-3 text-sm leading-relaxed text-slate-800">Hit Calculate to run 1,000 futures.</p>
      </div>
    );
  }
  if (view.status === "empty") return null;
  if (!view.open) {
    return (
      <button type="button" onClick={onOpen} className={cn(card, "w-full text-left")}>
        <SurvivalTitle />
      </button>
    );
  }
  const checking = view.status === "running";
  const ranOut = view.score ? runOutSentence(view.score) : null;
  return (
    <div className={cn(card, "flex flex-col @min-[36rem]:h-full @min-[36rem]:flex-1")}>
      <SurvivalTitle />
      {checking ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-800">Checking 1,000 futures…</p>
      ) : null}
      <BoydQuote quotes={quotes} pass={view.pass} show={view.pass > 0} />
      <div
        className="mt-4 flex min-h-[11.5rem] flex-col items-center justify-center rounded-md px-3 py-3 text-center @min-[36rem]:flex-1"
        style={{
          background: "color-mix(in oklab, #e8c547 22%, white)",
          boxShadow: "0 0 0 1px color-mix(in oklab, #e8c547 45%, white)",
        }}
      >
        {checking ? (
          <MachOrbit compact />
        ) : view.score ? (
          <>
            <p className="text-lg font-bold leading-snug text-slate-900">
              {survivalSentence(view.score.score)}
            </p>
            {ranOut ? (
              <p className="mt-1 text-base font-semibold leading-snug text-slate-900">{ranOut}</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-slate-800">
            Press Run Monte Carlo Simulation to check 1,000 futures.
          </p>
        )}
      </div>
      <div className="mt-3 flex justify-center">
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
        {CHOICES.map((choice) => {
          const on = view.swing === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={on}
              onClick={() => onSwing?.(choice.id)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium",
                on ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {choice.label}
            </button>
          );
        })}
        </div>
      </div>
      <p className="mt-2 text-center text-xs leading-relaxed text-slate-600">
        Calm is quieter markets. Typical is the usual swing. Rough is wider markets.
        Choose one, then run it.
      </p>
      <RunMonteCarloButton running={checking} progress={view.progress} onClick={onRun} />
      <div className="mt-3 flex justify-end border-t border-slate-200 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          Close
        </button>
      </div>
    </div>
  );
}
