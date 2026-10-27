import { useEffect, useRef, useState } from "react";
import { Field, NumberInput, PrimaryButton } from "@/components/ui/field";
import { historicalSentence, runHistorical } from "@/lib/plan/historical-run";
import { planInputSignature } from "@/lib/plan/input-signature";
import type { Plan } from "@/lib/plan/types";

export function HistoricalStretches({ plan }: { plan: Plan }) {
  const [percent, setPercent] = useState(60);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const signature = planInputSignature(plan);
  const signatureRef = useRef(signature);
  signatureRef.current = signature;

  useEffect(() => {
    setLine(null);
  }, [signature]);

  function run() {
    const used = Math.min(100, Math.max(0, percent));
    const ranFor = signatureRef.current;
    setBusy(true);
    window.setTimeout(() => {
      const count = runHistorical(plan, used);
      setBusy(false);
      if (signatureRef.current !== ranFor) return;
      setLine(historicalSentence(count, used));
    }, 0);
  }

  return (
    <div className="rounded-xl bg-white px-5 py-4 shadow-[0_0_0_1px_#d5d0c6]">
      <p className="text-sm font-semibold text-[#1a2330]">Historical stretches</p>
      <p className="mt-1 text-sm leading-relaxed text-[#3d4a54]">
        The rest is bonds. Cash, a house, and an annuity keep your rates.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="Percent in stocks" className="w-36">
          <NumberInput
            min={0}
            max={100}
            step={1}
            value={percent}
            onValue={(n) => setPercent(Math.min(100, Math.max(0, n)))}
          />
        </Field>
        <PrimaryButton className="h-11 w-auto px-4" disabled={busy} onClick={run}>
          {busy ? "Running…" : "Run historical stretches"}
        </PrimaryButton>
      </div>
      {line ? <p className="mt-3 text-sm font-medium leading-relaxed text-[#1a2330]">{line}</p> : null}
    </div>
  );
}
