import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AdvisoryNote, useOpenAdvisories } from "@/components/meridian/advisory-note";
import { ConfirmRemove } from "@/components/meridian/confirm-remove";
import { usePlannerCopy } from "@/components/meridian/use-planner-copy";
import {
  DangerButton,
  DateInput,
  Field,
  GhostButton,
  MonthYearMoney,
  PrimaryButton,
  TextInput,
} from "@/components/ui/field";
import type { Advisory } from "@/lib/plan/advisories";
import { blankEndLabel, dateAtAge, iso, monthAfter, projectionEndMonth, validIso } from "@/lib/plan/dates";
import { usd } from "@/lib/plan/format";
import { newId, usePlanStore } from "@/lib/plan/store";
import type { Plan, SpendingPhase } from "@/lib/plan/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const summaryCols =
  "@min-[46rem]:grid @min-[46rem]:min-w-[48rem] @min-[46rem]:grid-cols-[minmax(9rem,1.4fr)_minmax(10rem,12rem)_14rem_7.25rem] @min-[46rem]:items-center @min-[46rem]:gap-x-4";
const control = "h-10 max-w-none";

function shortDate(value: string | null | undefined): string {
  if (!value) return "ongoing";
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return "ongoing";
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

function whenLabel(plan: Plan, phase: SpendingPhase): string {
  const end = phase.endDate
    ? shortDate(phase.endDate)
    : projectionEndMonth(plan.primary.birthDate, plan.assumptions.projectionEndAge);
  return `${shortDate(phase.startDate)} → ${end}`;
}

function monthKey(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})/.exec(value ?? "");
  return match ? `${match[1]}-${match[2]}` : "9999-12";
}

function endSortKey(plan: Plan, phase: SpendingPhase): string {
  if (phase.endDate) return monthKey(phase.endDate);
  const birth = plan.primary.birthDate;
  const age = plan.assumptions.projectionEndAge;
  if (birth && validIso(birth) && Number.isFinite(age)) return monthKey(iso(dateAtAge(birth, age)));
  return "9999-12";
}

function sortedSpending(plan: Plan, spending: SpendingPhase[]): SpendingPhase[] {
  return spending
    .map((phase, index) => ({ phase, index }))
    .sort((a, b) => {
      const byStart = monthKey(a.phase.startDate).localeCompare(monthKey(b.phase.startDate));
      if (byStart !== 0) return byStart;
      const byEnd = endSortKey(plan, a.phase).localeCompare(endSortKey(plan, b.phase));
      if (byEnd !== 0) return byEnd;
      return a.index - b.index;
    })
    .map((row) => row.phase);
}

export function SpendingForm() {
  const plan = usePlanStore((s) => s.plan);
  const addSpending = usePlanStore((s) => s.addSpending);
  const removeSpending = usePlanStore((s) => s.removeSpending);
  const advisories = useOpenAdvisories();
  const copy = usePlannerCopy();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const sortTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (sortTimer.current != null) window.clearTimeout(sortTimer.current);
    };
  }, []);

  function orderedIds(): string[] {
    const live = plan.spending.map((phase) => phase.id);
    const have = new Set(live);
    if (frozen) {
      const kept = frozen.filter((id) => have.has(id));
      for (const id of live) {
        if (!kept.includes(id)) kept.push(id);
      }
      return kept;
    }
    return sortedSpending(plan, plan.spending).map((phase) => phase.id);
  }

  function holdOrder() {
    setFrozen((current) => current ?? orderedIds());
  }

  function releaseOrder() {
    if (sortTimer.current != null) window.clearTimeout(sortTimer.current);
    sortTimer.current = window.setTimeout(() => {
      sortTimer.current = null;
      setFrozen(null);
      const live = usePlanStore.getState().plan;
      const next = sortedSpending(live, live.spending);
      const same = next.every((row, index) => row.id === live.spending[index]?.id);
      if (!same) usePlanStore.getState().setPlan({ ...live, spending: next });
    }, 320);
  }

  const rows = orderedIds()
    .map((id) => plan.spending.find((phase) => phase.id === id))
    .filter((phase): phase is SpendingPhase => Boolean(phase));

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-4 2xl:max-w-[90rem] min-[2000px]:max-w-[110rem]">
      {copy.spendingBody.trim() ? (
        <p className="whitespace-pre-wrap text-sm text-muted">{copy.spendingBody}</p>
      ) : null}
      <ul className={`flex flex-col gap-2 overflow-x-auto ${summaryCols}`}>
        {rows.length > 0 ? (
          <li className="col-span-full hidden grid-cols-subgrid items-center text-[0.7rem] font-medium uppercase tracking-[0.12em] text-subtle @min-[46rem]:grid">
            <span className="min-w-0 pl-3">Name</span>
            <span className="min-w-0">Amount</span>
            <span className="min-w-0">When</span>
            <span className="pr-3" />
          </li>
        ) : null}
        {rows.map((phase, index) => (
          <SpendingRow
            key={phase.id}
            phase={phase}
            index={index}
            previous={index > 0 ? rows[index - 1] : null}
            open={openId === phase.id}
            advisory={advisories.find((row) => row.cardId === `card-spending-${phase.id}`)}
            onEdit={() => {
              holdOrder();
              setOpenId(phase.id);
            }}
            onSave={() => {
              setOpenId(null);
              releaseOrder();
            }}
            onRemove={() => setPendingRemove(phase.id)}
          />
        ))}
      </ul>
      <GhostButton
        onClick={() => {
          const id = newId("sp");
          const base = frozen ?? sortedSpending(plan, plan.spending).map((phase) => phase.id);
          setFrozen([...base, id]);
          addSpending({
            id,
            label: "",
            monthlyAmount: 0,
            startDate: plan.assumptions.asOfDate,
            endDate: null,
          });
          setOpenId(id);
        }}
      >
        <Plus className="size-4" />
        Add spending phase
      </GhostButton>
      {pendingRemove ? (
        <ConfirmRemove
          title="Remove spending"
          body={
            plan.spending.find((row) => row.id === pendingRemove)?.liabilityId
              ? "This line was created from a liability. Removing it turns off automatic inclusion in spending. The loan itself stays."
              : "Are you sure you want to remove this spending phase? This cannot be undone."
          }
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            const phase = plan.spending.find((row) => row.id === pendingRemove);
            if (phase?.liabilityId) {
              usePlanStore.getState().updateLiability(phase.liabilityId, { includeInSpending: false });
            } else {
              removeSpending(pendingRemove);
            }
            setFrozen((current) => current?.filter((id) => id !== pendingRemove) ?? null);
            if (openId === pendingRemove) {
              setOpenId(null);
              releaseOrder();
            }
            setPendingRemove(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SpendingRow({
  phase: s,
  index: i,
  previous,
  open,
  advisory,
  onEdit,
  onSave,
  onRemove,
}: {
  phase: SpendingPhase;
  index: number;
  previous: SpendingPhase | null;
  open: boolean;
  advisory?: Advisory;
  onEdit: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const plan = usePlanStore((s) => s.plan);
  const updateSpending = usePlanStore((s) => s.updateSpending);
  const monthAfterPrevious = previous?.endDate ? monthAfter(previous.endDate) : "";
  const previousLabel = previous?.label.trim() || (previous ? `Spending ${i}` : "");
  const name = s.label.trim() || `Spending ${i + 1}`;

  useEffect(() => {
    if (!s.startDayAfterPrevious) return;
    if (!monthAfterPrevious) {
      updateSpending(s.id, { startDayAfterPrevious: false });
      return;
    }
    if (s.startDate === monthAfterPrevious) return;
    updateSpending(s.id, { startDate: monthAfterPrevious });
  }, [s.startDayAfterPrevious, s.startDate, s.id, monthAfterPrevious, updateSpending]);

  return (
    <li
      id={`card-spending-${s.id}`}
      className="col-span-full rounded-lg bg-section-lift px-3 py-2 shadow-[0_0_0_1px_var(--color-section-lift-border)] @min-[46rem]:grid @min-[46rem]:grid-cols-subgrid @min-[46rem]:items-center @min-[46rem]:px-0"
    >
      <div
        className="col-span-full grid px-0 transition-[grid-template-rows] duration-300 ease-out @min-[46rem]:px-3"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          {s.liabilityId ? (
            <div className="flex flex-col gap-2 pb-1">
              <p className="text-sm leading-relaxed text-fg">
                {name} is a liability payment of {usd(s.monthlyAmount)}/mo, {whenLabel(plan, s)}. It
                does not rise with inflation, and it stops at the payoff date.
              </p>
              <p className="text-xs leading-relaxed text-muted">
                Change the amount or the dates on the liability. Remove this line to turn off
                automatic inclusion.
              </p>
              <PrimaryButton className="h-10 w-auto self-start px-4" onClick={onSave}>
                Close
              </PrimaryButton>
            </div>
          ) : (
          <div className="card-fields flex flex-wrap items-end gap-x-3 gap-y-3 pb-1">
            <Field label="Name" className="w-44 shrink-0">
              <TextInput
                value={s.label}
                replaceSeed="New spending phase"
                placeholder="Name this spending"
                onChange={(e) => updateSpending(s.id, { label: e.target.value })}
                className={control}
              />
            </Field>
            <MonthYearMoney
              compact
              monthLabel="$ / month (today)"
              yearLabel="$ / year (today)"
              monthly={s.monthlyAmount}
              onMonthly={(n) => updateSpending(s.id, { monthlyAmount: n })}
            />
            <Field label="Start" className="shrink-0">
              <DateInput
                value={s.startDate}
                onValue={(v) => updateSpending(s.id, { startDate: v, startDayAfterPrevious: false })}
              />
            </Field>
            <Field
              label={blankEndLabel(plan.primary.birthDate, plan.assumptions.projectionEndAge)}
              className="shrink-0"
            >
              <DateInput
                value={s.endDate}
                clearable
                onValue={(v) => updateSpending(s.id, { endDate: v === "" ? null : v })}
              />
            </Field>
            {monthAfterPrevious ? (
              <label className="flex h-10 max-w-xs items-center gap-2 self-end text-sm text-fg">
                <input
                  type="checkbox"
                  className="size-4 shrink-0"
                  checked={Boolean(s.startDayAfterPrevious)}
                  onChange={(e) => {
                    const on = e.target.checked;
                    updateSpending(s.id, {
                      startDayAfterPrevious: on,
                      ...(on ? { startDate: monthAfterPrevious } : {}),
                    });
                  }}
                />
                Start the month after {previousLabel} ends
              </label>
            ) : null}
            <PrimaryButton className="h-10 self-end" onClick={onSave}>
              Save spending
            </PrimaryButton>
            <div className="flex items-end justify-end">
              <DangerButton
                aria-label={`Remove ${s.label || "spending"}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemove();
                }}
              >
                <Trash2 className="size-4" />
              </DangerButton>
            </div>
            {open && advisory ? (
              <div className="basis-full">
                <AdvisoryNote advisory={advisory} />
              </div>
            ) : null}
          </div>
          )}
        </div>
      </div>
      <div
        className="col-span-full grid transition-[grid-template-rows] duration-300 ease-out @min-[46rem]:grid-cols-subgrid"
        style={{ gridTemplateRows: open ? "0fr" : "1fr" }}
        inert={open}
      >
        <div className="col-span-full min-h-0 overflow-hidden @min-[46rem]:grid @min-[46rem]:grid-cols-subgrid">
          <div className="col-span-full flex items-center gap-3 @min-[46rem]:hidden">
            <p className="min-w-0 flex-1 truncate text-sm text-fg">
              <span className="font-medium">{name}</span>
              {s.liabilityId ? <span className="text-muted"> · liability</span> : null}
              <span className="text-muted"> · {usd(s.monthlyAmount)}/mo</span>
              <span className="text-muted"> · {whenLabel(plan, s)}</span>
            </p>
            <button type="button" className="shrink-0 text-xs text-muted hover:text-negative" onClick={onRemove}>
              Remove
            </button>
            <button type="button" className="shrink-0 text-sm font-medium text-fg" onClick={onEdit}>
              Edit
            </button>
          </div>
          <div className="col-span-full hidden grid-cols-subgrid items-center text-sm @min-[46rem]:grid">
            <span className="min-w-0 truncate pl-3 font-medium text-fg">
              {name}
              {s.liabilityId ? <span className="font-normal text-muted"> · liability</span> : null}
            </span>
            <span className="min-w-0 truncate whitespace-nowrap tabular-nums text-fg">
              {usd(s.monthlyAmount)}/mo
            </span>
            <span className="min-w-0 truncate whitespace-nowrap tabular-nums text-muted">{whenLabel(plan, s)}</span>
            <span className="flex min-w-0 items-center justify-end gap-3 pr-3">
              <button type="button" className="text-xs text-muted hover:text-negative" onClick={onRemove}>
                Remove
              </button>
              <button type="button" className="font-medium text-fg" onClick={onEdit}>
                Edit
              </button>
            </span>
          </div>
          {!open && advisory ? (
            <div className="col-span-full mt-2 px-3">
              <AdvisoryNote advisory={advisory} />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
