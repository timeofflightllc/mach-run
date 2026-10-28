import { useEffect, useRef, useState } from "react";
import { runHistorical, type HistoricalCount } from "@/lib/plan/historical-run";
import { planInputSignature } from "@/lib/plan/input-signature";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/plan/types";

const card =
  "pointer-events-auto flex flex-col rounded-2xl bg-white/95 px-4 py-3.5 shadow-[0_10px_28px_rgba(26,35,48,0.14),0_0_0_1px_#d5d0c6] backdrop-blur-sm";

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
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#6b7280]">Futures</p>
      <p className="mt-1 font-display text-[2.6rem] font-semibold tabular-nums leading-none tracking-tight text-[#1a2330]">
        {score}
      </p>
      <p className="mt-1 text-sm leading-snug text-[#1a2330]">of 100 still have money at age {longevityAge}</p>
      <p className="mt-2 min-h-0 flex-1 overflow-hidden text-xs leading-relaxed text-[#3d4a54]">
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
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#6b7280]">Past</p>
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
            of {count.total} real stretches lasted, at {used}% stocks
          </p>
          <p className="mt-2 min-h-0 flex-1 overflow-hidden text-xs leading-relaxed text-[#3d4a54]">
            The same plan, laid on every real stretch of U.S. market history long enough to reach longevity. Investable
            accounts use that stock percent. The rest is bonds. Cash, a house, and an annuity keep your rates.
            {failedLine ? ` ${failedLine}` : ""}
          </p>
        </>
      ) : (
        <p className="mt-2 min-h-0 flex-1 overflow-hidden text-xs leading-relaxed text-[#3d4a54]">
          {count?.total === 0
            ? "No stretch in the table is long enough for this plan."
            : "The same plan, laid on every real stretch of U.S. market history long enough to reach longevity. Investable accounts use the stock percent. The rest is bonds. Cash, a house, and an annuity keep your rates."}
        </p>
      )}
      <div className="mt-3 flex shrink-0 items-center gap-1.5">
        <span className="text-xs text-[#3d4a54]">Stocks</span>
        <input
          type="number"
          min={0}
          max={100}
          aria-label="Percent in stocks"
          value={percent}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) setPercent(Math.min(100, Math.max(0, next)));
          }}
          className="h-8 w-14 rounded-lg bg-white text-center text-sm tabular-nums text-[#1a2330] shadow-[0_0_0_1px_#d5d0c6] outline-none"
        />
        <button
          type="button"
          disabled={busy}
          onClick={run}
          className="h-8 flex-1 rounded-lg bg-[#3a8a58] text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "…" : "Run"}
        </button>
      </div>
    </div>
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
