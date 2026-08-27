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

export function SpendingForm() {
  const plan = usePlanStore((s) => s.plan);
  const updateSpending = usePlanStore((s) => s.updateSpending);
  const addSpending = usePlanStore((s) => s.addSpending);
  const removeSpending = usePlanStore((s) => s.removeSpending);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Phases are in today's dollars and inflate with the assumption rate.
        Overlapping phases add together. Add a second phase when spending steps
        up or down.
      </p>
      <ul className="flex flex-col gap-3">
        {plan.spending.map((s) => (
          <li
            key={s.id}
            className="rounded-lg bg-elevated p-3 shadow-[0_0_0_1px_var(--color-border)]"
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
              <Field label="Start">
                <DateInput
                  value={s.startDate}
                  onValue={(v) => updateSpending(s.id, { startDate: v })}
                />
              </Field>
              <Field label="End (blank = open)">
                <DateInput
                  value={s.endDate}
                  onValue={(v) =>
                    updateSpending(s.id, { endDate: v === "" ? null : v })
                  }
                />
              </Field>
            </div>
          </li>
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