import { Link } from "@tanstack/react-router";
import { downloadAnalysisPdf } from "@/lib/plan/analysis-pdf";
import type { PeerBrief } from "@/lib/plan/peers";
import type { Plan, SimResult } from "@/lib/plan/types";
import { GuestOnly, RealSignedIn } from "@/lib/auth/gates";
import { MACH_MONTHLY_USD } from "@/lib/billing/limits";
import { NestEggHeadline } from "@/components/meridian/verdict";
import { nestEggTrack } from "@/lib/plan/peers";

function Disclaimer() {
  return <p className="text-xs italic leading-relaxed text-subtle">{OODA_DISCLAIMER}</p>;
}

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
          Finish Observe, Orient, or Decide and hit Calculate. MACH RUN will rank
          this household against U.S. peers by age, income, and net worth — then
          the charts will move.
        </p>
      </div>
    );
  }

  if (!brief) return null;

  const sections = brief.sections?.length
    ? brief.sections
    : brief.paragraphs.map((body) => ({ title: "", body }));
  const clipped = !brief.expanded && sections.length > 2;
  const visible = clipped ? sections.slice(0, 2) : sections;
  const faded = clipped ? sections[2] : null;

  const egg = plan && sim ? nestEggTrack(plan, sim) : null;

  return (
    <div className="rounded-xl bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--color-border)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
          MACH OODA Financial Analysis*
        </p>
        {plan && sim && brief.expanded ? (
          <button
            type="button"
            onClick={() => void downloadAnalysisPdf(brief, plan, sim)}
            className="h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
          >
            Save PDF
          </button>
        ) : null}
      </div>
      <div className="mt-3">
        <Disclaimer />
      </div>
      <p className="mt-3 font-display text-xl font-medium leading-snug text-fg">
        {egg ? <NestEggHeadline egg={egg} /> : brief.headline}
      </p>
      <div className="mt-3 flex flex-col gap-4 text-sm leading-relaxed text-muted">
        {visible.map((s, i) => (
          <div key={`${brief.runAt}-${i}`}>
            {s.title ? (
              <p className="font-semibold text-fg">{s.title}</p>
            ) : null}
            <p className={s.title ? "mt-1 whitespace-pre-line" : "whitespace-pre-line"}>{s.body}</p>
          </div>
        ))}
        {faded ? (
          <div className="relative max-h-[5.5rem] overflow-hidden">
            {faded.title ? (
              <p className="font-semibold text-fg" aria-hidden>
                {faded.title}
              </p>
            ) : null}
            <p aria-hidden>{faded.body}</p>
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface from-[18%] via-surface/75 to-transparent"
              aria-hidden
            />
          </div>
        ) : null}
      </div>
      {clipped ? (
        <div className="mt-4 flex flex-col items-center gap-2 border-t border-border pt-4 text-center">
          <GuestOnly>
            <p className="text-sm text-muted">
              The rest of this OODA is behind a login.
            </p>
            <Link
              to="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
            >
              Sign in to keep this MACH Run
            </Link>
          </GuestOnly>
          <RealSignedIn>
            <p className="text-sm text-muted">
              The rest of this OODA — RMDs, retirement landing, every stage —
              is on MACH RUN Unlimited.
            </p>
            <Link
              to="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
            >
              Unlock the full MACH OODA — ${MACH_MONTHLY_USD}/month
            </Link>
          </RealSignedIn>
        </div>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-subtle">
          Net worth bands: Federal Reserve Survey of Consumer Finances (2022),
          shown in 2026 dollars. Income bands: U.S. Census household money
          income, stepped forward. This is a sketch against national peers, not
          a neighborhood, not a credit score, not advice.
        </p>
      )}
      <div className="mt-4 border-t border-border pt-4">
        <Disclaimer />
      </div>
    </div>
  );
}
