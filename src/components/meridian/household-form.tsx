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
  const [householdPick, setHouseholdPick] = useState<"me" | "spouse" | null>(spouseOnFile ? "spouse" : null);
  const [includeSpouse, setIncludeSpouse] = useState(spouseOnFile);
  const [addingDependent, setAddingDependent] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [removingChildId, setRemovingChildId] = useState<string | null>(null);

  useEffect(() => {
    if (spouseOnFile) {
      setIncludeSpouse(true);
      setHouseholdPick("spouse");
    }
  }, [spouseOnFile]);

  return (
    <div className="flex w-full flex-col">
      <div className="mb-4 flex gap-1.5" aria-hidden="true">
        <span className={plan.primary.name.trim() ? "h-1.5 flex-1 rounded-full bg-[#3a8a58]" : "h-1.5 flex-1 rounded-full bg-[#d5d0c6]"} />
        <span className={householdPick ? "h-1.5 flex-1 rounded-full bg-[#3a8a58]" : "h-1.5 flex-1 rounded-full bg-[#d5d0c6]"} />
        <span className={plan.primary.birthDate ? "h-1.5 flex-1 rounded-full bg-[#3a8a58]" : "h-1.5 flex-1 rounded-full bg-[#d5d0c6]"} />
      </div>
      <h2 className="text-center font-sans text-[1.65rem] font-medium leading-tight text-[#1a2330]">
        Who is this plan for?
      </h2>
      <p className="mt-2 text-center text-sm text-[#3d4a54]">Start with you. Add a spouse or a child if they belong here.</p>
      <div className="mt-6 flex flex-col gap-4">
        <Field label="Your name" className="w-full items-center text-center [&>span]:w-full">
          <TextInput
            value={plan.primary.name}
            onChange={(e) => patchPrimary({ name: e.target.value })}
            placeholder="Name"
            className="max-w-none text-center text-base"
          />
        </Field>
        <Field label="Your birthday" className="w-full items-center text-center [&>span]:w-full">
          <DateInput
            value={plan.primary.birthDate}
            onValue={(v) => patchPrimary({ birthDate: v })}
            className="justify-center"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={householdPick === "me"}
            onClick={() => {
              setHouseholdPick("me");
              setIncludeSpouse(false);
              patchSpouse({ name: "", birthDate: "" });
            }}
            className={
              householdPick === "me"
                ? "min-h-14 rounded-xl bg-[#3a8a58] px-2 text-base font-medium text-white"
                : "min-h-14 rounded-xl bg-[#f3f0e8] px-2 text-base text-[#1a2330]"
            }
          >
            Just me
          </button>
          <button
            type="button"
            aria-pressed={householdPick === "spouse"}
            onClick={() => {
              setHouseholdPick("spouse");
              setIncludeSpouse(true);
            }}
            className={
              householdPick === "spouse"
                ? "min-h-14 rounded-xl bg-[#3a8a58] px-2 text-base font-medium text-white"
                : "min-h-14 rounded-xl bg-[#f3f0e8] px-2 text-base text-[#1a2330]"
            }
          >
            Spouse or partner
          </button>
        </div>
        {includeSpouse ? (
          <div className="flex flex-col gap-4">
            <Field label="Their name" className="w-full items-center text-center [&>span]:w-full">
              <TextInput
                value={plan.spouse.name}
                onChange={(e) => patchSpouse({ name: e.target.value })}
                placeholder="Name"
                className="max-w-none text-center text-base"
              />
            </Field>
            <Field label="Their birthday" className="w-full items-center text-center [&>span]:w-full">
              <DateInput
                value={plan.spouse.birthDate}
                onValue={(v) => patchSpouse({ birthDate: v })}
                className="justify-center"
              />
            </Field>
          </div>
        ) : null}
        <button
          type="button"
          className="min-h-12 rounded-xl bg-[#f3f0e8] px-3 text-base text-[#1a2330] hover:bg-[#e7e2d8]"
          onClick={() => setAddingDependent(true)}
        >
          Add a child
        </button>
        {plan.children.length ? (
          <div className="flex flex-col gap-2 border-t border-[#e7e2d8] pt-4">
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
                <li key={child.id} className="rounded-xl bg-[#f3f0e8] px-3 py-2">
                  {editing ? (
                    <div className="flex flex-col gap-3">
                      <Field label="First name" className="w-full items-center text-center [&>span]:w-full">
                        <TextInput
                          value={child.name}
                          onChange={(e) => updateChild(child.id, { name: e.target.value })}
                          className="max-w-none text-center"
                        />
                      </Field>
                      <Field label="Birthday" className="w-full items-center text-center [&>span]:w-full">
                        <DateInput
                          value={child.birthDate}
                          onValue={(v) => updateChild(child.id, { birthDate: v })}
                          className="justify-center"
                        />
                      </Field>
                      <div className="flex items-center justify-center gap-4">
                        <button type="button" className="text-sm font-medium text-fg" onClick={() => setEditingChildId(null)}>
                          Save and Close
                        </button>
                        <button type="button" className="text-xs text-muted hover:text-negative" onClick={() => setRemovingChildId(child.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-sm font-medium text-fg">{name}</span>
                        <span className="block text-xs text-muted">{age === "—" ? born : `Age ${age} · ${born}`}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <button type="button" className="text-xs text-muted hover:text-negative" onClick={() => setRemovingChildId(child.id)}>
                          Remove
                        </button>
                        <button type="button" className="text-sm font-medium text-fg" onClick={() => setEditingChildId(child.id)}>
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

export function GoalsForm() {
  const plan = usePlanStore((s) => s.plan);
  const patchAssumptions = usePlanStore((s) => s.patchAssumptions);
  const [editingAsOf, setEditingAsOf] = useState(false);
  const ask = "w-full items-center text-center [&>span]:w-full";
  const num = "max-w-none text-center text-base";
  const goal = plan.assumptions.retirementGoalDate;
  const asOf = plan.assumptions.asOfDate.slice(0, 7);
  const already = Boolean(goal && goal.slice(0, 7) <= asOf);
  const incomeMode = plan.assumptions.goalMode === "income";
  const bar = (on: boolean) => (on ? "h-1.5 flex-1 rounded-full bg-[#3a8a58]" : "h-1.5 flex-1 rounded-full bg-[#d5d0c6]");
  const dated = Boolean(goal);
  const longevity = Boolean(plan.assumptions.longevitySeen);
  const aimed = incomeMode
    ? (plan.assumptions.incomeGoalMonthly ?? 0) > 0
    : (plan.assumptions.nestEggGoal ?? 0) > 0;
  const pill = (on: boolean) =>
    on
      ? "min-h-14 rounded-xl bg-[#3a8a58] px-2 text-base font-medium text-white"
      : "min-h-14 rounded-xl bg-[#f3f0e8] px-2 text-base text-[#1a2330]";

  return (
    <div className="flex w-full flex-col">
      <div className="mb-4 flex gap-1.5" aria-hidden="true">
        <span className={bar(dated)} />
        <span className={bar(longevity)} />
        <span className={bar(aimed)} />
      </div>
      <h2 className="text-center font-sans text-[1.65rem] font-medium leading-tight text-[#1a2330]">
        What are you aiming for?
      </h2>
      <p className="mt-2 text-center text-sm text-[#3d4a54]">
        Balances peg to the as-of date. Blank end dates run through the longevity age. Act’s Spendable strip keys off the retirement date. Pick a nest egg or a monthly paycheck. Pension, VA, military retired pay, and Social Security in this run count toward the paycheck. A blank goal is not scored.
      </p>
      <div className="mt-6 flex flex-col gap-4">
        <Field label="As-of date" className={ask}>
          {editingAsOf ? (
            <DateInput
              className="justify-center"
              value={plan.assumptions.asOfDate}
              onValue={(v) => {
                if (v) patchAssumptions({ asOfDate: v });
              }}
            />
          ) : (
            <div className="flex h-11 items-center justify-center gap-3">
              <p className="min-w-0 text-base text-[#1a2330]">{longDate(plan.assumptions.asOfDate)}</p>
              <button
                type="button"
                className="shrink-0 text-sm text-[#1a2330] underline-offset-4 hover:underline"
                onClick={() => setEditingAsOf(true)}
              >
                Change
              </button>
            </div>
          )}
        </Field>
        <Field label="Project through longevity age" className={ask}>
          <NumberInput
            min={70}
            max={110}
            step={1}
            value={plan.assumptions.projectionEndAge}
            onValue={(n) => patchAssumptions({ projectionEndAge: n })}
            onBlur={() => {
              if (!plan.assumptions.longevitySeen) patchAssumptions({ longevitySeen: true });
            }}
            className={num}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={!already}
            className={pill(!already)}
            onClick={() => patchAssumptions({ retirementGoalDate: null })}
          >
            Still working
          </button>
          <button
            type="button"
            aria-pressed={already}
            className={pill(already)}
            onClick={() => patchAssumptions({ retirementGoalDate: `${asOf}-01` })}
          >
            Already retired
          </button>
        </div>
        <Field label={already ? "Retired" : "Retirement goal date"} className={ask}>
          {already ? (
            <MonthInput
              className="justify-center"
              value={goal}
              onValue={(v) => patchAssumptions({ retirementGoalDate: v === "" ? null : v })}
            />
          ) : (
            <DateInput
              className="justify-center"
              value={goal}
              onValue={(v) => patchAssumptions({ retirementGoalDate: v === "" ? null : v })}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={!incomeMode}
            className={pill(!incomeMode)}
            onClick={() => patchAssumptions({ goalMode: "nest" })}
          >
            Nest egg
          </button>
          <button
            type="button"
            aria-pressed={incomeMode}
            className={pill(incomeMode)}
            onClick={() => patchAssumptions({ goalMode: "income" })}
          >
            Monthly income
          </button>
        </div>
        {incomeMode ? (
          <Field label="Desired monthly income in retirement from the nest egg" className={ask}>
            <MoneyInput
              value={plan.assumptions.incomeGoalMonthly ?? 0}
              onValue={(n) => patchAssumptions({ incomeGoalMonthly: n > 0 ? n : null })}
              className={num}
            />
          </Field>
        ) : (
          <Field label="Nest egg goal (today $)" className={ask}>
            <MoneyInput
              value={plan.assumptions.nestEggGoal ?? 0}
              onValue={(n) => patchAssumptions({ nestEggGoal: n > 0 ? n : null })}
              className={num}
            />
          </Field>
        )}
      </div>
    </div>
  );
}


export function AssumptionsForm() {
  const plan = usePlanStore((s) => s.plan);
  const patchAssumptions = usePlanStore((s) => s.patchAssumptions);
  const inflation = plan.assumptions.inflationPct;
  const realNow = (
    ((1 + plan.assumptions.defaultReturnPct / 100) / (1 + inflation / 100) - 1) *
    100
  ).toFixed(2);
  const realLater = (
    ((1 + (plan.assumptions.retirementReturnPct ?? 5) / 100) / (1 + inflation / 100) - 1) *
    100
  ).toFixed(2);
  const ask = "w-full items-center text-center [&>span]:w-full";
  const num = "max-w-none text-center text-base";
  const returnsOn = Boolean(plan.assumptions.workingReturnSeen);
  const laterOn = Boolean(plan.assumptions.retirementReturnSeen);
  const restOn = Boolean(plan.assumptions.sweepChosen) || Boolean(plan.assumptions.sweepPortfolioId);
  const bar = (on: boolean) => (on ? "h-1.5 flex-1 rounded-full bg-[#3a8a58]" : "h-1.5 flex-1 rounded-full bg-[#d5d0c6]");

  return (
    <div className="flex w-full flex-col">
      <div className="mb-4 flex gap-1.5" aria-hidden="true">
        <span className={bar(returnsOn)} />
        <span className={bar(laterOn)} />
        <span className={bar(restOn)} />
      </div>
      <h2 className="text-center font-sans text-[1.65rem] font-medium leading-tight text-[#1a2330]">
        What should this plan assume?
      </h2>
      <p className="mt-2 text-center text-sm text-[#3d4a54]">
        Returns, COLA, inflation, tax, and where a surplus goes.
      </p>
      <div className="mt-6 flex flex-col gap-4">
        <Field label="Nominal return, percent a year" className={ask}>
          <NumberInput
            min={-5}
            max={15}
            step={0.1}
            value={plan.assumptions.defaultReturnPct}
            onValue={(n) => patchAssumptions({ defaultReturnPct: n })}
            onBlur={() => {
              if (!plan.assumptions.workingReturnSeen) patchAssumptions({ workingReturnSeen: true });
            }}
            className={num}
          />
          <span className="text-center text-sm text-[#3d4a54]">Real, about {realNow}%</span>
        </Field>
        <Field label="Nominal return in retirement, percent a year" className={ask}>
          <NumberInput
            min={-5}
            max={15}
            step={0.1}
            value={plan.assumptions.retirementReturnPct ?? 5}
            onValue={(n) => patchAssumptions({ retirementReturnPct: n })}
            onBlur={() => {
              if (!plan.assumptions.retirementReturnSeen) patchAssumptions({ retirementReturnSeen: true });
            }}
            className={num}
          />
          <span className="text-center text-sm text-[#3d4a54]">Real, about {realLater}%</span>
        </Field>
        <Field label="Nominal COLA, percent a year" className={ask}>
          <NumberInput
            min={0}
            max={15}
            step={0.1}
            value={plan.assumptions.defaultColaPct ?? 2.5}
            onValue={(n) => patchAssumptions({ defaultColaPct: n })}
            className={num}
          />
        </Field>
        <Field label="Inflation, percent a year" className={ask}>
          <NumberInput
            min={0}
            max={10}
            step={0.1}
            value={plan.assumptions.inflationPct}
            onValue={(n) => patchAssumptions({ inflationPct: n })}
            className={num}
          />
        </Field>
        <p className="text-center text-sm leading-relaxed text-[#3d4a54]">
          COLA is the default for every income. It steps up each January and stays flat the rest of the year. Set a different COLA on an income in Orient.
        </p>
        <Field label="Ordinary tax rate, percent" className={ask}>
          <NumberInput
            min={0}
            max={50}
            step={1}
            value={plan.assumptions.ordinaryTaxRatePct}
            onValue={(n) => patchAssumptions({ ordinaryTaxRatePct: n })}
            className={num}
          />
        </Field>
        <Field label="Sweep surplus into" className={ask}>
          <SelectInput
            value={
              plan.assumptions.sweepChosen
                ? (plan.assumptions.sweepPortfolioId ?? "cash")
                : ""
            }
            onChange={(e) => {
              const value = e.target.value;
              if (!value) return;
              patchAssumptions(
                value === "cash"
                  ? { sweepPortfolioId: null, sweepChosen: true }
                  : { sweepPortfolioId: value, sweepChosen: true },
              );
            }}
            className={num}
          >
            <option value="" disabled>
              {" "}
            </option>
            <option value="cash">Do not sweep (hold as cash)</option>
            {plan.portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name.trim() || "Untitled account"}
              </option>
            ))}
          </SelectInput>
        </Field>
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
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
          if (event.nativeEvent.isComposing) return;
          const tag = (event.target as HTMLElement | null)?.tagName;
          if (tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;
          if (!ready) return;
          event.preventDefault();
          onSave(name.trim(), birthDate);
        }}
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
