import { Plus, Trash2 } from "lucide-react";
import {
  DangerButton,
  DateInput,
  Field,
  GhostButton,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import { usd } from "@/lib/plan/format";
import { monthStart } from "@/lib/plan/dates";
import { newId, usePlanStore } from "@/lib/plan/store";
import type { IncomeStream } from "@/lib/plan/types";
import {
  VA_RATINGS,
  childrenUnder18,
  vaHasSpouse,
  vaPayTodayDollars,
  vaSchedularPay,
  vaStepSchedule,
  vaVeteranSpouseBase,
} from "@/lib/plan/va";

export function VaKids({ stream }: { stream: IncomeStream }) {
  const plan = usePlanStore((s) => s.plan);
  const updateIncome = usePlanStore((s) => s.updateIncome);
  const addChild = usePlanStore((s) => s.addChild);
  const updateChild = usePlanStore((s) => s.updateChild);
  const removeChild = usePlanStore((s) => s.removeChild);
  const asOf = monthStart(plan.assumptions.asOfDate);
  const under18 = childrenUnder18(plan.children, asOf);
  const spouse = vaHasSpouse(plan, stream);
  const rating = stream.vaRatingPct ?? 0;
  const todayPay = vaPayTodayDollars(plan, stream, asOf);
  const base = vaVeteranSpouseBase(plan, stream);
  const steps = vaStepSchedule(plan, stream);
  const dependentsStart = rating >= 30;

  return (
    <div className="mt-1 flex flex-col gap-3 rounded-lg bg-surface p-3 shadow-[0_0_0_1px_var(--color-border)]">
      <Field
        label="VA rating (%)"
        hint="Schedular table only — no SMC. 2026 rates, effective Dec 1, 2025."
      >
        <SelectInput
          value={rating ? String(rating) : ""}
          onChange={(e) =>
            updateIncome(stream.id, {
              vaRatingPct: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
        >
          <option value="">Select rating</option>
          {VA_RATINGS.map((r) => (
            <option key={r} value={r}>
              {r}%
            </option>
          ))}
        </SelectInput>
      </Field>

      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={spouse}
          onChange={(e) =>
            updateIncome(stream.id, { vaSpouseDependent: e.target.checked })
          }
        />
        Spouse on the award
      </label>

      <Field
        label="Children under 18"
        hint={
          dependentsStart
            ? "From birthdays vs as-of. Add-on drops the month they turn 18."
            : "Dependent pay starts at 30%."
        }
      >
        <p className="font-display text-xl tabular-nums text-fg">{under18.length}</p>
      </Field>

      <ul className="flex flex-col gap-2">
        {plan.children.map((c) => (
          <li key={c.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <TextInput
                value={c.name}
                placeholder="Name"
                onChange={(e) => updateChild(c.id, { name: e.target.value })}
                className="h-10"
              />
              <DangerButton aria-label={`Remove ${c.name || "child"}`} onClick={() => removeChild(c.id)}>
                <Trash2 className="size-4" />
              </DangerButton>
            </div>
            <Field label="Birthday">
              <DateInput
                value={c.birthDate}
                onValue={(v) => updateChild(c.id, { birthDate: v })}
              />
            </Field>
          </li>
        ))}
      </ul>
      <GhostButton onClick={() => addChild({ id: newId("child"), name: "", birthDate: "" })}>
        <Plus className="size-4" />
        Add child
      </GhostButton>

      {rating ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-subtle">
            2026 table amount
          </p>
          <p className="font-display text-2xl tabular-nums text-fg">{usd(todayPay, true)}/mo</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {rating}% · {spouse ? "spouse" : "no spouse"} · {under18.length} child
            {under18.length === 1 ? "" : "ren"} under 18. Veteran
            {spouse ? " + spouse" : " alone"} {usd(base, true)}/mo. After all kids turn 18:{" "}
            {usd(vaSchedularPay(rating, spouse, 0), true)}/mo.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Pick a rating. MACH RUN fills the check from the VA.gov 2026 table (rating + spouse +
          kids under 18).
        </p>
      )}

      {steps.length && rating >= 30 ? (
        <ul className="text-xs text-muted">
          {steps.map((s) => (
            <li key={s.date}>
              {s.name} turns 18 {s.date.slice(0, 7)} → {usd(s.payToday, true)}/mo
              {s.kidsLeft ? ` · ${s.kidsLeft} still under 18` : " · veteran + spouse"}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
