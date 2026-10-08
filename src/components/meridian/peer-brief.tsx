import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { downloadAnalysisPdf } from "@/lib/plan/analysis-pdf";
import type { SurvivalScore } from "@/lib/plan/monte-carlo-run";
import type { BriefColumnRow, BriefSection, PeerBrief } from "@/lib/plan/peers";
import type { IncomeStream, Plan, SimResult } from "@/lib/plan/types";
import { GuestOnly, RealSignedIn } from "@/lib/auth/gates";
import { MACH_MONTHLY_USD, hasBalanceSheet } from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { OODA_DISCLAIMER } from "@/lib/plan/disclaimer";
import { NestEggHeadline } from "@/components/meridian/verdict";
import { CashShortNotice } from "@/components/meridian/cash-short-notice";
import { nestEggTrack } from "@/lib/plan/peers";
import { annuityEquivalentCopy } from "@/lib/plan/annuity-equivalent";
import { Field, MoneyInput, MonthInput, PrimaryButton, TextInput } from "@/components/ui/field";
import { paycheckFromMonthly } from "@/lib/plan/pay-cadence";
import { usePlanStore } from "@/lib/plan/store";
import { InstitutionMark } from "@/components/meridian/institution-field";

function Disclaimer() {
  return <p className="text-xs italic leading-relaxed text-subtle">{OODA_DISCLAIMER}</p>;
}

function BriefBody({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return (
      <p className={className ? `${className} whitespace-pre-line` : "whitespace-pre-line"}>{text}</p>
    );
  }
  return (
    <div className={className ? `${className} flex flex-col gap-4` : "flex flex-col gap-4"}>
      {parts.map((part, i) => (
        <p key={i} className="whitespace-pre-line">
          {part}
        </p>
      ))}
    </div>
  );
}

function BriefTable({
  intro,
  note,
  headers,
  rows,
  logos,
  footer,
  onRow,
}: {
  intro: string;
  note?: string;
  headers: { label: string; align?: "left" | "right"; nowrap?: boolean }[];
  rows: string[][];
  logos?: { institutionId: string | null; institutionName: string }[];
  footer?: string[];
  onRow?: (index: number) => void;
}) {
  return (
    <div className="mt-1">
      {intro ? <p>{intro}</p> : null}
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
              <tr
                key={row.join("|") + i}
                className={
                  "border-t border-border/70 " +
                  (onRow ? "cursor-pointer hover:bg-elevated/70" : "")
                }
                onClick={onRow ? () => onRow(i) : undefined}
                onKeyDown={
                  onRow
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRow(i);
                        }
                      }
                    : undefined
                }
                tabIndex={onRow ? 0 : undefined}
                role={onRow ? "button" : undefined}
                aria-label={onRow ? `Edit ${row[0]}` : undefined}
              >
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
                      {j === 0 && logos?.[i]?.institutionName ? (
                        <span className="inline-flex items-center gap-2">
                          <span>{cell}</span>
                          <InstitutionMark
                            institutionId={logos[i].institutionId}
                            institutionName={logos[i].institutionName}
                            size={20}
                          />
                        </span>
                      ) : (
                        cell
                      )}
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

type PaycheckDraft = {
  name: string;
  monthly: number;
  start: string;
  end: string | null;
};

function amountIsCalculated(kind: IncomeStream["kind"]): boolean {
  return kind === "ss" || kind === "va";
}

function PaycheckTable({
  intro,
  note,
  rows,
  onExecute,
  onStale,
}: {
  intro: string;
  note: string;
  rows: BriefColumnRow[];
  onExecute?: () => void;
  onStale?: () => void;
}) {
  const updateIncome = usePlanStore((s) => s.updateIncome);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraftState] = useState<PaycheckDraft | null>(null);
  const draftRef = useRef<PaycheckDraft | null>(null);
  const [ask, setAsk] = useState(false);

  function setDraft(next: PaycheckDraft | null) {
    draftRef.current = next;
    setDraftState(next);
  }

  function patchDraft(patch: Partial<PaycheckDraft>) {
    const base = draftRef.current;
    if (!base) return;
    setDraft({ ...base, ...patch });
  }

  const income = usePlanStore((s) =>
    editingId ? s.plan.incomes.find((row) => row.id === editingId) ?? null : null,
  );
  const locked = income ? amountIsCalculated(income.kind) : false;
  const shown = rows.find((row) => row.id === editingId);

  function open(index: number) {
    const row = rows[index];
    if (!row?.id) return;
    const live = usePlanStore.getState().plan.incomes.find((item) => item.id === row.id);
    if (!live) return;
    setEditingId(live.id);
    setDraft({
      name: live.name,
      monthly: live.monthlyAmount,
      start: live.startDate || "",
      end: live.endDate,
    });
  }

  function close() {
    setEditingId(null);
    setDraft(null);
  }

  function save() {
    const current = draftRef.current;
    if (!income || !current) return;
    const name = current.name.trim();
    const patch: Partial<IncomeStream> = { name: name || income.name };
    if (!locked) {
      patch.monthlyAmount = current.monthly;
      if (income.payCadence === "week" || income.payCadence === "biweek" || income.payCadence === "year") {
        patch.payAmount = paycheckFromMonthly(current.monthly, income.payCadence);
      }
    }
    if (current.start) {
      patch.startDate = current.start;
      if (current.start !== income.startDate) patch.startDayAfterPrevious = false;
    }
    patch.endDate = current.end && current.end.trim() ? current.end : null;
    if (
      income.kind === "ss" &&
      (patch.startDate !== income.startDate || patch.endDate !== income.endDate)
    ) {
      patch.ssEstimated = false;
    }
    updateIncome(income.id, patch);
    close();
    setAsk(true);
  }

  return (
    <div>
      <BriefTable
        intro={intro}
        note={note}
        headers={[
          { label: "Income" },
          { label: "Monthly", align: "right", nowrap: true },
          { label: "When", nowrap: true },
        ]}
        rows={rows.map((r) => [r.name, r.amount, r.window])}
        onRow={open}
      />
      {ask ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm leading-relaxed text-fg">
            This edit is saved. Re-execute the MACH RUN to score it.
          </p>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              className="h-9 w-auto px-3 text-sm"
              onClick={() => {
                setAsk(false);
                onExecute?.();
              }}
            >
              Execute the MACH RUN
            </PrimaryButton>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted hover:text-fg"
              onClick={() => {
                setAsk(false);
                onStale?.();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {income && draft ? (
        <div
          className="fixed inset-0 z-[140] grid place-items-center bg-black/60 px-4"
          role="presentation"
          onMouseDown={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="paycheck-edit-title"
            className="w-full max-w-md rounded-xl bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--color-border)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p id="paycheck-edit-title" className="font-semibold text-fg">
              Edit {shown?.name || income.name || "paycheck"}
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <Field label="Name">
                <TextInput
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                />
              </Field>
              {locked ? (
                <Field
                  label="Monthly"
                  hint="This amount comes from the Income section."
                >
                  <p className="text-sm tabular-nums text-fg">{shown?.amount}</p>
                </Field>
              ) : (
                <Field label="Monthly">
                  <MoneyInput
                    value={draft.monthly}
                    onValue={(n) => patchDraft({ monthly: n })}
                  />
                </Field>
              )}
              <Field label="Start">
                <MonthInput
                  value={draft.start}
                  onValue={(v) => patchDraft({ start: v })}
                />
              </Field>
              <Field label="End (blank = keeps paying)">
                <MonthInput
                  clearable
                  value={draft.end}
                  onValue={(v) => patchDraft({ end: v || null })}
                />
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <PrimaryButton className="h-9 w-auto px-3 text-sm" onClick={save}>
                Save
              </PrimaryButton>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted hover:text-fg"
                onClick={close}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PeerBriefCard({
  brief,
  ran,
  plan,
  sim,
  onExecute,
  onStale,
  survival,
}: {
  brief: PeerBrief | null;
  ran: boolean;
  plan?: Plan;
  sim?: SimResult;
  onExecute?: () => void;
  onStale?: () => void;
  survival?: SurvivalScore | null;
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

  const sections: BriefSection[] = brief.sections?.length
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
              void downloadAnalysisPdf(brief, plan, sim, {
                includeNetWorth,
                survival: survival ?? null,
              });
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
      {sim && plan ? (
        <div className="mt-3">
          <CashShortNotice sim={sim} plan={plan} />
        </div>
      ) : null}
      <div className="mt-3 flex flex-col gap-4 text-sm leading-relaxed text-muted">
        {visible.map((s, i) => (
          <div key={`${brief.runAt}-${i}`}>
            {s.variant === "annuity" && annuityCopy ? (
              <>
                <p className="text-sm font-semibold text-fg">{s.title}</p>
                <p className="mt-1">{s.body}</p>
                <details className="mt-1 rounded-lg bg-bg px-4 py-3 shadow-[0_0_0_1px_var(--color-border)]">
                  <summary className="cursor-pointer text-sm font-medium text-fg">
                    View guaranteed-paycheck equivalent (estimate)
                  </summary>
                  <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
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
              </>
            ) : (
              <>
                {s.title ? <p className="font-semibold text-fg">{s.title}</p> : null}
                {s.table?.rows.length ? (
                  <BriefTable
                    intro={s.table.intro}
                    note={s.table.note}
                    headers={s.table.headers}
                    rows={s.table.rows}
                    logos={s.table.logos}
                    footer={s.table.footer}
                  />
                ) : s.columns?.rows.length ? (
                  <PaycheckTable
                    intro={s.columns.intro}
                    note={s.columns.note}
                    rows={s.columns.rows}
                    onExecute={onExecute}
                    onStale={onStale}
                  />
                ) : (
                  <BriefBody text={s.body} className={s.title ? "mt-1" : undefined} />
                )}
              </>
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
            <div aria-hidden>
              <BriefBody text={faded.body} />
            </div>
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
              Sign in or create an account to view your MACH Analysis.
            </p>
            <Link
              to="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
            >
              Sign in to keep this MACH RUN
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
