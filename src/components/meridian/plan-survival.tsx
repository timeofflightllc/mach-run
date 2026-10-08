import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
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

const LOCKED_MIN_KEY = "mach-plan-survival-min";

function readLockedMin() {
  try {
    return window.localStorage.getItem(LOCKED_MIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function readPlanSurvivalMinimized() {
  return readLockedMin();
}

function writeLockedMin(min: boolean) {
  try {
    if (min) window.localStorage.setItem(LOCKED_MIN_KEY, "1");
    else window.localStorage.removeItem(LOCKED_MIN_KEY);
  } catch {
    /* keep the choice for this visit */
  }
}

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

const quoteSlip =
  "relative mt-3 flex h-[calc(7.5rem+24px)] shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#e4d5c4] bg-[#f7f1e6] px-4 py-[12px] text-center sm:h-[7.5rem] sm:py-0";

function nextBoydLine(quotes: string[], current: string) {
  if (quotes.length === 0) return "";
  if (quotes.length === 1) return quotes[0] ?? "";
  let line = current;
  for (let i = 0; i < 8 && line === current; i += 1) {
    line = quotes[Math.floor(Math.random() * quotes.length)] ?? "";
  }
  return line;
}

function BoydQuote({ quotes, pulse }: { quotes: string[]; pulse: boolean }) {
  const [spin, setSpin] = useState(0);
  const [px, setPx] = useState(18);
  const slipRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const picked = useRef<{ spin: number; line: string } | null>(null);
  if (
    quotes.length > 0 &&
    (picked.current == null ||
      picked.current.spin !== spin ||
      !quotes.includes(picked.current.line))
  ) {
    const line = nextBoydLine(quotes, picked.current?.line ?? "");
    if (line) picked.current = { spin, line };
  }
  const line = picked.current?.line ?? "";

  useLayoutEffect(() => {
    const slip = slipRef.current;
    const body = bodyRef.current;
    if (!slip || !body || !line) return;
    const quote = body.querySelector("p");
    const mark = body.querySelector("span");
    const fit = () => {
      const style = getComputedStyle(slip);
      const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const limit = slip.clientHeight - pad;
      let size = 18;
      while (size > 11) {
        if (quote) quote.style.fontSize = `${size}px`;
        if (mark) {
          mark.style.fontSize = `${Math.round(size * 2.4)}px`;
          mark.style.marginBottom = `${size > 15 ? -20 : -10}px`;
        }
        if (body.scrollHeight <= limit) break;
        size -= 1;
      }
      setPx((prev) => (prev === size ? prev : size));
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(slip);
    return () => watch.disconnect();
  }, [line]);

  const markPx = Math.round(px * 2.4);

  return (
    <div ref={slipRef} className={quoteSlip}>
      {line ? (
        <div ref={bodyRef} className={cn("flex w-full flex-col items-center", pulse && "mach-run-pulse")}>
          <span
            aria-hidden="true"
            className="font-serif leading-none text-[#d05838]"
            style={{ fontSize: markPx, marginBottom: px > 15 ? -20 : -10 }}
          >
            “
          </span>
          <p className="max-w-xl font-display leading-snug text-slate-900" style={{ fontSize: px }}>
            {line}
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            John Boyd
          </p>
        </div>
      ) : null}
      {quotes.length > 1 ? (
        <button
          type="button"
          aria-label="Another quote"
          onClick={() => setSpin((n) => n + 1)}
          className="absolute bottom-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-[#efe4d4] hover:text-slate-900"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
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
  onLockedMinChange,
}: {
  locked: boolean;
  view: SurvivalView | null;
  onSwing?: (swing: SwingName) => void;
  onRun?: () => void;
  onClose?: () => void;
  onOpen?: () => void;
  onLockedMinChange?: (minimized: boolean) => void;
}) {
  const quotes = useBoydQuotes();
  const [lockedMin, setLockedMin] = useState(readLockedMin);
  if (locked && lockedMin) {
    return (
      <button
        type="button"
        onClick={() => {
          setLockedMin(false);
          writeLockedMin(false);
          onLockedMinChange?.(false);
        }}
        className={cn(card, "w-full text-left")}
      >
        <SurvivalTitle />
      </button>
    );
  }
  if (locked) {
    return (
      <div className={cn(card, "relative @min-[36rem]:flex @min-[36rem]:min-h-0 @min-[36rem]:flex-1 @min-[36rem]:flex-col")}>
        <div className="pointer-events-none flex flex-1 flex-col select-none" aria-hidden="true">
          <SurvivalTitle />
          <div className={quoteSlip} />
          <div
            className="mt-4 flex h-[9rem] shrink-0 flex-col items-center justify-center overflow-hidden rounded-md px-3 text-center"
            style={{
              background: "color-mix(in oklab, #e8c547 22%, white)",
              boxShadow: "0 0 0 1px color-mix(in oklab, #e8c547 45%, white)",
            }}
          >
            <p className="text-sm leading-relaxed text-slate-800">
              Press Run Monte Carlo Simulation to check 1,000 futures.
            </p>
          </div>
          <div className="mt-3 flex justify-center">
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              {CHOICES.map((choice) => (
                <span
                  key={choice.id}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium",
                    choice.id === "typical" ? "bg-slate-900 text-white" : "text-slate-600",
                  )}
                >
                  {choice.label}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-2 text-center text-xs leading-relaxed text-slate-600">
            Calm is quieter markets. Typical is the usual swing. Rough is wider markets. Choose one,
            then run it.
          </p>
          <span className="mt-3 flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 text-sm font-medium text-white">
            Run Monte Carlo Simulation
          </span>
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-canopy/70 p-5">
          <p className="max-w-none px-2 text-center text-xs font-medium leading-relaxed text-white sm:text-sm">
            <span className="block">Unlock Plan Survival (Monte Carlo Simulations) with</span>
            <Link
              to="/pricing"
              className="text-[#e8c547] underline decoration-[#e8c547]/80 underline-offset-4 hover:text-[#f6e7b0]"
            >
              Individual Unlimited or Advisor
            </Link>
          </p>
        </div>
        <button
          type="button"
          aria-label="Minimize Plan Survival"
          onClick={() => {
            setLockedMin(true);
            writeLockedMin(true);
            onLockedMinChange?.(true);
          }}
          className="absolute right-2 top-2 z-20 flex h-6 w-6 items-end justify-center rounded-sm border border-slate-500 bg-white pb-[5px] text-slate-900 hover:bg-slate-100"
        >
          <span className="block h-[2px] w-2.5 bg-current" />
        </button>
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
    <div className={cn(card, "@min-[36rem]:flex @min-[36rem]:min-h-0 @min-[36rem]:flex-1 @min-[36rem]:flex-col")}>
      <SurvivalTitle />
      <BoydQuote quotes={quotes} pulse={checking} />
      <div
        className="mt-4 flex h-[9rem] shrink-0 flex-col items-center justify-center overflow-hidden rounded-md px-3 text-center"
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
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-200 pt-2">
        <p className="max-w-sm text-[11px] leading-snug text-slate-500">
          Plan Survival is a Monte Carlo rating. It runs 1,000 random market futures. The number
          is how many of each 100 still have money at the end of the plan.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 shrink-0 items-center rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          Close
        </button>
      </div>
    </div>
  );
}
