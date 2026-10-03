import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Field, DateInput, MonthInput, MoneyInput, NumberInput, SelectInput, TextInput } from "@/components/ui/field";
import { ConfirmRemove } from "@/components/meridian/confirm-remove";
import { ageYears, longDate, parseDate } from "@/lib/plan/dates";
import { newId, usePlanStore } from "@/lib/plan/store";

export function HouseholdForm() {
  const plan = usePlanStore((s) => s.plan);
  const patchPrimary = usePlanStore((s) => s.patchPrimary);
  const patchSpouse = usePlanStore((s) => s.patchSpouse);
  const addChild = usePlanStore((s) => s.addChild);
  const updateChild = usePlanStore((s) => s.updateChild);
  const removeChild = usePlanStore((s) => s.removeChild);
  const spouseOnFile = Boolean(plan.spouse.name.trim() || plan.spouse.birthDate);
  const [includeSpouse, setIncludeSpouse] = useState(spouseOnFile);
  const [addingDependent, setAddingDependent] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [removingChildId, setRemovingChildId] = useState<string | null>(null);

  useEffect(() => {
    if (spouseOnFile) setIncludeSpouse(true);
  }, [spouseOnFile]);

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-5 2xl:max-w-[90rem] min-[2000px]:max-w-[110rem]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <Field label="Primary name" className="w-full max-w-[16rem]">
            <TextInput
              value={plan.primary.name}
              onChange={(e) => patchPrimary({ name: e.target.value })}
              placeholder="Name"
            />
          </Field>
          <Field label="Primary birthday" className="w-auto">
            <DateInput
              value={plan.primary.birthDate}
              onValue={(v) => patchPrimary({ birthDate: v })}
            />
          </Field>
          <label className="flex h-11 items-center gap-2 text-sm text-fg">
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
        </div>
        {includeSpouse ? (
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <Field label="Spouse or Significant Other's Name" className="w-full max-w-[16rem]">
              <TextInput
                value={plan.spouse.name}
                onChange={(e) => patchSpouse({ name: e.target.value })}
                placeholder="Name"
              />
            </Field>
            <Field label="Birth date" className="w-auto">
              <DateInput
                value={plan.spouse.birthDate}
                onValue={(v) => patchSpouse({ birthDate: v })}
              />
            </Field>
          </div>
        ) : null}
        <button
          type="button"
          className="h-10 self-start rounded-lg px-3 text-sm text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-surface"
          onClick={() => setAddingDependent(true)}
        >
          Add additional child
        </button>
        {plan.children.length ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_auto] items-center gap-x-3 px-3 text-xs font-medium text-muted sm:grid-cols-[minmax(0,11rem)_4rem_minmax(0,1fr)_auto] sm:gap-x-6">
              <span className="text-left">Child's Name</span>
              <span className="text-left">Age</span>
              <span className="hidden text-left sm:block">Birthday</span>
              <span className="sm:hidden" />
            </div>
            <ul className="flex flex-col gap-2">
            {[...plan.children]
              .sort((a, b) => {
                if (a.birthDate && b.birthDate) return b.birthDate.localeCompare(a.birthDate);
                if (a.birthDate) return -1;
                if (b.birthDate) return 1;
                return a.name.localeCompare(b.name);
              })
              .map((child) => {
              const editing = editingChildId === child.id;
              const name = child.name.trim() || "Child";
              const born = child.birthDate ? longDate(child.birthDate) : "Birthday not set";
              const age = child.birthDate
                ? String(ageYears(child.birthDate, parseDate(plan.assumptions.asOfDate)))
                : "—";
              return (
                <li
                  key={child.id}
                  className="rounded-lg bg-section-lift px-3 py-2 shadow-[0_0_0_1px_var(--color-section-lift-border)]"
                >
                  {editing ? (
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                      <Field label="First name" className="w-full max-w-[16rem]">
                        <TextInput
                          value={child.name}
                          onChange={(e) => updateChild(child.id, { name: e.target.value })}
                        />
                      </Field>
                      <Field label="Birthday" className="w-auto">
                        <DateInput
                          value={child.birthDate}
                          onValue={(v) => updateChild(child.id, { birthDate: v })}
                        />
                      </Field>
                      <div className="flex h-11 items-center gap-3">
                        <button
                          type="button"
                          className="text-sm font-medium text-fg"
                          onClick={() => setEditingChildId(null)}
                        >
                          Save and Close
                        </button>
                        <button
                          type="button"
                          className="text-xs text-muted hover:text-negative"
                          onClick={() => setRemovingChildId(child.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_auto] items-center gap-x-3 sm:grid-cols-[minmax(0,11rem)_4rem_minmax(0,1fr)_auto] sm:gap-x-6">
                      <span className="truncate text-left text-sm font-medium text-fg">{name}</span>
                      <span className="text-left text-sm tabular-nums text-fg">{age}</span>
                      <span className="hidden truncate text-left text-sm text-fg sm:block">{born}</span>
                      <span className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          className="shrink-0 text-xs text-muted hover:text-negative"
                          onClick={() => setRemovingChildId(child.id)}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          className="shrink-0 text-sm font-medium text-fg"
                          onClick={() => setEditingChildId(child.id)}
                        >
                          Edit
                        </button>
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
            </ul>
          </div>
        ) : null}
      </div>
      {addingDependent ? (
        <AddDependentPrompt
          onCancel={() => setAddingDependent(false)}
          onSave={(name, birthDate) => {
            addChild({ id: newId("child"), name, birthDate });
            setAddingDependent(false);
          }}
        />
      ) : null}
      {removingChildId ? (
        <ConfirmRemove
          title="Remove this child?"
          body={`${plan.children.find((child) => child.id === removingChildId)?.name.trim() || "This child"} will be removed. Any account that listed them as owner goes back to Select owner.`}
          onCancel={() => setRemovingChildId(null)}
          onConfirm={() => {
            removeChild(removingChildId);
            if (editingChildId === removingChildId) setEditingChildId(null);
            setRemovingChildId(null);
          }}
        />
      ) : null}
    </div>
  );
}

export function AssumptionsForm() {
  const plan = usePlanStore((s) => s.plan);
  const patchAssumptions = usePlanStore((s) => s.patchAssumptions);
  const [editingAsOf, setEditingAsOf] = useState(false);

  const pct = "w-[4.75rem] max-w-none shrink-0";

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-3 2xl:max-w-[90rem] min-[2000px]:max-w-[110rem]">
      <div className="flex flex-col gap-3 rounded-lg bg-section-lift p-3 shadow-[0_0_0_1px_var(--color-section-lift-border)]">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <div className="flex w-auto flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted">As-of date</span>
            {editingAsOf ? (
              <DateInput
                value={plan.assumptions.asOfDate}
                onValue={(v) => {
                  if (v) patchAssumptions({ asOfDate: v });
                }}
              />
            ) : (
              <div className="flex h-11 items-center gap-3">
                <p className="whitespace-nowrap text-sm text-fg">{longDate(plan.assumptions.asOfDate)}</p>
                <button
                  type="button"
                  className="shrink-0 text-[11px] text-fg underline-offset-4 hover:underline"
                  onClick={() => setEditingAsOf(true)}
                >
                  Change
                </button>
              </div>
            )}
          </div>
          <label className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap text-sm text-fg">
            <span className="text-xs font-medium tracking-wide text-muted">Project through longevity age</span>
            <NumberInput
              min={70}
              max={110}
              step={1}
              value={plan.assumptions.projectionEndAge}
              onValue={(n) => patchAssumptions({ projectionEndAge: n })}
              className={pct}
            />
          </label>
          {(() => {
            const goal = plan.assumptions.retirementGoalDate;
            const asOf = plan.assumptions.asOfDate.slice(0, 7);
            const already = Boolean(goal && goal.slice(0, 7) <= asOf);
            return (
              <>
                <label className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={already}
                    onChange={(e) => {
                      if (e.target.checked) {
                        patchAssumptions({ retirementGoalDate: `${asOf}-01` });
                      } else {
                        patchAssumptions({ retirementGoalDate: null });
                      }
                    }}
                  />
                  Already retired
                </label>
                {already ? (
                  <Field label="Retired" className="w-auto shrink-0">
                    <MonthInput
                      value={goal}
                      onValue={(v) =>
                        patchAssumptions({ retirementGoalDate: v === "" ? null : v })
                      }
                    />
                  </Field>
                ) : (
                  <Field label="Retirement goal date" className="w-auto shrink-0">
                    <DateInput
                      value={goal}
                      onValue={(v) =>
                        patchAssumptions({ retirementGoalDate: v === "" ? null : v })
                      }
                    />
                  </Field>
                )}
                <Field label="Nest egg goal (today $)" className="w-40 shrink-0">
                  <MoneyInput
                    value={plan.assumptions.nestEggGoal ?? 0}
                    onValue={(n) => patchAssumptions({ nestEggGoal: n > 0 ? n : null })}
                    className="w-40 max-w-none"
                  />
                </Field>
              </>
            );
          })()}
        </div>
        <p className="text-xs leading-relaxed text-subtle">
          Balances peg to the as-of date. Blank end dates run through the longevity age. Act’s
          Spendable strip keys off the retirement date. Blank nest egg means no lump-sum goal.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-section-lift p-3 shadow-[0_0_0_1px_var(--color-section-lift-border)]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <span className="text-xs font-medium tracking-wide text-muted">Nominal return (% / yr)</span>
            <NumberInput
              min={-5}
              max={15}
              step={0.1}
              value={plan.assumptions.defaultReturnPct}
              onValue={(n) => patchAssumptions({ defaultReturnPct: n })}
              className={pct}
            />
            <span className="text-xs text-subtle">
              Real ≈{" "}
              {(
                ((1 + plan.assumptions.defaultReturnPct / 100) /
                  (1 + plan.assumptions.inflationPct / 100) -
                  1) *
                100
              ).toFixed(2)}
              %
            </span>
          </label>
          <label className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <span className="text-xs font-medium tracking-wide text-muted">Nominal COLA (% / yr)</span>
            <NumberInput
              min={0}
              max={15}
              step={0.1}
              value={plan.assumptions.defaultColaPct ?? 2.5}
              onValue={(n) => patchAssumptions({ defaultColaPct: n })}
              className={pct}
            />
          </label>
          <label className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <span className="text-xs font-medium tracking-wide text-muted">Inflation (% / yr)</span>
            <NumberInput
              min={0}
              max={10}
              step={0.1}
              value={plan.assumptions.inflationPct}
              onValue={(n) => patchAssumptions({ inflationPct: n })}
              className={pct}
            />
          </label>
        </div>
        <p className="text-xs leading-relaxed text-[#5c4a18]">
          COLA is the default for every income. It steps up each January and stays flat the rest of
          the year. Set a different COLA on an income in Orient.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <span className="text-xs font-medium tracking-wide text-muted">Ordinary tax rate (%)</span>
            <NumberInput
              min={0}
              max={50}
              step={1}
              value={plan.assumptions.ordinaryTaxRatePct}
              onValue={(n) => patchAssumptions({ ordinaryTaxRatePct: n })}
              className={pct}
            />
          </label>
          <label className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <span className="text-xs font-medium tracking-wide text-muted">Sweep surplus into</span>
            <SelectInput
              value={plan.assumptions.sweepPortfolioId ?? ""}
              onChange={(e) =>
                patchAssumptions({
                  sweepPortfolioId: e.target.value === "" ? null : e.target.value,
                })
              }
              className="w-[18rem] max-w-none"
            >
              <option value="">Do not sweep (spend leftover)</option>
              {plan.portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name.trim() || "Untitled account"}
                </option>
              ))}
            </SelectInput>
          </label>
        </div>
      </div>
    </div>
  );
}

function AddDependentPrompt({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (name: string, birthDate: string) => void;
}) {
  const onCancelRef = useRef(onCancel);
  const [armed, setArmed] = useState(false);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  onCancelRef.current = onCancel;
  const ready = name.trim().length > 0 && birthDate.trim().length > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setArmed(true), 250);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancelRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-dependent-title"
      onMouseDown={() => {
        if (armed) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-elevated p-5 shadow-[0_0_0_1px_var(--color-border)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p id="add-dependent-title" className="font-display text-lg text-fg">
          Add additional child
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          First name and birthday only. Our privacy policy applies. MACH RUN uses the child only
          to name who owns a non-retirement custodial account, and the birthday only for any VA
          benefits step-down as children age out.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <Field label="First name">
            <TextInput
              autoFocus
              value={name}
              placeholder="First name"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Birthday">
            <DateInput value={birthDate} onValue={setBirthDate} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              if (ready) onSave(name.trim(), birthDate);
            }}
            className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
