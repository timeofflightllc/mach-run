import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { SwingName } from "@/lib/plan/monte-carlo";
import { survivalSentence, type SurvivalScore } from "@/lib/plan/monte-carlo-run";
import { cn } from "@/lib/utils";
import { useBoydQuotes } from "@/components/meridian/use-boyd-quotes";

export type SurvivalView = {
  runId: number;
  status: "running" | "ready" | "empty";
  score: SurvivalScore | null;
  swing: SwingName;
  open: boolean;
  /** Bumps once per Monte Carlo start. The quote stays until the next bump. */
  pass: number;
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
  active,
}: {
  quotes: string[];
  pass: number;
  active: boolean;
}) {
  const list = useRef(quotes);
  list.current = quotes;
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    const quotesNow = list.current;
    if (pass === 0 || quotesNow.length === 0) return;
    setLine(quotesNow[Math.floor(Math.random() * quotesNow.length)] ?? null);
  }, [pass]);

  if (!active || !line) return null;

  return (
    <div className="mt-4 flex min-h-32 flex-col items-center justify-center px-3 text-center">
      <p className="max-w-xl font-display text-lg leading-snug text-slate-900">{line}</p>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        John Boyd
      </p>
    </div>
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
            <p className="max-w-none px-2 text-center text-xs font-medium leading-relaxed text-fg sm:text-sm">
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
  const checking = view.status === "running" || !view.score;
  return (
    <div className={card}>
      <SurvivalTitle />
      <p
        className={cn(
          "mt-3 text-sm leading-relaxed",
          checking ? "text-slate-800" : "font-medium text-slate-900",
        )}
      >
        {checking ? "Checking 1,000 futures…" : survivalSentence(view.score!.score)}
      </p>
      <BoydQuote quotes={quotes} pass={view.pass} active={checking} />
      {!checking && view.score?.runOutAge != null ? (
        <p className="mt-1 text-sm leading-relaxed text-slate-800">
          In the futures that run out, the middle one runs out at age {view.score.runOutAge}.
        </p>
      ) : null}
      <div className="mt-3 inline-flex rounded-lg bg-slate-100 p-1">
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
      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        Calm is quieter markets. Typical is the usual swing. Rough is wider markets.
        Choose one, then run it.
      </p>
      <button
        type="button"
        onClick={onRun}
        className="mt-3 h-10 w-full rounded-lg bg-slate-900 text-sm font-medium text-white hover:bg-slate-800"
      >
        Run Monte Carlo Simulation
      </button>
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
