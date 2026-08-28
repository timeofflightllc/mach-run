import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { usd } from "@/lib/plan/format";
import { newId, usePlanStore } from "@/lib/plan/store";
import { UpgradeNudge } from "@/components/meridian/upgrade-nudge";
import { atContributionCap, useEntitlement } from "@/lib/billing/use-entitlement";
import {
  activeEmployerMatchMonthly,
  employeeMonthlyNow,
} from "@/lib/plan/contribution-now";
import { irsEmployeeAnnualLimit, irsOverLimitWarning } from "@/lib/plan/irs-limits";
import { normalizeOwner } from "@/lib/plan/family-owners";
import { ageInCalendarYear } from "@/lib/plan/rmd";
import type { ContributionRule } from "@/lib/plan/types";

const MATCH_PCTS = Array.from({ length: 21 }, (_, i) => i * 5);

function isWorkplace(kind: string): boolean {
  return kind === "401k" || kind === "401k_roth" || kind === "tsp";
}

export function ContributionForm() {
  const plan = usePlanStore((s) => s.plan);
  const updateContribution = usePlanStore((s) => s.updateContribution);
  const addContribution = usePlanStore((s) => s.addContribution);
  const removeContribution = usePlanStore((s) => s.removeContribution);
  const ent = useEntitlement();
  const capped = atContributionCap(plan.contributions.length, ent);
  const [needAccount, setNeedAccount] = useState(false);

  const activeMonthly = activeEmployerMatchMonthly(plan);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 text-sm text-muted">
        <p>
          Tell MACH RUN how much to put into which account, and when. It only
          invests what’s left after taxes and spending — it will not invent extra
          cash — so ensure your income and spending is accurate.
        </p>
        <p>
          If your 401(k) or TSP has a company match, select that below. That match
          is free money on top, not from your paycheck.
          {plan.portfolios.length
            ? ` Right now this adds up to ${usd(activeMonthly, true)}/mo in employer match.`
            : null}
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {plan.contributions.map((c) => {
          const dest = plan.portfolios.find((p) => p.id === c.portfolioId);
          const workplace = dest ? isWorkplace(dest.kind) : false;
          const emp = employeeMonthlyNow(plan, c);
          const owner = dest ? normalizeOwner(dest.owner) : "primary";
          const birth =
            owner === "spouse" ? plan.spouse.birthDate : plan.primary.birthDate;
          const year = Number(plan.assumptions.asOfDate.slice(0, 4)) || new Date().getFullYear();
          const age = birth ? ageInCalendarYear(birth, year) : 0;
          const overIrs = dest
            ? irsOverLimitWarning(dest.kind, emp, {
                age,
                capToLimit: Boolean(c.capToIrsLimit),
              })
            : null;
          const irsCappedKind = dest ? irsEmployeeAnnualLimit(dest.kind) != null : false;
          return (
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
                <Field label="Amount is">
                  <SelectInput
                    value={c.amountMode === "percent" ? "percent" : "fixed"}
                    onChange={(e) =>
                      updateContribution(c.id, {
                        amountMode: e.target.value === "percent" ? "percent" : "fixed",
                      })
                    }
                  >
                    <option value="fixed">Dollars per month</option>
                    <option value="percent">Percent of an income</option>
                  </SelectInput>
                </Field>
                {c.amountMode === "percent" ? (
                  <>
                    <Field label="Percent of income">
                      <NumberInput
                        min={0}
                        max={100}
                        step={0.5}
                        value={c.percentOfIncome ?? 0}
                        onValue={(n) => updateContribution(c.id, { percentOfIncome: n })}
                      />
                    </Field>
                    <Field label="Which income">
                      <SelectInput
                        value={c.percentOfIncomeId ?? ""}
                        onChange={(e) => {
                          const id = e.target.value || null;
                          const inc = plan.incomes.find((s) => s.id === id);
                          updateContribution(c.id, {
                            percentOfIncomeId: id,
                            startDate: inc?.startDate || c.startDate,
                            endDate: inc ? inc.endDate : c.endDate,
                          });
                        }}
                      >
                        <option value="">Select an income</option>
                        {plan.incomes.map((s, i) => (
                          <option key={s.id} value={s.id}>
                            {s.name.trim() || `Income ${i + 1}`}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <p className="text-xs text-subtle">
                      About {usd(emp, true)}/mo at today’s amount of that income.
                      Dates and employer match follow that paycheck — when it
                      ends, this contribution and the match end.
                    </p>
                  </>
                ) : (
                  <Field label="$ / month">
                    <MoneyInput
                      value={Math.round(c.monthlyAmount * 100) / 100}
                      onValue={(n) => updateContribution(c.id, { monthlyAmount: n })}
                    />
                  </Field>
                )}
                {irsCappedKind ? (
                  <label className="flex items-center gap-2 text-sm text-fg">
                    <input
                      type="checkbox"
                      checked={Boolean(c.capToIrsLimit)}
                      onChange={(e) =>
                        updateContribution(c.id, { capToIrsLimit: e.target.checked })
                      }
                    />
                    Stop my contribution when I hit the IRS annual limit
                  </label>
                ) : null}
                {overIrs ? (
                  <p className="text-xs leading-relaxed text-[#e8c547]">
                    {overIrs}
                  </p>
                ) : null}
                {workplace ? (
                  <>
                    <label className="flex items-center gap-2 text-sm text-fg">
                      <input
                        type="checkbox"
                        checked={Boolean(c.employerMatch)}
                        onChange={(e) =>
                          updateContribution(c.id, {
                            employerMatch: e.target.checked,
                            employerMatchPct: e.target.checked
                              ? (c.employerMatchPct ?? 100)
                              : 0,
                          })
                        }
                      />
                      My employer matches this contribution
                    </label>
                    {c.employerMatch ? (
                      <Field
                        label="Employer match"
                        hint="Percent of the employee dollars that actually get invested."
                      >
                        <SelectInput
                          value={String(c.employerMatchPct ?? 100)}
                          onChange={(e) =>
                            updateContribution(c.id, {
                              employerMatchPct: Number(e.target.value),
                            })
                          }
                        >
                          {MATCH_PCTS.map((n) => (
                            <option key={n} value={n}>
                              {n}%
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                    ) : null}
                  </>
                ) : null}
                {c.amountMode === "percent" ? (
                  <p className="text-xs leading-relaxed text-subtle">
                    {(() => {
                      const inc = plan.incomes.find((s) => s.id === c.percentOfIncomeId);
                      const name = inc
                        ? inc.name.trim() || "that income"
                        : null;
                      if (!inc || !name) {
                        return "Pick an income — start, end, and match will follow that paycheck automatically.";
                      }
                      const start = inc.startDate.slice(0, 7);
                      const end = inc.endDate ? inc.endDate.slice(0, 7) : "ongoing";
                      return `Follows ${name}: ${start} → ${end}. Employer match (if any) stops when this paycheck stops.`;
                    })()}
                  </p>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {capped ? (
        <UpgradeNudge kind="contributions" />
      ) : (
        <>
          {needAccount || !plan.portfolios.length ? (
            <p className="text-sm text-muted">
              Add an account in Observe first — then this button will attach a
              rule to it.
            </p>
          ) : null}
          <GhostButton
            onClick={() => {
              const dest = plan.portfolios[0];
              if (!dest) {
                setNeedAccount(true);
                return;
              }
              setNeedAccount(false);
              addContribution({
                id: newId("c"),
                label: "New contribution",
                portfolioId: dest.id,
                monthlyAmount: 0,
                startDate: plan.assumptions.asOfDate,
                endDate: null,
                amountMode: "fixed",
                percentOfIncome: null,
                percentOfIncomeId: null,
                employerMatch: false,
                employerMatchPct: 0,
                capToIrsLimit: false,
              });
            }}
          >
            <Plus className="size-4" />
            Add contribution rule
          </GhostButton>
        </>
      )}
    </div>
  );
}
