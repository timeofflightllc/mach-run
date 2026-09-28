import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import {
  DangerButton,
  DateInput,
  Field,
  GhostButton,
  MonthYearMoney,
  TextInput,
} from "@/components/ui/field";
import { newId, usePlanStore } from "@/lib/plan/store";
import { monthAfter } from "@/lib/plan/dates";
import type { SpendingPhase } from "@/lib/plan/types";
import { AdvisoryNote, useOpenAdvisories } from "@/components/meridian/advisory-note";
import type { Advisory } from "@/lib/plan/advisories";

export function SpendingForm() {
  const plan = usePlanStore((s) => s.plan);
  const addSpending = usePlanStore((s) => s.addSpending);
  const advisories = useOpenAdvisories();

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-4 2xl:max-w-[90rem] min-[2000px]:max-w-[110rem]">
      <p className="text-sm text-muted">
        Phases are in today's dollars and inflate with the assumption rate.
        Overlapping phases add together. Add a second phase when spending steps
        up or down.
      </p>
      <ul className="grid grid-cols-1 items-start gap-3 @min-[48rem]:grid-cols-2">
        {plan.spending.map((s, i) => (
          <SpendingRow
            key={s.id}
            phase={s}
            index={i}
            advisory={advisories.find((row) => row.cardId === `card-spending-${s.id}`)}
          />
        ))}
      </ul>
      <GhostButton
        onClick={() =>
          addSpending({
            id: newId("sp"),
            label: "New spending phase",
            monthlyAmount: 10000,
            startDate: plan.assumptions.asOfDate,
            endDate: null,
          })
        }
      >
        <Plus className="size-4" />
        Add spending phase
      </GhostButton>
    </div>
  );
}

function SpendingRow({
  phase: s,
  index: i,
  advisory,
}: {
  phase: SpendingPhase;
  index: number;
  advisory?: Advisory;
}) {
  const plan = usePlanStore((s) => s.plan);
  const updateSpending = usePlanStore((s) => s.updateSpending);
  const removeSpending = usePlanStore((s) => s.removeSpending);
  const previous = i > 0 ? plan.spending[i - 1] : null;
  const monthAfterPrevious = previous?.endDate ? monthAfter(previous.endDate) : "";
  const previousLabel = previous?.label.trim() || (previous ? `Spending ${i}` : "");

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
      className="rounded-lg bg-section-lift p-3 shadow-[0_0_0_1px_var(--color-section-lift-border)]"
    >
      <div className="mb-2 flex items-center gap-2">
        <TextInput
          value={s.label}
          onChange={(e) => updateSpending(s.id, { label: e.target.value })}
          className="h-10"
        />
        <DangerButton
          aria-label={`Remove ${s.label}`}
          onClick={() => removeSpending(s.id)}
        >
          <Trash2 className="size-4" />
        </DangerButton>
      </div>
      <div className="flex flex-col gap-2">
        <MonthYearMoney
          monthLabel="$ / month (today)"
          yearLabel="$ / year (today)"
          monthly={s.monthlyAmount}
          onMonthly={(n) => updateSpending(s.id, { monthlyAmount: n })}
        />
        <Field label="Start">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="min-w-[12rem] flex-1">
              <DateInput
                value={s.startDate}
                onValue={(v) =>
                  updateSpending(s.id, { startDate: v, startDayAfterPrevious: false })
                }
              />
            </div>
            {monthAfterPrevious ? (
              <label
                className="flex max-w-[16rem] items-start gap-2 text-sm leading-snug text-fg"
                onMouseDown={(e) => e.preventDefault()}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0"
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
          </div>
        </Field>
        <Field label="End (blank = open)">
          <DateInput
            value={s.endDate}
            clearable
            onValue={(v) =>
              updateSpending(s.id, { endDate: v === "" ? null : v })
            }
          />
        </Field>
        <AdvisoryNote advisory={advisory} />
      </div>
    </li>
  );
}