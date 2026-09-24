import { useEffect, useState } from "react";
import { Field, DateInput, MonthInput, MoneyInput, NumberInput, SelectInput, TextInput } from "@/components/ui/field";
import { longDate } from "@/lib/plan/dates";
import { usePlanStore } from "@/lib/plan/store";

export function HouseholdForm() {
  const plan = usePlanStore((s) => s.plan);
  const patchPrimary = usePlanStore((s) => s.patchPrimary);
  const patchSpouse = usePlanStore((s) => s.patchSpouse);
  const patchAssumptions = usePlanStore((s) => s.patchAssumptions);
  const spouseOnFile = Boolean(plan.spouse.name.trim() || plan.spouse.birthDate);
  const [includeSpouse, setIncludeSpouse] = useState(spouseOnFile);
  const [editingAsOf, setEditingAsOf] = useState(false);

  useEffect(() => {
    if (spouseOnFile) setIncludeSpouse(true);
  }, [spouseOnFile]);

  return (
    <div className="@container flex flex-col gap-5">
      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-3 sm:grid-cols-2 sm:max-w-[46rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <Field label="Primary name">
            <TextInput
              value={plan.primary.name}
              onChange={(e) => patchPrimary({ name: e.target.value })}
              placeholder="Name"
            />
          </Field>
          <Field label="Primary birth date">
            <DateInput
              value={plan.primary.birthDate}
              onValue={(v) => patchPrimary({ birthDate: v })}
            />
          </Field>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={includeSpouse}
              onChange={(e) => {
                const on = e.target.checked;
                setIncludeSpouse(on);
                if (!on) patchSpouse({ name: "", birthDate: "" });
              }}
            />
            Include spouse or significant other
          </label>
          {includeSpouse ? (
            <div className="flex flex-col gap-3 rounded-lg bg-section-lift p-3 shadow-[0_0_0_1px_var(--color-section-lift-border)]">
              <Field label="Spouse or Significant Other's Name">
                <TextInput
                  value={plan.spouse.name}
                  onChange={(e) => patchSpouse({ name: e.target.value })}
                  placeholder="Name"
                />
              </Field>
              <Field label="Birth date">
                <DateInput
                  value={plan.spouse.birthDate}
                  onValue={(v) => patchSpouse({ birthDate: v })}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 @min-[48rem]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-section-lift p-3 shadow-[0_0_0_1px_var(--color-section-lift-border)]">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted">As-of date</span>
            {editingAsOf ? (
              <DateInput
                value={plan.assumptions.asOfDate}
                onValue={(v) => {
                  if (v) patchAssumptions({ asOfDate: v });
                }}
              />
            ) : (
              <div className="flex items-baseline gap-3">
                <p className="text-sm text-fg">{longDate(plan.assumptions.asOfDate)}</p>
                <button
                  type="button"
                  className="shrink-0 text-[11px] text-fg underline-offset-4 hover:underline"
                  onClick={() => setEditingAsOf(true)}
                >
                  Change As-of date
                </button>
              </div>
            )}
            <span className="text-xs text-subtle">
              Balances and today's dollars pegged to this date
            </span>
          </div>
          <Field label="Project through primary age">
            <NumberInput
              min={70}
              max={110}
              step={1}
              value={plan.assumptions.projectionEndAge}
              onValue={(n) => patchAssumptions({ projectionEndAge: n })}
            />
          </Field>
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-section-lift p-3 shadow-[0_0_0_1px_var(--color-section-lift-border)]">
          <Field
            label="Nominal return (% / yr)"
            hint={`Real ≈ ${(((1 + plan.assumptions.defaultReturnPct / 100) / (1 + plan.assumptions.inflationPct / 100) - 1) * 100).toFixed(2)}%`}
          >
            <NumberInput
              min={-5}
              max={15}
              step={0.1}
              value={plan.assumptions.defaultReturnPct}
              onValue={(n) => patchAssumptions({ defaultReturnPct: n })}
            />
          </Field>
          <Field label="Nominal COLA for all incomes (% / yr)">
            <NumberInput
              min={0}
              max={15}
              step={0.1}
              value={plan.assumptions.defaultColaPct ?? 2.5}
              onValue={(n) => patchAssumptions({ defaultColaPct: n })}
            />
          </Field>
          <p className="text-xs leading-relaxed text-[#5c4a18]">
            This is the default COLA for every income. You can set a different
            COLA on each income in Orient.
          </p>
          <Field label="Inflation (% / yr)">
            <NumberInput
              min={0}
              max={10}
              step={0.1}
              value={plan.assumptions.inflationPct}
              onValue={(n) => patchAssumptions({ inflationPct: n })}
            />
          </Field>
          <Field
            label="Ordinary tax rate (%)"
            hint="Blended federal on pension, salary, pre-tax withdrawals. VA is tax-free."
          >
            <NumberInput
              min={0}
              max={50}
              step={1}
              value={plan.assumptions.ordinaryTaxRatePct}
              onValue={(n) => patchAssumptions({ ordinaryTaxRatePct: n })}
            />
          </Field>
          <Field
            label="Sweep surplus into"
            hint="Only accounts you add in Observe. Empty until you add one."
          >
            <SelectInput
              value={plan.assumptions.sweepPortfolioId ?? ""}
              onChange={(e) =>
                patchAssumptions({
                  sweepPortfolioId: e.target.value === "" ? null : e.target.value,
                })
              }
            >
              <option value="">Do not sweep (spend leftover)</option>
              {plan.portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name.trim() || "Untitled account"}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-section-lift p-3 shadow-[0_0_0_1px_var(--color-section-lift-border)]">
          {(() => {
            const goal = plan.assumptions.retirementGoalDate;
            const asOf = plan.assumptions.asOfDate.slice(0, 7);
            const already = Boolean(goal && goal.slice(0, 7) <= asOf);
            return (
              <>
                <label className="flex items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={already}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const stamp = `${asOf}-01`;
                        patchAssumptions({ retirementGoalDate: stamp });
                      } else {
                        patchAssumptions({ retirementGoalDate: null });
                      }
                    }}
                  />
                  Already retired
                </label>
                {already ? (
                  <Field
                    label="About when did you retire?"
                    hint="Month and year. Act keys spendable-in-retirement off this."
                  >
                    <MonthInput
                      value={goal}
                      onValue={(v) =>
                        patchAssumptions({ retirementGoalDate: v === "" ? null : v })
                      }
                    />
                  </Field>
                ) : (
                  <Field
                    label="Retirement goal date"
                    hint="Act’s Spendable strip keys off this date — pile, retirement income, and when spendable runs out."
                  >
                    <DateInput
                      value={goal}
                      onValue={(v) =>
                        patchAssumptions({ retirementGoalDate: v === "" ? null : v })
                      }
                    />
                  </Field>
                )}
                <Field
                  label="Nest egg goal (today $)"
                  hint="Spendable target at that retirement date — e.g. 3,000,000. MACH RUN will say if you're on track, or how much more to invest each month. Blank = no lump-sum goal."
                >
                  <MoneyInput
                    value={plan.assumptions.nestEggGoal ?? 0}
                    onValue={(n) =>
                      patchAssumptions({ nestEggGoal: n > 0 ? n : null })
                    }
                  />
                </Field>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
