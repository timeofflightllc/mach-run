import { Link } from "@tanstack/react-router";
import { downloadAnalysisPdf } from "@/lib/plan/analysis-pdf";
import type { BriefColumnRow, PeerBrief } from "@/lib/plan/peers";
import type { Plan, SimResult } from "@/lib/plan/types";
import { GuestOnly, RealSignedIn } from "@/lib/auth/gates";
import { MACH_MONTHLY_USD, hasBalanceSheet } from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { OODA_DISCLAIMER } from "@/lib/plan/disclaimer";
import { NestEggHeadline } from "@/components/meridian/verdict";
import { nestEggTrack } from "@/lib/plan/peers";
import { annuityEquivalentCopy } from "@/lib/plan/annuity-equivalent";
import { PrimaryButton } from "@/components/ui/field";

function Disclaimer() {
  return <p className="text-xs italic leading-relaxed text-subtle">{OODA_DISCLAIMER}</p>;
}

function BriefTable({
  intro,
  note,
  headers,
  rows,
  footer,
}: {
  intro: string;
  note?: string;
  headers: { label: string; align?: "left" | "right"; nowrap?: boolean }[];
  rows: string[][];
  footer?: string[];
}) {
  return (
    <div className="mt-1">
      <p>{intro}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-subtle">
              {headers.map((h) => (
                <th
                  key={h.label}
                  className={
                    "pb-1.5 pr-4 font-medium last:pr-0 " +
                    (h.align === "right" ? "text-right" : "")
                  }
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.join("|") + i} className="border-t border-border/70">
                {row.map((cell, j) => {
                  const h = headers[j];
                  return (
                    <td
                      key={`${i}-${j}`}
                      className={
                        "py-1.5 pr-4 last:pr-0 " +
                        (j === 0 ? "text-fg " : "text-muted ") +
                        (h?.align === "right" ? "text-right tabular-nums " : "") +
                        (h?.nowrap ? "whitespace-nowrap " : "")
                      }
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
            {footer ? (
              <tr className="border-t border-border">
                {footer.map((cell, j) => {
                  const h = headers[j];
                  return (
                    <td
                      key={`f-${j}`}
                      className={
                        "py-1.5 pr-4 last:pr-0 font-medium text-fg " +
                        (h?.align === "right" ? "text-right tabular-nums " : "") +
                        (h?.nowrap ? "whitespace-nowrap " : "")
                      }
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {note ? <p className="mt-2 text-xs leading-relaxed text-subtle">{note}</p> : null}
    </div>
  );
}

function PaycheckTable({
  intro,
  note,
  rows,
}: {
  intro: string;
  note: string;
  rows: BriefColumnRow[];
}) {
  return (
    <BriefTable
      intro={intro}
      note={note}
      headers={[
        { label: "Income" },
        { label: "Monthly", align: "right", nowrap: true },
        { label: "When", nowrap: true },
      ]}
      rows={rows.map((r) => [r.name, r.amount, r.window])}
    />
  );
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
  const ent = useEntitlement();
  const includeNetWorth = hasBalanceSheet(ent.plan);
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
  const annuityCopy = brief.annuityEquivalent
    ? annuityEquivalentCopy(brief.annuityEquivalent)
    : null;

  return (
    <div className="rounded-xl bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--color-border)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
          MACH OODA Financial Analysis*
        </p>
        {plan && sim && brief.expanded ? (
          <PrimaryButton
            onClick={() => {
              void downloadAnalysisPdf(brief, plan, sim, { includeNetWorth });
              void import("@/lib/ops/activity-api").then(({ pingActivity }) => {
                pingActivity("pdf");
              });
            }}
            className="w-auto shrink-0 px-4"
          >
            Save / Print PDF
          </PrimaryButton>
        ) : null}
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
            {s.table?.rows.length ? (
              <BriefTable
                intro={s.table.intro}
                note={s.table.note}
                headers={s.table.headers}
                rows={s.table.rows}
                footer={s.table.footer}
              />
            ) : s.columns?.rows.length ? (
              <PaycheckTable
                intro={s.columns.intro}
                note={s.columns.note}
                rows={s.columns.rows}
              />
            ) : (
              <p className={s.title ? "mt-1 whitespace-pre-line" : "whitespace-pre-line"}>
                {s.body}
              </p>
            )}
          </div>
        ))}
        {faded ? (
          <div className="relative max-h-[5.5rem] overflow-hidden">
            {faded.title ? (
              <p className="font-semibold text-fg" aria-hidden>
                {faded.title}
              </p>
            ) : null}
            <p aria-hidden className="whitespace-pre-line">
              {faded.body}
            </p>
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface from-[18%] via-surface/75 to-transparent"
              aria-hidden
            />
          </div>
        ) : null}
      </div>
      {annuityCopy ? (
        <details className="mt-4 rounded-lg bg-bg px-4 py-3 shadow-[0_0_0_1px_var(--color-border)]">
          <summary className="cursor-pointer text-sm font-medium text-fg">
            View guaranteed-paycheck equivalent (estimate)
          </summary>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            <p className="font-semibold text-fg">{annuityCopy.title}</p>
            <BriefTable
              intro={annuityCopy.intro}
              note={annuityCopy.note}
              headers={[
                { label: "Income" },
                { label: "When", nowrap: true },
                { label: "Lump sum today", align: "right", nowrap: true },
                { label: "Running total", align: "right", nowrap: true },
              ]}
              rows={annuityCopy.rows.map((r) => [r.name, r.when, r.amount, r.running])}
              footer={
                annuityCopy.rows.length > 1
                  ? ["All together", "", "", annuityCopy.total]
                  : undefined
              }
            />
          </div>
        </details>
      ) : null}
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
          Net worth comparison uses Federal Reserve Survey of Consumer Finances
          (2022) percentiles by age, expressed in 2026 dollars. Income comparison
          uses U.S. Census household money-income percentiles, adjusted to 2026.
          Rank is a national household comparison. It is not a local ranking, a
          credit score, or financial advice.
        </p>
      )}
      <div className="mt-4 border-t border-border pt-4">
        <Disclaimer />
      </div>
    </div>
  );
}
