import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SwingName } from "@/lib/plan/monte-carlo";
import { type SurvivalScore } from "@/lib/plan/monte-carlo-run";
import { cn } from "@/lib/utils";
import { BACK_NOTE, CardHelp, FORWARD_NOTE, FuturesCard, HistoricalStretches } from "@/components/meridian/historical-stretches";
import { useBoydQuotes } from "@/components/meridian/use-boyd-quotes";
import type { Plan } from "@/lib/plan/types";

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

const countCard = "w-full min-w-0 sm:h-[19.5rem] sm:flex-1 sm:overflow-hidden";

function CountPlaceholder({ label, note, className }: { label: string; note: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl bg-[#fbfaf7] px-4 py-3.5 shadow-[0_0_0_1px_#e6e1d6] sm:h-[19.5rem] sm:overflow-hidden",
        className,
      )}
    >
      <CardHelp note={note} />
      <p className="pr-6 text-[10px] font-medium uppercase tracking-[0.14em] text-[#b7b1a6]">{label}</p>
      <p className="mt-1 font-display text-[2.6rem] font-semibold leading-none tracking-tight text-[#e4dfd4]">—</p>
    </div>
  );
}

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

const quoteSlipLarge =
  "relative flex h-[calc(10rem+24px)] w-full shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#e4d5c4] bg-[#f7f1e6] px-6 py-4 text-center sm:h-[10rem] sm:py-0";

function nextBoydLine(quotes: string[], current: string) {
  if (quotes.length === 0) return "";
  if (quotes.length === 1) return quotes[0] ?? "";
  let line = current;
  for (let i = 0; i < 8 && line === current; i += 1) {
    line = quotes[Math.floor(Math.random() * quotes.length)] ?? "";
  }
  return line;
}

const GAUGE = { cx: 100, cy: 104, r: 74, stroke: 20 };
const BLUE = "#7eb6ea";
const TEAL = "#6ecfc4";
const GREEN = "#3caf62";

function gaugePoint(percent: number, radius: number) {
  const angle = Math.PI * (1 - percent / 100);
  return [GAUGE.cx + radius * Math.cos(angle), GAUGE.cy - radius * Math.sin(angle)] as const;
}

function gaugeArc(from: number, to: number) {
  const [x1, y1] = gaugePoint(from, GAUGE.r);
  const [x2, y2] = gaugePoint(to, GAUGE.r);
  return `M ${x1} ${y1} A ${GAUGE.r} ${GAUGE.r} 0 0 1 ${x2} ${y2}`;
}

function SurvivalChance({ percent }: { percent: number | null }) {
  const value = percent == null ? null : Math.max(0, Math.min(100, percent));
  const cap = GAUGE.stroke / 2;
  const [x0, y0] = gaugePoint(0, GAUGE.r);
  const [x1, y1] = gaugePoint(100, GAUGE.r);
  const marker =
    value == null
      ? null
      : (() => {
          const angle = Math.PI * (1 - value / 100);
          const inner = GAUGE.r - cap - 2;
          const outer = GAUGE.r + cap + 2;
          const [x1, y1] = gaugePoint(value, inner);
          const [x2, y2] = gaugePoint(value, outer);
          const tip = gaugePoint(value, inner);
          const baseR = inner - 12;
          const spread = 0.085;
          const left = [
            GAUGE.cx + baseR * Math.cos(angle + spread),
            GAUGE.cy - baseR * Math.sin(angle + spread),
          ];
          const right = [
            GAUGE.cx + baseR * Math.cos(angle - spread),
            GAUGE.cy - baseR * Math.sin(angle - spread),
          ];
          return {
            x1,
            y1,
            x2,
            y2,
            arrow: `${tip[0]} ${tip[1]} ${left[0]} ${left[1]} ${right[0]} ${right[1]}`,
          };
        })();
  return (
    <div
      className="flex shrink-0 flex-col items-center"
      aria-label={value == null ? "Chance of success, not run yet" : `${value} percent chance of success`}
    >
      <svg viewBox="-18 0 240 150" className="h-36 w-[14.4rem]" aria-hidden="true">
        <path d={gaugeArc(0, 70)} fill="none" stroke={BLUE} strokeWidth={GAUGE.stroke} strokeLinecap="butt" />
        <path d={gaugeArc(70, 90)} fill="none" stroke={TEAL} strokeWidth={GAUGE.stroke} strokeLinecap="butt" />
        <path d={gaugeArc(90, 100)} fill="none" stroke={GREEN} strokeWidth={GAUGE.stroke} strokeLinecap="butt" />
        <circle cx={x0} cy={y0} r={cap} fill={BLUE} />
        <circle cx={x1} cy={y1} r={cap} fill={GREEN} />
        {marker ? (
          <line
            x1={marker.x1}
            y1={marker.y1}
            x2={marker.x2}
            y2={marker.y2}
            stroke="#1a1a1a"
            strokeWidth="3"
            strokeLinecap="butt"
          />
        ) : null}
        {marker ? <polygon points={marker.arrow} fill="#1a1a1a" /> : null}
        <circle cx={GAUGE.cx} cy={GAUGE.cy} r="38" fill="#fff" style={{ filter: "drop-shadow(0 1px 2px rgb(15 23 42 / 0.12))" }} />
        <text
          x={GAUGE.cx}
          y={GAUGE.cy + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0f172a"
          style={{ fontFamily: "Barlow Condensed, Arial Narrow, sans-serif", fontSize: 36, fontWeight: 650 }}
        >
          {value == null ? "—" : `${Math.round(value)}%`}
        </text>
        {[0, 70, 90, 100].map((mark) => {
          const [x, y] = gaugePoint(mark, GAUGE.r + cap + 16);
          const nudge = mark === 100 ? 4 : mark === 90 ? 3 : 0;
          return (
            <text
              key={mark}
              x={x + nudge}
              y={mark === 70 ? y + 6 : y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#64748b"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              {mark}%
            </text>
          );
        })}
      </svg>
      <p className="-mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-900">Chance of success</p>
    </div>
  );
}

export function BoydQuote({
  quotes,
  pulse,
  large = false,
  progress = 0,
}: {
  quotes: string[];
  pulse: boolean;
  large?: boolean;
  progress?: number;
}) {
  const floor = large ? 22 : 18;
  const min = large ? 14 : 11;
  const [spin, setSpin] = useState(0);
  const [px, setPx] = useState(floor);
  const slipRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const picked = useRef<{ spin: number; line: string } | null>(null);
  const seenMilestone = useRef(0);
  const count = Math.max(0, Math.min(1000, Math.round(Math.max(0, Math.min(1, progress)) * 1000)));
  const milestone = pulse ? Math.floor(count / 250) : 0;
  useEffect(() => {
    if (!pulse) {
      seenMilestone.current = 0;
      return;
    }
    if (milestone > seenMilestone.current) {
      seenMilestone.current = milestone;
      setSpin((n) => n + 1);
    }
  }, [pulse, milestone]);
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
      const width = slip.clientWidth;
      let cap = floor;
      let least = min;
      if (width >= 760) {
        slip.style.height = large ? "13.5rem" : "12rem";
        cap = large ? 40 : 34;
        least = large ? 16 : 13;
      } else if (width >= 560) {
        slip.style.height = large ? "12rem" : "10.5rem";
        cap = large ? 32 : 28;
        least = large ? 15 : 12;
      } else {
        slip.style.height = "";
      }
      const style = getComputedStyle(slip);
      const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const limit = slip.clientHeight - pad;
      let size = cap;
      while (size > least) {
        if (quote) quote.style.fontSize = `${size}px`;
        if (mark) {
          mark.style.fontSize = `${Math.round(size * 2.4)}px`;
          mark.style.marginBottom = `${size > 22 ? -28 : size > 15 ? -20 : -10}px`;
        }
        if (body.scrollHeight <= limit + 1) break;
        size -= 1;
      }
      setPx((prev) => (prev === size ? prev : size));
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(slip);
    return () => watch.disconnect();
  }, [line, floor, min, large]);

  const markPx = Math.round(px * 2.4);

  return (
    <div ref={slipRef} className={large ? quoteSlipLarge : quoteSlip}>
      {line ? (
        <div ref={bodyRef} className={cn("flex w-full flex-col items-center", pulse && "mach-run-pulse")}>
          <span
            aria-hidden="true"
            className="font-serif leading-none text-[#d05838]"
            style={{ fontSize: markPx, marginBottom: px > 22 ? -28 : px > 15 ? -20 : -10 }}
          >
            “
          </span>
          <p className={cn("font-display leading-snug text-slate-900", large ? "max-w-2xl" : "max-w-xl")} style={{ fontSize: px }}>
            {line}
          </p>
          <p className={cn("mt-2 font-medium uppercase tracking-[0.16em] text-slate-500", large ? "text-sm" : "text-xs")}>
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

export function RunMonteCarloButton({
  running,
  progress,
  again = false,
  onClick,
}: {
  running: boolean;
  progress: number;
  again?: boolean;
  onClick?: () => void;
}) {
  const label = again ? "Re-run Monte Carlo Simulation" : "Run Monte Carlo Simulation";
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
  const count = Math.max(0, Math.min(1000, Math.round(Math.max(0, Math.min(1, progress)) * 1000)));
  const width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  const figure = "flex h-full w-[100cqw] items-center justify-center text-2xl font-semibold tabular-nums leading-none";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${count} of 1,000 futures`}
      className="@container relative mt-3 h-10 w-full overflow-hidden rounded-lg border border-slate-900 bg-white text-slate-900"
    >
      <span className={figure}>{count}</span>
      <span className="absolute inset-y-0 left-0 overflow-hidden bg-slate-900 text-white" style={{ width }}>
        <span className={figure}>{count}</span>
      </span>
    </button>
  );
}

export function MonteCarloStaleNotice() {
  return (
    <p className="rounded-lg bg-[#e8c547] px-4 py-3 text-sm font-medium leading-relaxed text-[#1a1408]">
      This Monte Carlo is not current. The plan changed. Run it again.
    </p>
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
  longevityAge,
  plan = null,
  stale = false,
}: {
  locked: boolean;
  view: SurvivalView | null;
  onSwing?: (swing: SwingName) => void;
  onRun?: () => void;
  onClose?: () => void;
  onOpen?: () => void;
  onLockedMinChange?: (minimized: boolean) => void;
  longevityAge: number;
  plan?: Plan | null;
  stale?: boolean;
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
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <p className="text-sm text-slate-600">Simulated Market Conditions:</p>
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
  return (
    <div className={cn(card, "@min-[36rem]:flex @min-[36rem]:min-h-0 @min-[36rem]:flex-1 @min-[36rem]:flex-col")}>
      <SurvivalTitle />
      {stale && view.score ? <div className="mt-3"><MonteCarloStaleNotice /></div> : null}
      <div className="mt-3 flex flex-col items-center gap-3 @min-[32rem]:flex-row @min-[32rem]:items-start">
        <SurvivalChance percent={view.score ? view.score.score : null} />
        {plan ? (
          <div className="flex w-full min-w-0 flex-1 flex-col items-stretch gap-2 sm:flex-row">
            {view.score ? (
              <>
                <FuturesCard
                  className={countCard}
                  score={view.score.score}
                  longevityAge={longevityAge}
                  runOutAge={view.score.runOutAge}
                  failed={view.score.paths - view.score.survived}
                />
                <HistoricalStretches className={countCard} plan={plan} />
              </>
            ) : (
              <>
                <CountPlaceholder label="Mach Forward (Future Performance)" note={FORWARD_NOTE} className={countCard} />
                <CountPlaceholder label="Mach Back (Past Performance)" note={BACK_NOTE} className={countCard} />
              </>
            )}
          </div>
        ) : null}
      </div>
      <BoydQuote quotes={quotes} pulse={checking} progress={checking ? view.progress : 0} />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <p className="text-sm text-slate-600">Simulated Market Conditions:</p>
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
      <RunMonteCarloButton
        running={checking}
        progress={view.progress}
        again={!checking && Boolean(view.score)}
        onClick={onRun}
      />
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-200 pt-2">
        <p className="max-w-sm text-[11px] leading-snug text-slate-500">
          Plan Survival is a Monte Carlo rating. It runs 1,000 random market futures based upon calm, typical, or rough markets (selected above). The number
          is how many of each 100 still have money at the end of the plan and longevity date.
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
