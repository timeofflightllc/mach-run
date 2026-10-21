import { useEffect, useRef, useState } from "react";
import {
  ContributionMoney,
  DateInput,
  Field,
  NumberInput,
  MonthInput,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import { usd } from "@/lib/plan/format";
import { blankEndLabel, dateAtAge, formatMonthYear, iso, projectionEndMonth, validIso } from "@/lib/plan/dates";
import { streamWindow } from "@/lib/plan/engine";
import { paycheckFromMonthly } from "@/lib/plan/pay-cadence";
import { newId, usePlanStore } from "@/lib/plan/store";
import { UpgradeNudge } from "@/components/meridian/upgrade-nudge";
import { ConfirmRemove } from "@/components/meridian/confirm-remove";
import { snapMobileStepTop } from "@/components/meridian/snap-mobile-top";
import { AdvisoryNote, useOpenAdvisories } from "@/components/meridian/advisory-note";
import { usePlannerCopy } from "@/components/meridian/use-planner-copy";
import { atContributionCap, useEntitlement } from "@/lib/billing/use-entitlement";
import {
  activeEmployerMatchMonthly,
  employeeMonthlyNow,
  scheduledEmployerMatchMonthly,
} from "@/lib/plan/contribution-now";
import { irsCapPerson, irsEmployeeAnnualLimit, irsOverLimitWarning } from "@/lib/plan/irs-limits";
import { ageInCalendarYear } from "@/lib/plan/rmd";
import type { ContributionRule, Plan } from "@/lib/plan/types";

const MATCH_PCTS = Array.from({ length: 21 }, (_, i) => i * 5);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const ask = "w-full items-center text-center [&>span]:w-full";
const bandField = ask;
const bandControl = "max-w-none text-center text-base";

function isWorkplace(kind: string): boolean {
  return kind === "401k" || kind === "401k_roth" || kind === "tsp" || kind === "tsp_roth";
}

function accountLabel(plan: Plan, rule: ContributionRule): string {
  const dest = plan.portfolios.find((p) => p.id === rule.portfolioId);
  return dest?.name.trim() || "Account";
}

function summaryAmount(plan: Plan, rule: ContributionRule): { main: string; title?: string } {
  if (rule.amountMode === "percent") {
    const inc = plan.incomes.find((s) => s.id === rule.percentOfIncomeId);
    const name = inc?.name.trim() || "that income";
    const pct = rule.percentOfIncome ?? 0;
    const yearly =
      inc?.payCadence === "year" &&
      (inc.kind === "salary" || inc.kind === "bonus" || inc.kind === "allowance");
    if (inc && yearly) {
      const start = streamWindow(plan, inc).start;
      const month = Number(/^(\d{4})-(\d{2})/.exec(start)?.[2] ?? 0);
      const when = FULL_MONTHS[month - 1];
      const base =
        inc.payAmount != null && Number.isFinite(inc.payAmount)
          ? inc.payAmount
          : paycheckFromMonthly(inc.monthlyAmount || 0, "year");
      const annual = Math.round(base * (pct / 100) * 100) / 100;
      const main = when
        ? `${pct}% of ${name}, in ${when}. ${usd(annual)} a year`
        : `${pct}% of ${name}`;
      return { main, title: main };
    }
    const main = `${pct}% of ${name}`;
    return { main, title: main };
  }
  if (rule.payCadence === "year") {
    const main = `${usd(rule.payAmount ?? 0)}/year`;
    return { main, title: main };
  }
  if (rule.payCadence === "week" && rule.payAmount != null) {
    const main = `${usd(rule.payAmount)}/week`;
    return { main, title: main };
  }
  if (rule.payCadence === "biweek" && rule.payAmount != null) {
    const main = `${usd(rule.payAmount)} every 2 weeks`;
    return { main, title: main };
  }
  const dollars = `${usd(employeeMonthlyNow(plan, rule))}/mo`;
  return { main: dollars, title: dollars };
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "ongoing";
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) return "ongoing";
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

function monthKey(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})/.exec(value ?? "");
  return match ? `${match[1]}-${match[2]}` : "9999-12";
}

function endSortKey(plan: Plan, rule: ContributionRule): string {
  if (rule.endDate) return monthKey(rule.endDate);
  const birth = plan.primary.birthDate;
  const age = plan.assumptions.projectionEndAge;
  if (birth && validIso(birth) && Number.isFinite(age)) return monthKey(iso(dateAtAge(birth, age)));
  return "9999-12";
}

function sortedIds(plan: Plan): string[] {
  return plan.contributions
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => {
      const byStart = monthKey(a.rule.startDate).localeCompare(monthKey(b.rule.startDate));
      if (byStart !== 0) return byStart;
      const byEnd = endSortKey(plan, a.rule).localeCompare(endSortKey(plan, b.rule));
      if (byEnd !== 0) return byEnd;
      return a.index - b.index;
    })
    .map((row) => row.rule.id);
}

export function ContributionForm() {
  const plan = usePlanStore((s) => s.plan);
  const updateContribution = usePlanStore((s) => s.updateContribution);
  const addContribution = usePlanStore((s) => s.addContribution);
  const removeContribution = usePlanStore((s) => s.removeContribution);
  const ent = useEntitlement();
  const capped = atContributionCap(plan.contributions.length, ent);
  const advisories = useOpenAdvisories();
  const copy = usePlannerCopy();
  const [needAccount, setNeedAccount] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [orderTick, setOrderTick] = useState(0);
  const frozenOrder = useRef<string[] | null>(null);
  const sortTimer = useRef<number | null>(null);

  useEffect(() => {
    const ret = plan.assumptions.retirementGoalDate;
    if (!ret) return;
    for (const c of plan.contributions) {
      if (c.endAtRetirement && c.endDate !== ret) {
        updateContribution(c.id, { endDate: ret });
      }
    }
  }, [plan.assumptions.retirementGoalDate, plan.contributions, updateContribution]);

  useEffect(() => {
    return () => {
      if (sortTimer.current != null) window.clearTimeout(sortTimer.current);
    };
  }, []);

  const activeMonthly = activeEmployerMatchMonthly(plan);
  const scheduledMonthly = scheduledEmployerMatchMonthly(plan);

  const matchLine = (() => {
    if (!plan.portfolios.length) return null;
    if (activeMonthly > 0) {
      return ` Right now this adds up to ${usd(activeMonthly, true)}/mo in employer match.`;
    }
    if (scheduledMonthly > 0) {
      return ` This month the match is ${usd(0, true)} because that contribution has not started yet. When it is on, employer match is ${usd(scheduledMonthly, true)}/mo.`;
    }
    return ` Right now this adds up to ${usd(0, true)}/mo in employer match.`;
  })();

  function cancelSort() {
    if (sortTimer.current != null) {
      window.clearTimeout(sortTimer.current);
      sortTimer.current = null;
    }
  }

  function displayIds(): string[] {
    const ids = plan.contributions.map((rule) => rule.id);
    const have = new Set(ids);
    if (frozenOrder.current) {
      const kept = frozenOrder.current.filter((id) => have.has(id));
      for (const id of ids) {
        if (!kept.includes(id)) kept.push(id);
      }
      return kept;
    }
    return sortedIds(plan);
  }

  function beginEdit(id: string) {
    cancelSort();
    if (!frozenOrder.current) frozenOrder.current = sortedIds(plan);
    setOpenId(id);
  }

  function saveOpen() {
    setOpenId(null);
    snapMobileStepTop();
    cancelSort();
    sortTimer.current = window.setTimeout(() => {
      frozenOrder.current = null;
      sortTimer.current = null;
      setOrderTick((n) => n + 1);
    }, 320);
  }

  function removeRule(id: string) {
    removeContribution(id);
    if (frozenOrder.current) {
      frozenOrder.current = frozenOrder.current.filter((row) => row !== id);
    }
    if (openId === id) {
      cancelSort();
      frozenOrder.current = null;
      setOpenId(null);
    }
  }

  const rows = displayIds()
    .map((id) => plan.contributions.find((rule) => rule.id === id))
    .filter((rule): rule is ContributionRule => Boolean(rule));
  void orderTick;

  const bar = (on: boolean) => (on ? "h-1.5 flex-1 rounded-full bg-[#3a8a58]" : "h-1.5 flex-1 rounded-full bg-[#d5d0c6]");
  const named = plan.contributions.some((rule) => rule.label.trim().length > 0);
  const funded = plan.contributions.some((rule) => rule.monthlyAmount > 0 || ((rule.percentOfIncome ?? 0) > 0 && Boolean(rule.percentOfIncomeId)));
  const dated = (() => {
    const real = plan.contributions.filter(
      (rule) =>
        rule.label.trim().length > 0 ||
        rule.monthlyAmount > 0 ||
        ((rule.percentOfIncome ?? 0) > 0 && Boolean(rule.percentOfIncomeId)),
    );
    return real.length > 0 && real.every((rule) => Boolean(rule.startDate));
  })();

  return (
    <div className="flex w-full flex-col">
      <div className="mb-4 flex gap-1.5" aria-hidden="true">
        <span className={bar(named)} />
        <span className={bar(funded)} />
        <span className={bar(dated)} />
      </div>
      <h2 className="text-center font-sans text-[1.65rem] font-medium leading-tight text-[#1a2330]">
        What goes into the accounts?
      </h2>
      <div className="mt-2 flex flex-col gap-3 text-center text-sm text-[#3d4a54]">
        {copy.contributionsP1.trim() ? <p className="whitespace-pre-wrap">{copy.contributionsP1}</p> : null}
        {copy.contributionsP2.trim() || matchLine ? (
          <p className="whitespace-pre-wrap">
            {copy.contributionsP2}
            {matchLine}
          </p>
        ) : null}
        {copy.contributionsP3.trim() ? <p className="whitespace-pre-wrap">{copy.contributionsP3}</p> : null}
      </div>
      <div className="mt-6 flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
                {rows.map((c) => {
          const dest = plan.portfolios.find((p) => p.id === c.portfolioId);
          const workplace = dest ? isWorkplace(dest.kind) : false;
          const emp = employeeMonthlyNow(plan, c);
          const person = dest ? irsCapPerson(plan, dest, c) : null;
          const birth =
            person === "spouse"
              ? plan.spouse.birthDate
              : person === "primary"
                ? plan.primary.birthDate
                : "";
          const year = Number(plan.assumptions.asOfDate.slice(0, 4)) || new Date().getFullYear();
          const age = birth ? ageInCalendarYear(birth, year) : 0;
          const overIrs = dest
            ? irsOverLimitWarning(dest.kind, emp, {
                age,
                capToLimit: Boolean(c.capToIrsLimit),
              })
            : null;
          const irsCappedKind = dest ? irsEmployeeAnnualLimit(dest.kind) != null : false;
          const open = openId === c.id;
          const advisory = advisories.find((row) => row.cardId === `card-contributions-${c.id}`);
          const income = plan.incomes.find((s) => s.id === c.percentOfIncomeId);
          const amount = summaryAmount(plan, c);
          return (
            <li key={c.id} id={`card-contributions-${c.id}`} className="rounded-xl bg-[#f3f0e8] px-3 py-2">
              {open ? (
                  <div className="flex flex-col gap-4 py-2">
                    <Field label="Name" className={ask}>
                      <TextInput
                        value={c.label}
                        replaceSeed="New contribution"
                        placeholder="Name this contribution"
                        onChange={(e) => updateContribution(c.id, { label: e.target.value })}
                        className={bandControl}
                      />
                    </Field>
                    <Field label="Account" className={ask}>
                      <SelectInput
                        value={c.portfolioId}
                        onChange={(e) =>
                          updateContribution(c.id, { portfolioId: e.target.value })
                        }
                        disabled={!plan.portfolios.length}
                        className={bandControl}
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
                    <Field label="Amount is" className={ask}>
                      <SelectInput
                        value={c.amountMode === "percent" ? "percent" : "fixed"}
                        onChange={(e) =>
                          updateContribution(c.id, {
                            amountMode: e.target.value === "percent" ? "percent" : "fixed",
                          })
                        }
                        className={bandControl}
                      >
                        <option value="fixed">Dollars per month</option>
                        <option value="percent">Percent of an income</option>
                      </SelectInput>
                    </Field>
                    {c.amountMode === "percent" ? (
                      <>
                        <Field label="Percent" className={bandField}>
                          <NumberInput
                            min={0}
                            max={100}
                            step={0.5}
                            value={c.percentOfIncome ?? 0}
                            onValue={(n) => updateContribution(c.id, { percentOfIncome: n })}
                            className={bandControl}
                          />
                        </Field>
                        <Field label="Which income" className={ask}>
                          <SelectInput
                            value={c.percentOfIncomeId ?? ""}
                            onChange={(e) => {
                              const id = e.target.value || null;
                              const inc = plan.incomes.find((s) => s.id === id);
                              updateContribution(c.id, {
                                percentOfIncomeId: id,
                                startDate: inc?.startDate || c.startDate,
                                endDate: inc ? inc.endDate : c.endDate,
                                stopDate: null,
                              });
                            }}
                            className={bandControl}
                          >
                            <option value="">Select an income</option>
                            {plan.incomes.map((s, i) => (
                              <option key={s.id} value={s.id}>
                                {s.name.trim() || `Income ${i + 1}`}
                              </option>
                            ))}
                          </SelectInput>
                        </Field>
                      </>
                    ) : (
                      <div className="flex justify-center">
                      <ContributionMoney
                        compact
                        monthly={c.monthlyAmount}
                        payAmount={c.payAmount}
                        cadence={c.payCadence}
                        onChange={(next) => updateContribution(c.id, next)}
                      />
                      </div>
                    )}
                    {c.amountMode === "percent" ? (
                      <Field label="Stops" className={ask}>
                        <MonthInput
                            className="justify-center"
                          value={c.stopDate ?? null}
                          clearable
                          onValue={(v) => updateContribution(c.id, { stopDate: v || null })}
                        />
                      </Field>
                    ) : (
                      <>
                        <Field label="Start" className={ask}>
                          <DateInput
                            className="justify-center"
                            value={c.startDate}
                            onValue={(v) => updateContribution(c.id, { startDate: v })}
                          />
                        </Field>
                        <Field label={blankEndLabel(plan.primary.birthDate, plan.assumptions.projectionEndAge)} className={ask}>
                          <DateInput
                            className="justify-center"
                            value={c.endDate}
                            clearable
                            onValue={(v) =>
                              updateContribution(c.id, {
                                endDate: v === "" ? null : v,
                                endAtRetirement: false,
                              })
                            }
                          />
                        </Field>
                      </>
                    )}
                    {irsCappedKind ? (
                      <label className="flex items-center justify-center gap-2 text-center text-sm text-[#1a2330]">
                        <input
                          type="checkbox"
                          checked={Boolean(c.capToIrsLimit)}
                          onChange={(e) =>
                            updateContribution(c.id, { capToIrsLimit: e.target.checked })
                          }
                        />
                        Stop at the IRS annual limit
                      </label>
                    ) : null}
                    {workplace ? (
                      <label className="flex items-center justify-center gap-2 text-center text-sm text-[#1a2330]">
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
                        Employer matches
                      </label>
                    ) : null}
                    {workplace && c.employerMatch ? (
                      <Field label="Match" className={ask}>
                        <SelectInput
                          value={String(c.employerMatchPct ?? 100)}
                          onChange={(e) =>
                            updateContribution(c.id, {
                              employerMatchPct: Number(e.target.value),
                            })
                          }
                          className={bandControl}
                        >
                          {MATCH_PCTS.map((n) => (
                            <option key={n} value={n}>
                              {n}%
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                    ) : null}
                    <label className="flex items-center justify-center gap-2 text-center text-sm text-[#1a2330]">
                      <input
                        type="checkbox"
                        checked={Boolean(c.endAtRetirement)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          const ret = plan.assumptions.retirementGoalDate;
                          updateContribution(c.id, {
                            endAtRetirement: on,
                            ...(on && ret ? { endDate: ret } : {}),
                          });
                        }}
                      />
                      Stop at planned retirement
                    </label>
                    <button type="button" className="min-h-12 rounded-xl bg-[#3a8a58] px-3 text-base font-medium text-white" onClick={saveOpen}>
                      Save contribution
                    </button>
                    <button type="button" className="text-sm text-muted hover:text-negative" onClick={() => setPendingRemove(c.id)}>
                      Remove
                    </button>
                    {c.amountMode === "percent" ? (
                      <p className="text-center text-sm leading-relaxed text-subtle">
                        {income
                          ? `About ${usd(emp, true)}/mo at today’s amount of ${income.name.trim() || "that income"}. Blank stop follows that paycheck (${formatMonthYear(income.startDate)} → ${income.endDate ? formatMonthYear(income.endDate) : projectionEndMonth(plan.primary.birthDate, plan.assumptions.projectionEndAge)}). A stop date ends this contribution only. The paycheck keeps paying.`
                          : "Pick an income. This contribution follows that paycheck until you set a stop date."}
                      </p>
                    ) : null}
                    {overIrs ? (
                      <p className="text-center text-sm leading-relaxed text-[#5c4a18]">{overIrs}</p>
                    ) : null}
                    {c.endAtRetirement && !plan.assumptions.retirementGoalDate ? (
                      <p className="text-center text-sm leading-relaxed text-[#5c4a18]">
                        Set a retirement goal date in Goals first.
                      </p>
                    ) : null}
                    {open && advisory ? <div><AdvisoryNote advisory={advisory} /></div> : null}
                  </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-sm font-medium text-fg">{c.label.trim() || "Contribution"}</span>
                      <span className="block text-xs text-muted">{accountLabel(plan, c)} · {amount.main}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <button type="button" className="text-xs text-muted hover:text-negative" onClick={() => setPendingRemove(c.id)}>
                        Remove
                      </button>
                      <button type="button" className="text-sm font-medium text-fg" onClick={() => beginEdit(c.id)}>
                        Edit
                      </button>
                    </span>
                  </div>
                  {!open && advisory ? (
                    <div className="mt-2">
                      <AdvisoryNote advisory={advisory} />
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
        {capped ? (
          <UpgradeNudge kind="contributions" />
        ) : (
          <>
            {needAccount || !plan.portfolios.length ? (
              <p className="text-center text-sm text-[#3d4a54]">
                Add an account in Observe first — then this button will attach a rule to it.
              </p>
            ) : null}
            <button
              type="button"
              className="min-h-12 rounded-xl bg-[#f3f0e8] px-3 text-base text-[#1a2330] hover:bg-[#e7e2d8]"
              onClick={() => {
                const dest = plan.portfolios[0];
                if (!dest) {
                  setNeedAccount(true);
                  return;
                }
                setNeedAccount(false);
                cancelSort();
                const id = newId("c");
                const base = frozenOrder.current ?? sortedIds(plan);
                frozenOrder.current = [...base.filter((row) => row !== id), id];
                addContribution({
                  id,
                  label: "",
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
                  endAtRetirement: false,
                });
                setOpenId(id);
              }}
            >
              Add contribution rule
            </button>
          </>
        )}
      </div>

      {pendingRemove ? (
        <ConfirmRemove
          title="Remove contribution"
          body="Are you sure you want to remove this contribution? This cannot be undone."
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            removeRule(pendingRemove);
            setPendingRemove(null);
          }}
        />
      ) : null}
    </div>
  );
}
