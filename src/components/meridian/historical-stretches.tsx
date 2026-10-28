import { useEffect, useRef, useState } from "react";
import { runHistorical, type HistoricalCount } from "@/lib/plan/historical-run";
import { planInputSignature } from "@/lib/plan/input-signature";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/plan/types";

const card =
  "pointer-events-auto relative flex flex-col rounded-2xl bg-white/95 px-4 py-3.5 shadow-[0_10px_28px_rgba(26,35,48,0.14),0_0_0_1px_#d5d0c6] backdrop-blur-sm";

export const FORWARD_NOTE =
  "1,000 random markets, centered on the return you typed in Observe. The number is how many of 100 still have money you can spend at longevity. This is not the past.";

export const BACK_NOTE =
  "The same plan, laid on every real stretch of U.S. market history long enough to reach longevity. The number is how many of those stretches lasted. Cash, a house, and an annuity keep their rates.";

export function CardHelp({ note }: { note: string }) {
  return (
    <>
      <button
        type="button"
        aria-label="What this card means"
        className="peer absolute right-2.5 top-2.5 z-20 flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold text-[#6b7280] hover:bg-[#f4f1ea] hover:text-[#1a2330] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2330]"
      >
        ?
      </button>
      <p className="pointer-events-none invisible absolute inset-x-3 top-9 z-30 rounded-lg bg-[#1a2330] px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg peer-hover:visible peer-hover:opacity-100 peer-focus:visible peer-focus:opacity-100">
        {note}
      </p>
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
        Mach Forward (Future Performance)
      </p>
      <p className="mt-1 font-display text-[2.6rem] font-semibold tabular-nums leading-none tracking-tight text-[#1a2330]">
        {score}
      </p>
      <p className="mt-1 text-sm leading-snug text-[#1a2330]">of 100 still have money at age {longevityAge}</p>
      <p className="mt-2 text-xs leading-relaxed text-[#3d4a54] sm:min-h-0 sm:flex-1 sm:overflow-hidden">
        One thousand random markets, centered on the return you typed in Observe. This is not a look at the past.
        {runOutAge != null && failed > 0 ? ` In the futures that run out, the middle one is age ${runOutAge}.` : ""}
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

  useEffect(() => {
    setCount(null);
  }, [signature]);

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
    }, 0);
  }

  const all = count != null && count.total > 0 && count.failedStartYears.length === 0;
  const failedLine = count && count.failedStartYears.length > 0 ? shortFailed(count.failedStartYears) : null;

  return (
    <div className={cn(card, className ?? "w-[min(100%,18rem)]")}>
      <CardHelp note={BACK_NOTE} />
      <p className="pr-6 text-[10px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
        Mach Back (Past Performance)
      </p>
      {count && count.total > 0 ? (
        <>
          <p
            className={
              "mt-1 font-display text-[2.6rem] font-semibold tabular-nums leading-none tracking-tight " +
              (all ? "text-[#3a8a58]" : "text-[#1a2330]")
            }
          >
            {count.survived}
          </p>
          <p className="mt-1 text-sm leading-snug text-[#1a2330]">
            of {count.total} real stretches lasted, at {used}% stocks. The rest is bonds.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#3d4a54] sm:min-h-0 sm:flex-1 sm:overflow-hidden">
            The same plan, laid on every real stretch of U.S. market history long enough to reach longevity. Investable
            accounts use that stock percent. The rest is bonds. Cash, a house, and an annuity keep your rates.
            {failedLine ? ` ${failedLine}` : ""}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-[#3d4a54] sm:min-h-0 sm:flex-1 sm:overflow-hidden">
          {count?.total === 0
            ? "No stretch in the table is long enough for this plan."
            : "The same plan, laid on every real stretch of U.S. market history long enough to reach longevity. Investable accounts use the stock percent. The rest is bonds. Cash, a house, and an annuity keep your rates."}
        </p>
      )}
      <div className="mt-3 flex shrink-0 flex-col gap-2">
        <MixSlider label="Stocks" value={percent} onChange={setPercent} />
        <MixSlider label="Bonds" value={100 - percent} onChange={(next) => setPercent(100 - next)} />
        <button
          type="button"
          disabled={busy}
          onClick={run}
          className="h-8 rounded-lg bg-[#3a8a58] text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "…" : "Run"}
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
