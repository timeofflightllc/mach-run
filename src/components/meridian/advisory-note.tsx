import { useEffect, useState } from "react";
import { openAdvisories, type Advisory } from "@/lib/plan/advisories";
import { usePlanStore } from "@/lib/plan/store";
import type { Plan } from "@/lib/plan/types";

const YELLOW = {
  background: "color-mix(in oklab, #e8c547 12%, transparent)",
  boxShadow: "0 0 0 1px color-mix(in oklab, #e8c547 45%, transparent)",
} as const;

export function useOpenAdvisories(): Advisory[] {
  const plan = usePlanStore((s) => s.plan);
  const [rows, setRows] = useState<Advisory[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => setRows(openAdvisories(plan)), 200);
    return () => window.clearTimeout(timer);
  }, [plan]);
  return rows;
}

export function AdvisoryNote({ advisory }: { advisory?: Advisory }) {
  const confirmAdvisory = usePlanStore((s) => s.confirmAdvisory);
  const updateIncome = usePlanStore((s) => s.updateIncome);
  const updateSpending = usePlanStore((s) => s.updateSpending);
  if (!advisory) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-sm leading-relaxed text-fg" style={YELLOW}>
      <p>{advisory.body}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="h-9 rounded-lg bg-[#e8c547] px-3 text-sm font-medium text-[#1a1404]"
          onClick={() => confirmAdvisory(advisory.id, advisory.fingerprint)}
        >
          {advisory.keep}
        </button>
        {advisory.endOther ? (
          <button
            type="button"
            className="h-9 rounded-lg px-3 text-sm font-medium text-[#5c4a18]"
            onClick={() => {
              const end = advisory.endOther;
              if (!end) return;
              if (end.kind === "income") updateIncome(end.id, { endDate: end.endDate });
              else updateSpending(end.id, { endDate: end.endDate });
            }}
          >
            End the other when this starts
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AdvisoryStrip({
  onOpen,
}: {
  onOpen: (step: Advisory["step"], cardId: string) => void;
}) {
  const rows = useOpenAdvisories();
  if (!rows.length) return null;
  return (
    <div className="rounded-lg px-4 py-3 text-sm leading-relaxed text-fg" style={YELLOW}>
      <p className="font-semibold text-[#e8c547]">Unanswered. Calculate still runs.</p>
      <ul className="mt-2 flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className="text-left text-fg underline decoration-[#e8c547]/70 underline-offset-2"
              onClick={() => onOpen(row.step, row.cardId)}
            >
              {row.name}
            </button>
            <span className="text-muted"> — {row.body}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function cashAdvisoryStillOpen(plan: Plan): boolean {
  return openAdvisories(plan).some((row) => row.kind === "cash");
}
