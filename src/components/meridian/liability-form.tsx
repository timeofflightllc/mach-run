import { Plus, Trash2 } from "lucide-react";
import {
  DangerButton,
  Field,
  GhostButton,
  MonthInput,
  NumberInput,
  MoneyInput,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import type { LiabilityKind } from "@/lib/plan/types";
import { newId, usePlanStore } from "@/lib/plan/store";
import { usd } from "@/lib/plan/format";
import {
  emptyLiability,
  liabilityPayoffDate,
  originalLiability,
  remainingLiability,
} from "@/lib/plan/liability";
import { familyOwnerOptions, normalizeOwner } from "@/lib/plan/family-owners";

const KINDS: { value: LiabilityKind; label: string }[] = [
  { value: "car", label: "Car loan" },
  { value: "student", label: "Student loan" },
  { value: "heloc", label: "HELOC" },
  { value: "personal", label: "Personal loan" },
  { value: "credit_card", label: "Credit card" },
  { value: "other", label: "Other" },
];

export function LiabilityForm() {
  const plan = usePlanStore((s) => s.plan);
  const addLiability = usePlanStore((s) => s.addLiability);
  const updateLiability = usePlanStore((s) => s.updateLiability);
  const removeLiability = usePlanStore((s) => s.removeLiability);
  const asOf = plan.assumptions.asOfDate;
  const owners = familyOwnerOptions(plan, "taxable");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Car, student, HELOC, personal, credit card. Remaining principal comes
        off net worth. House mortgages stay on the real estate account above —
        do not enter those here.
      </p>
      <ul className="flex flex-col gap-3">
        {(plan.liabilities ?? []).map((l) => {
          const remaining = remainingLiability(l, asOf);
          const original = originalLiability(l);
          const payoff = liabilityPayoffDate(l);
          const hasLoan = l.monthlyPi > 0 && l.termYears > 0;
          return (
            <li
              key={l.id}
              className="rounded-lg bg-section-lift p-3 shadow-[0_0_0_1px_var(--color-section-lift-border)]"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <TextInput
                  value={l.name}
                  onChange={(e) => updateLiability(l.id, { name: e.target.value })}
                  className="h-10"
                  placeholder="Name this loan"
                />
                <DangerButton
                  aria-label={`Remove ${l.name || "liability"}`}
                  onClick={() => removeLiability(l.id)}
                >
                  <Trash2 className="size-4" />
                </DangerButton>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Field label="Kind">
                  <SelectInput
                    value={l.kind}
                    onChange={(e) =>
                      updateLiability(l.id, { kind: e.target.value as LiabilityKind })
                    }
                  >
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Account owner">
                  <SelectInput
                    value={normalizeOwner(l.owner)}
                    onChange={(e) => updateLiability(l.id, { owner: e.target.value })}
                  >
                    {owners.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <div
                className="mx-[50px] mt-3 rounded-lg px-3 py-3"
                style={{
                  background: "color-mix(in oklab, #e8c547 12%, transparent)",
                  boxShadow: "0 0 0 1px color-mix(in oklab, #e8c547 45%, transparent)",
                }}
              >
                <p className="text-xs font-medium tracking-wide text-[#e8c547]">
                  Loan terms
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#e8c547]">
                  Remaining principal is subtracted from net worth. Check the box
                  only if this P&I is not already in Spending.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Field label="Origination (month/year)">
                    <MonthInput
                      value={l.originationDate}
                      onValue={(v) => updateLiability(l.id, { originationDate: v })}
                    />
                  </Field>
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                    <Field label="APR (%)" className="w-[8.75rem]">
                      <NumberInput
                        min={0}
                        max={25}
                        step={0.125}
                        value={l.aprPct}
                        onValue={(n) => updateLiability(l.id, { aprPct: n })}
                      />
                    </Field>
                    <Field label="P&I / month" className="w-[8.75rem]">
                      <MoneyInput
                        min={0}
                        value={Math.round((l.monthlyPi || 0) * 100) / 100}
                        onValue={(n) => updateLiability(l.id, { monthlyPi: n })}
                      />
                    </Field>
                    <Field label="Length (years)" className="w-[8.75rem]">
                      <NumberInput
                        min={1}
                        max={50}
                        step={1}
                        value={l.termYears}
                        onValue={(n) => updateLiability(l.id, { termYears: n })}
                      />
                    </Field>
                    <Field label="In spending">
                      <label className="flex min-h-11 items-center gap-2 text-xs text-[#e8c547]">
                        <input
                          type="checkbox"
                          checked={Boolean(l.includeInSpending)}
                          onChange={(e) =>
                            updateLiability(l.id, {
                              includeInSpending: e.target.checked,
                            })
                          }
                        />
                        Include this P&I in spending
                      </label>
                    </Field>
                  </div>
                </div>
                {hasLoan ? (
                  <p className="mt-3 text-xs leading-relaxed text-[#e8c547]">
                    Original principal about {usd(original)}. Remaining now{" "}
                    {usd(remaining)}
                    {payoff ? ` · paid off ${payoff.slice(0, 7)}` : ""}.
                  </p>
                ) : (
                  <p className="mt-3 text-xs leading-relaxed text-[#e8c547]">
                    Enter P&I, APR, origination, and term to model the loan.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <GhostButton
        onClick={() =>
          addLiability({
            ...emptyLiability(),
            id: newId("lia"),
            name: "New liability",
            kind: "car",
          })
        }
      >
        <Plus className="size-4" />
        Add liability
      </GhostButton>
    </div>
  );
}
