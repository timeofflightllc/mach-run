import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { runHistorical, type HistoricalCount } from "@/lib/plan/historical-run";
import { claimMachBackSlot } from "@/lib/ooda-ai/page-facts";
import { planInputSignature } from "@/lib/plan/input-signature";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/plan/types";

const card =
  "pointer-events-auto relative flex flex-col rounded-2xl bg-white/95 px-4 py-3.5 shadow-[0_10px_28px_rgba(26,35,48,0.14),0_0_0_1px_#d5d0c6] backdrop-blur-sm";

export const FORWARD_NOTE = (
  <>
    <p>1,000 random future markets, centered on the rate of return you typed in Observe.</p>
    <p className="mt-2">The number is how many out of 100 possible futures still have money at longevity.</p>
  </>
);

const HISTORY_STRETCHES: { years: string; title: string }[] = [
  { years: "1929–1932", title: "The Great Crash" },
  { years: "1933–1945", title: "Depression and WWII" },
  { years: "1946–1965", title: "The Postwar Boom" },
  { years: "1966–1981", title: "The Great Inflation" },
  { years: "1973–1974", title: "The Oil Shock" },
  { years: "1982–1999", title: "The Great Bull Market" },
  { years: "2000–2009", title: "The Lost Decade" },
  { years: "2007–2009", title: "The Global Financial Crisis" },
  { years: "2020", title: "The COVID Crash" },
  { years: "2022", title: "The Inflation Selloff" },
];

export const BACK_NOTE = (
  <>
    <p>
      Each start year is its own full run, through longevity, using that stretch's real returns in order. Nothing is averaged.
      The number is how many of those runs still had money at longevity.
    </p>
    <ul className="mt-2 list-disc space-y-0.5 pl-4">
      {HISTORY_STRETCHES.map((row) => (
        <li key={row.years}>
          {row.years} ({row.title})
        </li>
      ))}
    </ul>
  </>
);

export function CardHelp({ note }: { note: ReactNode }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  function place() {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
    const top = rect.bottom + 8;
    setBox({ top, left, width });
  }

  function show() {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    place();
    setOpen(true);
  }

  function hide() {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  function closeNow() {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function outside(target: Node | null) {
      if (!target) return true;
      if (buttonRef.current?.contains(target)) return false;
      if (popRef.current?.contains(target)) return false;
      return true;
    }
    function onPointer(event: PointerEvent) {
      if (!outside(event.target as Node | null)) return;
      closeNow();
    }
    function onScroll(event: Event) {
      if (!outside(event.target as Node | null)) return;
      closeNow();
    }
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="What this card means"
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onPointerDown={(event) => {
          if (event.pointerType !== "touch") return;
          event.preventDefault();
          if (open) closeNow();
          else show();
        }}
        className="absolute right-2.5 top-2.5 z-20 flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold text-[#6b7280] hover:bg-[#f4f1ea] hover:text-[#1a2330] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2330]"
      >
        ?
      </button>
      {open && box
        ? createPortal(
            <div
              ref={popRef}
              onMouseEnter={show}
              onMouseLeave={hide}
              style={{ top: box.top, left: box.left, width: box.width }}
              className="fixed z-[80] max-h-[min(32rem,70vh)] overflow-y-auto rounded-lg bg-[#1a2330] px-4 py-3 pr-8 text-left text-sm font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg"
            >
              <button
                type="button"
                aria-label="Close"
                onClick={closeNow}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-base leading-none text-white/80 hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
              {note}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function FuturesCard({
  score,
  longevityAge,
  runOutAge,
  failed,
  className,
}: {
  score: number;
  longevityAge: number;
  runOutAge: number | null;
  failed: number;
  className?: string;
}) {
  return (
    <div className={cn(card, className ?? "w-[min(100%,18rem)]")}>
      <span className="sr-only" data-mach-note="">
        In {score} of 100 futures, the money lasts to age {longevityAge}.
      </span>
      <CardHelp note={FORWARD_NOTE} />
      <p className="pr-6 text-[10px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
        Mach Forward (Future Potential)
      </p>
      <p className="mt-1 font-display text-[1.65rem] font-semibold tabular-nums leading-tight tracking-tight text-[#1a2330]">
        {score} of 100 possible futures
      </p>
      <p className="mt-1 text-sm leading-snug text-[#1a2330]">still have money at age {longevityAge}.</p>
      <p className="mt-2 text-sm leading-relaxed text-[#3d4a54] sm:min-h-0 sm:flex-1 sm:overflow-hidden md:text-lg">
        One thousand random market futures, centered on the return you typed in OBSERVE Assumptions.
        {runOutAge != null && failed > 0
          ? ` In the ${Math.max(0, 100 - score)} random futures where your plan ran out of money prior to longevity age (${longevityAge}), the middle one lasted until age ${runOutAge}.`
          : ""}
      </p>
    </div>
  );
}

export function HistoricalStretches({ plan, className }: { plan: Plan; className?: string }) {
  const [percent, setPercent] = useState(60);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<HistoricalCount | null>(null);
  const [used, setUsed] = useState(60);
  const signature = planInputSignature(plan);
  const signatureRef = useRef(signature);
  signatureRef.current = signature;
  const machBackSlot = useRef<ReturnType<typeof claimMachBackSlot> | null>(null);
  if (!machBackSlot.current) machBackSlot.current = claimMachBackSlot();

  useEffect(() => {
    setCount(null);
    machBackSlot.current?.set(null);
  }, [signature]);

  useEffect(() => {
    const slot = machBackSlot.current;
    return () => slot?.release();
  }, []);

  function run() {
    const next = Math.min(100, Math.max(0, percent));
    const ranFor = signatureRef.current;
    setBusy(true);
    window.setTimeout(() => {
      const result = runHistorical(plan, next);
      setBusy(false);
      if (signatureRef.current !== ranFor) return;
      setUsed(next);
      setCount(result);
      machBackSlot.current?.set({ survived: result.survived, total: result.total, stocks: next });
    }, 0);
  }

  const all = count != null && count.total > 0 && count.failedStartYears.length === 0;
  const failedLine = count && count.failedStartYears.length > 0 ? shortFailed(count.failedStartYears) : null;
  const pct = count && count.total > 0 ? Math.round((count.survived / count.total) * 100) : 0;

  return (
    <div className={cn(card, className ?? "w-[min(100%,18rem)]")}>
      <CardHelp note={BACK_NOTE} />
      <p className="pr-6 text-[10px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
        Mach Rewind (Past Estimations)
      </p>
      {count && count.total > 0 ? (
        <>
          <p
            className={
              "mt-1 font-display text-[1.65rem] font-semibold tabular-nums leading-tight tracking-tight " +
              (all ? "text-[#3a8a58]" : "text-[#1a2330]")
            }
          >
            {count.survived} of {count.total} ({pct}%)
          </p>
          <p className="mt-1 text-sm leading-snug text-[#1a2330]">
            {all
              ? `Every real historical look-back still had money at longevity, at ${used}% stocks and ${100 - used}% bonds.`
              : `${pct}% of the real historical look-backs still had money at longevity, at ${used}% stocks and ${100 - used}% bonds.`}
          </p>
          {failedLine ? (
            <p className="mt-2 text-xs leading-relaxed text-[#3d4a54] sm:min-h-0 sm:flex-1 sm:overflow-hidden">
              {failedLine}
            </p>
          ) : null}
        </>
      ) : count?.total === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-[#3d4a54] sm:min-h-0 sm:flex-1 sm:overflow-hidden">
          No stretch in the table is long enough for this plan.
        </p>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-[#3d4a54]">
          Set stocks and bonds allocation percentages for your Mach Rewind (market look-back) to run historical simulations. Then click Run below.
        </p>
      )}
      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
        <MixSlider label="Stocks" value={percent} onChange={setPercent} />
        <MixSlider label="Bonds" value={100 - percent} onChange={(next) => setPercent(100 - next)} />
        <button
          type="button"
          disabled={busy}
          onClick={run}
          className="h-8 rounded-lg bg-[#3a8a58] text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "…" : "Run Mach Rewind"}
        </button>
      </div>
    </div>
  );
}

function MixSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-[#3d4a54]">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label={`${label} percent`}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(100, Math.max(0, Math.round(next))));
        }}
        className="h-1.5 min-w-0 flex-1 accent-[#3a8a58]"
      />
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-[#1a2330]">{value}%</span>
    </label>
  );
}

function shortFailed(years: number[]): string {
  const shown = years.slice(0, 3);
  const rest = years.length - shown.length;
  const list = historicalList(shown);
  return rest > 0 ? `Failed ${list}, and ${rest} more.` : `Failed ${list}.`;
}

function historicalList(years: number[]): string {
  if (years.length <= 1) return String(years[0] ?? "");
  if (years.length === 2) return `${years[0]} and ${years[1]}`;
  return `${years.slice(0, -1).join(", ")}, and ${years[years.length - 1]}`;
}
