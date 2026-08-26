import { Plus, Trash2 } from "lucide-react";
import {
  DangerButton,
  DateInput,
  Field,
  GhostButton,
  NumberInput,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import { usd } from "@/lib/plan/format";
import { newId, usePlanStore } from "@/lib/plan/store";
import { UpgradeNudge } from "@/components/meridian/upgrade-nudge";
import { atContributionCap, useEntitlement } from "@/lib/billing/use-entitlement";

export function ContributionForm() {
  const plan = usePlanStore((s) => s.plan);
  const updateContribution = usePlanStore((s) => s.updateContribution);
  const addContribution = usePlanStore((s) => s.addContribution);
  const removeContribution = usePlanStore((s) => s.removeContribution);
  const ent = useEntitlement();
  const capped = atContributionCap(plan.contributions.length, ent);

  const activeMonthly = plan.contributions
    .filter((c) => !c.endDate || c.endDate >= plan.assumptions.asOfDate)
    .reduce((s, c) => {
      if (c.startDate > plan.assumptions.asOfDate) return s;
      return s + c.monthlyAmount;
    }, 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Rules stack. Amounts are invested only from leftover paycheck after tax
        and spending — MACH will not save money you did not earn. Destination
        accounts come from Observe.
        {plan.portfolios.length
          ? ` Currently active: ${usd(activeMonthly, true)}/mo.`
          : " Add an account in Observe before you add a contribution rule."}
      </p>
      <ul className="flex flex-col gap-3">
        {plan.contributions.map((c) => (
          <li
            key={c.id}
            className="rounded-lg bg-elevated p-3 shadow-[0_0_0_1px_var(--color-border)]"
          >
            <div className="mb-2 flex items-center gap-2">
              <TextInput
                value={c.label}
                onChange={(e) => updateContribution(c.id, { label: e.target.value })}
                className="h-10"
              />
              <DangerButton
                aria-label={`Remove ${c.label}`}
                onClick={() => removeContribution(c.id)}
              >
                <Trash2 className="size-4" />
              </DangerButton>
            </div>
            <div className="flex flex-col gap-2">
              <Field label="Portfolio">
                <SelectInput
                  value={c.portfolioId}
                  onChange={(e) =>
                    updateContribution(c.id, { portfolioId: e.target.value })
                  }
                  disabled={!plan.portfolios.length}
                >
                  {!plan.portfolios.length ? (
                    <option value="">Add an account in Observe</option>
                  ) : null}
                  {plan.portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name.trim() || "Untitled account"}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="$ / month">
                <NumberInput
                  min={0}
                  step={10}
                  value={Math.round(c.monthlyAmount * 100) / 100}
                  onValue={(n) => updateContribution(c.id, { monthlyAmount: n })}
                />
              </Field>
              <Field label="Start">
                <DateInput
                  value={c.startDate}
                  onValue={(v) => updateContribution(c.id, { startDate: v })}
                />
              </Field>
              <Field label="End (blank = open)">
                <DateInput
                  value={c.endDate}
                  onValue={(v) =>
                    updateContribution(c.id, { endDate: v === "" ? null : v })
                  }
                />
              </Field>
            </div>
          </li>
        ))}
      </ul>
      {capped ? (
        <UpgradeNudge kind="contributions" />
      ) : (
        <GhostButton
          disabled={!plan.portfolios.length}
          onClick={() => {
            const dest = plan.portfolios[0];
            if (!dest) return;
            addContribution({
              id: newId("c"),
              label: "New contribution",
              portfolioId: dest.id,
              monthlyAmount: 0,
              startDate: plan.assumptions.asOfDate,
              endDate: null,
            });
          }}
        >
          <Plus className="size-4" />
          Add contribution rule
        </GhostButton>
      )}
    </div>
  );
}