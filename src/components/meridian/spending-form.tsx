import { useEffect, useRef, useState } from "react";
import { AdvisoryNote, useOpenAdvisories } from "@/components/meridian/advisory-note";
import { ConfirmRemove } from "@/components/meridian/confirm-remove";
import { snapMobileStepTop } from "@/components/meridian/snap-mobile-top";
import { usePlannerCopy } from "@/components/meridian/use-planner-copy";
import {
  DateInput,
  Field,
  MonthYearMoney,
  TextInput,
} from "@/components/ui/field";
import type { Advisory } from "@/lib/plan/advisories";
import { blankEndLabel, dateAtAge, iso, monthAfter, projectionEndMonth, validIso } from "@/lib/plan/dates";
import { usd } from "@/lib/plan/format";
import { newId, usePlanStore } from "@/lib/plan/store";
import type { Plan, SpendingPhase } from "@/lib/plan/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ask = "w-full items-center text-center [&>span]:w-full";
const control = "max-w-none text-center text-base";

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

  const bar = (on: boolean) => (on ? "h-1.5 flex-1 rounded-full bg-[#3a8a58]" : "h-1.5 flex-1 rounded-full bg-[#d5d0c6]");
  const named = plan.spending.some((phase) => phase.label.trim().length > 0 || Boolean(phase.liabilityId));
  const funded = plan.spending.some((phase) => phase.monthlyAmount > 0);
  const dated = plan.spending.length > 0 && plan.spending.every((phase) => Boolean(phase.startDate));

  return (
    <div className="flex w-full flex-col">
      <div className="mb-4 flex gap-1.5" aria-hidden="true">
        <span className={bar(named)} />
        <span className={bar(funded)} />
        <span className={bar(dated)} />
      </div>
      <h2 className="text-center font-sans text-[1.65rem] font-medium leading-tight text-[#1a2330]">
        What does the household spend?
      </h2>
      {copy.spendingBody.trim() ? (
        <p className="mt-2 whitespace-pre-wrap text-center text-sm text-[#3d4a54]">{copy.spendingBody}</p>
      ) : null}
      <div className="mt-6 flex flex-col gap-4">
        {rows.length ? (
          <ul className="flex flex-col gap-2">
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
                  snapMobileStepTop();
                }}
                onRemove={() => setPendingRemove(phase.id)}
              />
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          className="min-h-12 rounded-xl bg-[#f3f0e8] px-3 text-base text-[#1a2330] hover:bg-[#e7e2d8]"
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
          Add spending phase
        </button>
      </div>

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
    <li id={`card-spending-${s.id}`} className="rounded-xl bg-[#f3f0e8] px-3 py-2">
      {open ? (
        s.liabilityId ? (
          <div className="flex flex-col gap-3 py-2 text-center">
            <p className="text-sm leading-relaxed text-[#1a2330]">
              {name} is a liability payment of {usd(s.monthlyAmount)}/mo, {whenLabel(plan, s)}. It does not rise with inflation, and it stops at the payoff date.
            </p>
            <p className="text-sm leading-relaxed text-[#3d4a54]">
              Change the amount or the dates on the liability. Remove this line to turn off automatic inclusion.
            </p>
            <button type="button" className="min-h-12 rounded-xl bg-[#3a8a58] px-3 text-base font-medium text-white" onClick={onSave}>
              Close
            </button>
            {advisory ? <AdvisoryNote advisory={advisory} /> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <Field label="Name" className={ask}>
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
              fieldClassName={ask}
              monthLabel="$ / month (today)"
              yearLabel="$ / year (today)"
              monthly={s.monthlyAmount}
              onMonthly={(n) => updateSpending(s.id, { monthlyAmount: n })}
            />
            <Field label="Start" className={ask}>
              <DateInput
                className="justify-center"
                value={s.startDate}
                onValue={(v) => updateSpending(s.id, { startDate: v, startDayAfterPrevious: false })}
              />
            </Field>
            <Field
              label={blankEndLabel(plan.primary.birthDate, plan.assumptions.projectionEndAge)}
              className={ask}
            >
              <DateInput
                className="justify-center"
                value={s.endDate}
                clearable
                onValue={(v) => updateSpending(s.id, { endDate: v === "" ? null : v })}
              />
            </Field>
            {monthAfterPrevious ? (
              <label className="flex items-center justify-center gap-2 text-center text-sm text-[#1a2330]">
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
            <button type="button" className="min-h-12 rounded-xl bg-[#3a8a58] px-3 text-base font-medium text-white" onClick={onSave}>
              Save spending
            </button>
            <button type="button" className="text-sm text-muted hover:text-negative" onClick={onRemove}>
              Remove
            </button>
            {advisory ? <AdvisoryNote advisory={advisory} /> : null}
          </div>
        )
      ) : (
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium text-fg">{name}</span>
              <span className="block text-xs text-muted">{usd(s.monthlyAmount)}/mo</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <button type="button" className="text-xs text-muted hover:text-negative" onClick={onRemove}>
                Remove
              </button>
              <button type="button" className="text-sm font-medium text-fg" onClick={onEdit}>
                Edit
              </button>
            </span>
          </div>
          {advisory ? (
            <div className="mt-2">
              <AdvisoryNote advisory={advisory} />
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}

