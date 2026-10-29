import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SwingName } from "@/lib/plan/monte-carlo";
import { type SurvivalBand, type SurvivalScore, type SurvivalTraces } from "@/lib/plan/monte-carlo-run";
import { ageYears, monthStart, validIso } from "@/lib/plan/dates";
import { startingSpendable } from "@/lib/plan/engine";
import { usdCompact } from "@/lib/plan/format";
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
  /** Paths drawn so far. Only set while a run is in progress. */
  live?: SurvivalTraces | null;
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

const countCard = "w-full min-w-0 sm:h-[14.5rem] sm:flex-1 sm:overflow-hidden";

function CountPlaceholder({ label, note, className }: { label: string; note: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl bg-[#fbfaf7] px-4 py-3.5 shadow-[0_0_0_1px_#e6e1d6] sm:h-[14.5rem] sm:overflow-hidden",
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
  "relative mt-3 flex h-[calc(7.5rem+24px)] shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#e4d5c4] bg-[#f7f1e6] px-4 py-[12px] text-center sm:h-[7.5rem] sm:pb-4 sm:pt-1";

const quoteSlipLarge =
  "relative flex h-[calc(10rem+24px)] w-full shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#e4d5c4] bg-[#f7f1e6] px-6 py-4 text-center sm:h-[10rem] sm:pb-5 sm:pt-2";

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

function likelihood(percent: number): { words: string; mark: string } {
  const n = Math.round(percent);
  if (n >= 95) return { words: "Strong", mark: "💪" };
  if (n >= 85) return { words: "Very likely", mark: "✅" };
  if (n >= 70) return { words: "Likely", mark: "👍" };
  if (n >= 50) return { words: "Somewhat likely", mark: "🌤️" };
  return { words: "Not likely", mark: "⚠️" };
}

const BAND_NOTES = {
  blue: "0-69% probability of success with this plan. We'd like to see some changes to this plan to boost your probability rating.",
  teal: "70-89% probability of success with this plan. You are in the sweet spot for success with the plan you are on. Any positive changes will only make this plan more successful.",
  green:
    "90-100% probability of success with this plan. You are doing very well with your retirement planning — success is never guaranteed, but you are certainly on the right path.",
} as const;

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
          const inner = GAUGE.r - cap;
          const outer = GAUGE.r + cap;
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
  const [bandTip, setBandTip] = useState<{ tone: keyof typeof BAND_NOTES; x: number; y: number } | null>(null);
  function trackBand(tone: keyof typeof BAND_NOTES, event: { clientX: number; clientY: number }) {
    const width = 256;
    const x = Math.min(Math.max(event.clientX, width / 2 + 8), window.innerWidth - width / 2 - 8);
    const y = event.clientY + 18 + 96 > window.innerHeight ? event.clientY - 88 : event.clientY + 18;
    setBandTip({ tone, x, y });
  }
  return (
    <div
      className="flex shrink-0 flex-col items-center"
      aria-label={
        value == null
          ? "Probability of Mission Success, not run yet"
          : `${value} percent probability of mission success, ${likelihood(value).words}`
      }
    >
      <svg viewBox="-18 0 240 150" className="h-36 w-[14.4rem]" aria-hidden="true">
        <path
          d={gaugeArc(0, 70)}
          fill="none"
          stroke={BLUE}
          strokeWidth={GAUGE.stroke}
          strokeLinecap="butt"
          style={{ pointerEvents: "stroke" }}
          onMouseMove={(event) => trackBand("blue", event)}
          onMouseLeave={() => setBandTip(null)}
        />
        <path
          d={gaugeArc(70, 90)}
          fill="none"
          stroke={TEAL}
          strokeWidth={GAUGE.stroke}
          strokeLinecap="butt"
          style={{ pointerEvents: "stroke" }}
          onMouseMove={(event) => trackBand("teal", event)}
          onMouseLeave={() => setBandTip(null)}
        />
        <path
          d={gaugeArc(90, 100)}
          fill="none"
          stroke={GREEN}
          strokeWidth={GAUGE.stroke}
          strokeLinecap="butt"
          style={{ pointerEvents: "stroke" }}
          onMouseMove={(event) => trackBand("green", event)}
          onMouseLeave={() => setBandTip(null)}
        />
        <circle
          cx={x0}
          cy={y0}
          r={cap}
          fill={BLUE}
          onMouseMove={(event) => trackBand("blue", event)}
          onMouseLeave={() => setBandTip(null)}
        />
        <circle
          cx={x1}
          cy={y1}
          r={cap}
          fill={GREEN}
          onMouseMove={(event) => trackBand("green", event)}
          onMouseLeave={() => setBandTip(null)}
        />
        {marker ? (
          <line
            x1={marker.x1}
            y1={marker.y1}
            x2={marker.x2}
            y2={marker.y2}
            stroke="#1a1a1a"
            strokeWidth="3"
            strokeLinecap="butt"
            pointerEvents="none"
          />
        ) : null}
        {marker ? <polygon points={marker.arrow} fill="#1a1a1a" pointerEvents="none" /> : null}
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
          const nudge = mark === 100 ? 4 : mark === 90 || mark === 70 ? 3 : 0;
          return (
            <text
              key={mark}
              x={x + nudge}
              y={(mark === 70 ? y + 6 : y) + (mark === 0 || mark === 100 ? 5 : 0)}
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
      {bandTip ? (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[80] w-64 -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-left text-xs leading-snug text-white shadow-lg"
          style={{ left: bandTip.x, top: bandTip.y }}
        >
          {BAND_NOTES[bandTip.tone]}
        </span>
      ) : null}
      <p className="-mt-4 max-w-[14.4rem] text-center text-[11px] font-bold uppercase not-italic leading-snug tracking-[0.12em] text-slate-900 md:max-w-none md:text-sm">
        Probability of
        <br />
        <span className="whitespace-nowrap">Mission Success</span>
      </p>
      {value != null ? (
        <p className="mt-1.5 text-center font-display text-2xl font-black leading-tight tracking-tight text-black md:text-4xl">
          {likelihood(value).words} {likelihood(value).mark}
        </p>
      ) : null}
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

function sketchYears(plan: Plan, longevityAge: number): number[] {
  const start = Number(plan.assumptions.asOfDate.slice(0, 4));
  if (!Number.isFinite(start)) return [];
  let span = 30;
  if (validIso(plan.primary.birthDate)) {
    span = Math.max(1, longevityAge - ageYears(plan.primary.birthDate, monthStart(plan.assumptions.asOfDate)));
  }
  const years: number[] = [];
  for (let year = start; year <= start + span; year++) years.push(year);
  return years;
}

function atRank(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - rank) + sorted[hi] * (rank - lo);
}

function FuturesSketch({
  plan,
  longevityAge,
  traces,
  bands,
  showBands,
  onOpenMonte,
}: {
  plan: Plan;
  longevityAge: number;
  traces: SurvivalTraces | null;
  bands: SurvivalBand[] | null;
  showBands: boolean;
  onOpenMonte?: () => void;
}) {
  const wrapRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef({ shown: 0, yMax: 0, band: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const draw = () => {
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      if (width < 8 || height < 8) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      const pad = { l: 58, r: 12, t: 10, b: 26 };
      const plotW = Math.max(1, width - pad.l - pad.r);
      const plotH = Math.max(1, height - pad.t - pad.b);
      const real = plan.assumptions.dollars !== "nominal";
      const years = traces?.years?.length ? traces.years : sketchYears(plan, longevityAge);
      const full = traces ? (real ? traces.real : traces.nominal) : [];
      const anim = animRef.current;
      if (full.length < anim.shown) {
        anim.shown = 0;
        anim.band = 0;
        anim.yMax = 0;
      }
      const gap = full.length - anim.shown;
      if (gap > 0) anim.shown = Math.min(full.length, anim.shown + Math.min(16, Math.max(2, Math.round(gap * 0.12))));
      const series = full.slice(0, anim.shown);
      let target = Math.max(startingSpendable(plan) * 2, 10_000);
      if (showBands && bands && bands.length > 0 && anim.shown >= full.length && full.length > 0) {
        let hi = 0;
        for (const band of bands) hi = Math.max(hi, real ? band.p90Real : band.p90);
        if (hi > 0) target = hi * 1.08;
      } else if (series.length > 0) {
        const last: number[] = [];
        for (const row of series) {
          const value = row[row.length - 1];
          if (Number.isFinite(value)) last.push(value);
        }
        last.sort((a, b) => a - b);
        const hi = atRank(last, 0.9);
        if (hi > 0) target = hi * 1.12;
      }
      if (!(anim.yMax > 0)) anim.yMax = target;
      else anim.yMax += (target - anim.yMax) * 0.1;
      const yMax = anim.yMax;
      const bandsReady = Boolean(showBands && bands && bands.length > 1 && full.length > 0 && anim.shown >= full.length);
      if (bandsReady) anim.band = Math.min(1, anim.band + 0.07);
      else anim.band = 0;
      const xOf = (year: number) => {
        if (years.length <= 1) return pad.l + plotW / 2;
        const i = years.indexOf(year);
        const t = i >= 0 ? i / (years.length - 1) : 0;
        return pad.l + t * plotW;
      };
      const yOf = (value: number) => pad.t + (1 - Math.min(yMax, Math.max(0, value)) / yMax) * plotH;

      ctx.strokeStyle = "#e6e1d6";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let tick = 0; tick <= 4; tick++) {
        const value = (yMax * tick) / 4;
        const y = yOf(value);
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(pad.l + plotW, y);
        ctx.stroke();
        ctx.fillText(usdCompact(value), pad.l - 6, y);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const labelEvery = Math.max(1, Math.ceil(years.length / 6));
      years.forEach((year, index) => {
        if (index % labelEvery !== 0 && index !== years.length - 1) return;
        ctx.fillText(String(year), xOf(year), pad.t + plotH + 6);
      });
      ctx.strokeStyle = "#d5d0c6";
      ctx.strokeRect(pad.l, pad.t, plotW, plotH);

      if (series.length > 0 && years.length > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(pad.l, pad.t, plotW, plotH);
        ctx.clip();
        ctx.beginPath();
        ctx.strokeStyle = "rgba(90,104,118,0.28)";
        ctx.lineWidth = 1;
        for (const row of series) {
          let started = false;
          for (let i = 0; i < years.length && i < row.length; i++) {
            const py = yOf(row[i]);
            const px = xOf(years[i]);
            if (!started) {
              ctx.moveTo(px, py);
              started = true;
            } else ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      if (bandsReady && bands) {
        ctx.save();
        ctx.globalAlpha = anim.band;
        const ordered = bands.slice().sort((a, b) => a.year - b.year);
        const bandValue = (band: SurvivalBand, key: "p10" | "p50" | "p90") =>
          real ? band[`${key}Real`] : band[key];
        const fillBetween = (lowKey: "p10" | "p90", highKey: "p10" | "p90", color: string) => {
          ctx.beginPath();
          ordered.forEach((band, index) => {
            const px = xOf(band.year);
            const py = yOf(bandValue(band, highKey));
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          for (let index = ordered.length - 1; index >= 0; index--) {
            const band = ordered[index];
            ctx.lineTo(xOf(band.year), yOf(bandValue(band, lowKey)));
          }
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        };
        fillBetween("p10", "p90", "rgba(58,138,88,0.28)");
        if (series.length > 0) {
          ctx.beginPath();
          years.forEach((year, index) => {
            const values: number[] = [];
            for (const row of series) {
              const value = row[index];
              if (Number.isFinite(value)) values.push(value);
            }
            values.sort((a, b) => a - b);
            const py = yOf(atRank(values, 0.75));
            if (index === 0) ctx.moveTo(xOf(year), py);
            else ctx.lineTo(xOf(year), py);
          });
          for (let index = years.length - 1; index >= 0; index--) {
            const values: number[] = [];
            for (const row of series) {
              const value = row[index];
              if (Number.isFinite(value)) values.push(value);
            }
            values.sort((a, b) => a - b);
            ctx.lineTo(xOf(years[index]), yOf(atRank(values, 0.25)));
          }
          ctx.closePath();
          ctx.fillStyle = "rgba(31,107,64,0.45)";
          ctx.fill();
        }
        ctx.beginPath();
        ordered.forEach((band, index) => {
          const px = xOf(band.year);
          const py = yOf(bandValue(band, "p50"));
          if (index === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = "#1a2330";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }
    };
    let raf = 0;
    let alive = true;
    const frame = () => {
      if (!alive) return;
      draw();
      const full = traces ? (plan.assumptions.dollars !== "nominal" ? traces.real : traces.nominal) : [];
      const anim = animRef.current;
      const busy = anim.shown < full.length || (showBands && full.length > 0 && anim.band < 0.99);
      raf = busy ? requestAnimationFrame(frame) : 0;
    };
    frame();
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [plan, longevityAge, traces, bands, showBands]);

  return (
    <button
      ref={wrapRef}
      type="button"
      onClick={onOpenMonte}
      className="group relative mt-2 min-h-0 w-full flex-1 text-left"
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#1a2330]/45 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <span className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-[#1a2330] shadow-[0_8px_24px_rgba(26,35,48,0.28)]">
          Click here to go to Monte Carlo tab
        </span>
      </span>
    </button>
  );
}

export function MonteCarloStaleNotice({ onRun }: { onRun?: () => void }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-[#e8c547] px-4 py-3">
      <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-[#1a1408]">
        This Monte Carlo is not current. The plan changed. Run it again.
      </p>
      {onRun ? (
        <button
          type="button"
          disabled={sent}
          onClick={() => {
            if (sent) return;
            setSent(true);
            onRun();
          }}
          className="h-8 shrink-0 rounded-lg bg-[#1a1408] px-3 text-xs font-medium text-white hover:bg-[#2c2614] disabled:cursor-not-allowed disabled:bg-[#9a9484] disabled:text-white/80"
        >
          Re-run Monte Carlo
        </button>
      ) : null}
    </div>
  );
}

export function SurvivalChartNote({
  plan,
  score,
  longevityAge,
}: {
  plan: Plan;
  score: SurvivalScore;
  longevityAge: number;
}) {
  return (
    <div className="pointer-events-auto flex w-full min-w-0 flex-col items-stretch gap-2 sm:flex-row">
      <div className="flex w-full shrink-0 flex-col items-center rounded-2xl bg-white/95 px-3 py-3 shadow-[0_10px_28px_rgba(26,35,48,0.14),0_0_0_1px_#d5d0c6] sm:w-auto">
        <div className="self-start">
          <SurvivalTitle />
        </div>
        <SurvivalChance percent={score.score} />
      </div>
      <FuturesCard
        className={countCard}
        score={score.score}
        longevityAge={longevityAge}
        runOutAge={score.runOutAge}
        failed={score.paths - score.survived}
      />
      <HistoricalStretches className={countCard} plan={plan} />
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
  onLockedMinChange,
  longevityAge,
  plan = null,
  stale = false,
  onOpenMonte,
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
  onOpenMonte?: () => void;
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
    <div className={cn(card, "flex h-full min-h-0 flex-1 flex-col")}>
      <SurvivalTitle />
      {stale && view.score ? <div className="mt-3"><MonteCarloStaleNotice onRun={onRun} /></div> : null}
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
                <CountPlaceholder label="Mach Forward (Future Potential)" note={FORWARD_NOTE} className={countCard} />
                <CountPlaceholder label="Mach Rewind (Past Estimations)" note={BACK_NOTE} className={countCard} />
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
      {plan ? (
        <FuturesSketch
          plan={plan}
          longevityAge={longevityAge}
          traces={checking ? view.live ?? null : view.score?.traces ?? null}
          bands={checking ? null : view.score?.bands ?? null}
          showBands={!checking && Boolean(view.score && view.score.bands.length > 1)}
          onOpenMonte={onOpenMonte}
        />
      ) : null}
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
