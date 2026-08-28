import { Plus, Trash2 } from "lucide-react";
import {
  DangerButton,
  DateInput,
  Field,
  GhostButton,
  NumberInput,
  MoneyInput,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import type { IncomeKind, TaxTreatment } from "@/lib/plan/types";
import { newId, usePlanStore } from "@/lib/plan/store";
import { ssBenefitFromPia } from "@/lib/plan/social-security";
import { usd } from "@/lib/plan/format";
import { VaKids } from "@/components/meridian/va-kids";
import { UpgradeNudge } from "@/components/meridian/upgrade-nudge";
import { atIncomeCap, useEntitlement } from "@/lib/billing/use-entitlement";

const KINDS: { value: IncomeKind; label: string }[] = [
  { value: "salary", label: "Salary / wages" },
  { value: "bonus", label: "Bonus" },
  { value: "allowance", label: "Allowance / stipend" },
  { value: "pension", label: "Pension (FRS, civilian, etc.)" },
  { value: "military", label: "Military retired pay" },
  { value: "va", label: "VA disability" },
  { value: "ss", label: "Social Security" },
  { value: "other_retirement", label: "Other retirement income" },
  { value: "other", label: "Other income" },
];

const TAX: { value: TaxTreatment; label: string }[] = [
  { value: "ordinary", label: "Ordinary income" },
  { value: "tax_free", label: "Tax-free" },
  { value: "ss", label: "Social Security" },
];

export function IncomeForm() {
  const plan = usePlanStore((s) => s.plan);
  const updateIncome = usePlanStore((s) => s.updateIncome);
  const addIncome = usePlanStore((s) => s.addIncome);
  const removeIncome = usePlanStore((s) => s.removeIncome);
  const ent = useEntitlement();
  const capped = atIncomeCap(plan.incomes.length, ent);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Each block is one paycheck over a specific stretch of time. Name it, set
        the monthly amount, set start and end. Tell MACH RUN what kind of income
        it is — earned (salary, bonus, other income) or guaranteed (pension,
        military retired pay, VA, Social Security, other retirement). Blank end
        date = it keeps paying indefinitely.
      </p>
      <ul className="flex flex-col gap-3">
        {plan.incomes.map((s, i) => (
          <li
            key={s.id}
            className="rounded-lg bg-elevated p-3 shadow-[0_0_0_1px_var(--color-border)]"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="shrink-0 text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                Income {i + 1}
              </span>
              <TextInput
                value={s.name}
                placeholder="Name this income"
                onChange={(e) => updateIncome(s.id, { name: e.target.value })}
                className="h-10"
              />
              <DangerButton
                aria-label={`Remove ${s.name || `income ${i + 1}`}`}
                onClick={() => removeIncome(s.id)}
              >
                <Trash2 className="size-4" />
              </DangerButton>
            </div>
            <div className="flex flex-col gap-2">
              {s.kind === "ss" ? (
                <>
                  <Field
                    label="PIA at FRA (today $)"
                    hint={
                      s.ssPia
                        ? `Pays ${usd(ssBenefitFromPia(s.ssPia, s.ssClaimAge ?? 67, s.ssFra ?? 67), true)}/mo at claim age ${s.ssClaimAge ?? 67}`
                        : "62–70. FRA is 67."
                    }
                  >
                    <MoneyInput
                      value={s.ssPia ?? 0}
                      onValue={(n) => updateIncome(s.id, { ssPia: n })}
                    />
                  </Field>
                  <Field label="Claiming age">
                    <NumberInput
                      min={62}
                      max={70}
                      step={1}
                      value={s.ssClaimAge ?? 67}
                      onValue={(n) => updateIncome(s.id, { ssClaimAge: n })}
                    />
                  </Field>
                </>
              ) : s.kind === "va" ? null : (
                <Field label="$ / month (today)">
                  <MoneyInput
                    value={Math.round(s.monthlyAmount * 100) / 100}
                    onValue={(n) => updateIncome(s.id, { monthlyAmount: n })}
                  />
                </Field>
              )}
              <Field label="Start">
                <DateInput
                  value={s.startDate}
                  onValue={(v) => updateIncome(s.id, { startDate: v })}
                />
              </Field>
              <Field label="End (blank = ongoing)">
                <DateInput
                  value={s.endDate}
                  onValue={(v) =>
                    updateIncome(s.id, { endDate: v === "" ? null : v })
                  }
                />
              </Field>
              <Field label="Kind">
                <SelectInput
                  value={s.kind}
                  onChange={(e) => {
                    const kind = e.target.value as IncomeKind;
                    updateIncome(s.id, {
                      kind,
                      ...(kind === "va" ? { taxTreatment: "tax_free" as TaxTreatment } : {}),
                    });
                  }}
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Tax">
                <SelectInput
                  value={s.taxTreatment}
                  onChange={(e) =>
                    updateIncome(s.id, {
                      taxTreatment: e.target.value as TaxTreatment,
                    })
                  }
                >
                  {TAX.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="COLA % / yr (blank = inflation)">
                <NumberInput
                  step={0.1}
                  value={s.colaPct ?? plan.assumptions.inflationPct}
                  onValue={(n) => updateIncome(s.id, { colaPct: n })}
                />
              </Field>
              {s.kind === "va" ? <VaKids stream={s} /> : null}
            </div>
          </li>
        ))}
      </ul>
      {capped ? (
        <UpgradeNudge kind="incomes" />
      ) : (
        <GhostButton
          onClick={() =>
            addIncome({
              id: newId("inc"),
              name: "",
              kind: "salary",
              monthlyAmount: 0,
              startDate: plan.assumptions.asOfDate,
              endDate: null,
              colaPct: 0,
              taxTreatment: "ordinary",
              person: "household",
            })
          }
        >
          <Plus className="size-4" />
          Add income
        </GhostButton>
      )}
    </div>
  );
}