import { downloadAnalysisPdf } from "@/lib/plan/analysis-pdf";
import type { PeerBrief } from "@/lib/plan/peers";
import type { Plan, SimResult } from "@/lib/plan/types";
import { UpgradeNudge } from "@/components/meridian/upgrade-nudge";

export function PeerBriefCard({
  brief,
  ran,
  plan,
  sim,
}: {
  brief: PeerBrief | null;
  ran: boolean;
  plan?: Plan;
  sim?: SimResult;
}) {
  if (!ran) {
    return (
      <div className="rounded-xl bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--color-border)]">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
          MACH OODA Financial Analysis*
        </p>
        <p className="mt-2 font-display text-lg text-fg">
          Waiting on Calculate.
        </p>
        <p className="mt-2 text-sm text-muted">
          Finish Observe, Orient, or Decide and hit Calculate. MACH will rank
          this household against U.S. peers by age, income, and net worth — then
          the charts will move.
        </p>
      </div>
    );
  }

  if (!brief) return null;

  return (
    <div className="rounded-xl bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--color-border)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
          MACH OODA Financial Analysis*
        </p>
        {plan && sim ? (
          <button
            type="button"
            onClick={() => downloadAnalysisPdf(brief, plan, sim)}
            className="h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
          >
            Save PDF
          </button>
        ) : null}
      </div>
      <p className="mt-2 font-display text-xl font-medium leading-snug text-fg">
        {brief.headline}
      </p>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">
        {brief.paragraphs.map((p, i) => (
          <p key={`${brief.runAt}-${i}`}>{p}</p>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-subtle">
        Net worth bands: Federal Reserve Survey of Consumer Finances (2022),
        shown in 2026 dollars. Income bands: U.S. Census household money income,
        stepped forward. This is a sketch against national peers, not a
        neighborhood, not a credit score, not advice.
      </p>
      {brief.expanded ? null : (
        <div className="mt-4">
          <UpgradeNudge kind="analysis" />
        </div>
      )}
    </div>
  );
}
