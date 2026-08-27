import { Field, DateInput, MonthInput, NumberInput, SelectInput, TextInput } from "@/components/ui/field";
import { usePlanStore } from "@/lib/plan/store";

export function HouseholdForm() {
  const plan = usePlanStore((s) => s.plan);
  const patchPrimary = usePlanStore((s) => s.patchPrimary);
  const patchSpouse = usePlanStore((s) => s.patchSpouse);
  const patchAssumptions = usePlanStore((s) => s.patchAssumptions);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
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
        <Field label="Spouse name">
          <TextInput
            value={plan.spouse.name}
            onChange={(e) => patchSpouse({ name: e.target.value })}
            placeholder="Name"
          />
        </Field>
        <Field label="Spouse birth date">
          <DateInput
            value={plan.spouse.birthDate}
            onValue={(v) => patchSpouse({ birthDate: v })}
          />
        </Field>
        <Field label="As-of date" hint="Balances and today's dollars keyed to this month">
          <DateInput
            value={plan.assumptions.asOfDate}
            onValue={(v) => patchAssumptions({ asOfDate: v })}
          />
        </Field>
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

      <div className="flex flex-col gap-3">
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

      <div className="flex flex-col gap-3 border-t border-border pt-4">
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
                hint="Spendable target at that retirement date — e.g. 3,000,000. MACH will say if you're on track, or how much more to invest each month. Blank = no lump-sum goal."
              >
                <NumberInput
                  min={0}
                  step={10000}
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
  );
}