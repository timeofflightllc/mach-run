import { Plus, Trash2 } from "lucide-react";
import {
  DangerButton,
  DateInput,
  Field,
  GhostButton,
  MoneyInput,
  TextInput,
} from "@/components/ui/field";
import { newId, usePlanStore } from "@/lib/plan/store";
import { dayAfter } from "@/lib/plan/dates";

export function SpendingForm() {
  const plan = usePlanStore((s) => s.plan);
  const updateSpending = usePlanStore((s) => s.updateSpending);
  const addSpending = usePlanStore((s) => s.addSpending);
  const removeSpending = usePlanStore((s) => s.removeSpending);

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-4">
      <p className="text-sm text-muted">
        Phases are in today's dollars and inflate with the assumption rate.
        Overlapping phases add together. Add a second phase when spending steps
        up or down.
      </p>
      <ul className="grid grid-cols-1 items-start gap-3 @min-[48rem]:grid-cols-2">
        {plan.spending.map((s, i) => {
          const previous = i > 0 ? plan.spending[i - 1] : null;
          const dayAfterPrevious = previous?.endDate ? dayAfter(previous.endDate) : "";
          const previousLabel =
            previous?.label.trim() || (previous ? `Spending ${i}` : "");
          return (
          <li
            key={s.id}
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
              <Field label="$ / month (today)">
                <MoneyInput
                  value={s.monthlyAmount}
                  onValue={(n) => updateSpending(s.id, { monthlyAmount: n })}
                />
              </Field>
              <div className="flex flex-col gap-1">
                <Field label="Start">
                  <DateInput
                    value={s.startDate}
                    onValue={(v) => updateSpending(s.id, { startDate: v })}
                  />
                </Field>
                {dayAfterPrevious && s.startDate !== dayAfterPrevious ? (
                  <button
                    type="button"
                    className="self-start text-[11px] text-fg underline-offset-4 hover:underline"
                    onClick={() => updateSpending(s.id, { startDate: dayAfterPrevious })}
                  >
                    Start the day after {previousLabel} ends
                  </button>
                ) : null}
              </div>
              <Field label="End (blank = open)">
                <DateInput
                  value={s.endDate}
                  clearable
                  onValue={(v) =>
                    updateSpending(s.id, { endDate: v === "" ? null : v })
                  }
                />
              </Field>
            </div>
          </li>
          );
        })}
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