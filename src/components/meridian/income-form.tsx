import { useEffect } from "react";
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
import type { IncomeKind, IncomeStream, TaxTreatment } from "@/lib/plan/types";
import { newId, usePlanStore } from "@/lib/plan/store";
import { ssBenefitFromPia, ssScheduleDates } from "@/lib/plan/social-security";
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
  const addIncome = usePlanStore((s) => s.addIncome);
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
          <IncomeRow key={s.id} stream={s} index={i} />
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

function IncomeRow({ stream: s, index: i }: { stream: IncomeStream; index: number }) {
  const plan = usePlanStore((s) => s.plan);
  const updateIncome = usePlanStore((s) => s.updateIncome);
  const removeIncome = usePlanStore((s) => s.removeIncome);
  const ssOrdinal =
    plan.incomes.filter((row) => row.kind === "ss").findIndex((row) => row.id === s.id) + 1;
  const person: "primary" | "spouse" = s.person === "spouse" ? "spouse" : "primary";
  const owner =
    person === "spouse"
      ? plan.spouse
      : plan.primary;
  const ownerLabel =
    owner.name.trim() || (person === "spouse" ? "Spouse" : "You (primary)");
  const claimAge = s.ssClaimAge ?? 67;
  const endAge = plan.assumptions.projectionEndAge;
  const ssWindow = ssScheduleDates(owner.birthDate, claimAge, endAge);

  useEffect(() => {
    if (s.kind !== "ss") return;
    if (!ssWindow) return;
    if (s.startDate === ssWindow.startDate && s.endDate === ssWindow.endDate) return;
    updateIncome(s.id, { startDate: ssWindow.startDate, endDate: ssWindow.endDate });
  }, [
    s.kind,
    s.id,
    s.startDate,
    s.endDate,
    ssWindow?.startDate,
    ssWindow?.endDate,
    updateIncome,
  ]);

  function setKind(kind: IncomeKind) {
    if (kind === "ss") {
      const others = plan.incomes.filter((row) => row.id !== s.id && row.kind === "ss");
      const primaryTaken = others.some((row) => row.person === "primary");
      const nextPerson: "primary" | "spouse" =
        primaryTaken && (plan.spouse.name.trim() || plan.spouse.birthDate)
          ? "spouse"
          : "primary";
      const birth =
        nextPerson === "spouse" ? plan.spouse.birthDate : plan.primary.birthDate;
      const window = ssScheduleDates(birth, s.ssClaimAge ?? 67, endAge);
      updateIncome(s.id, {
        kind,
        person: nextPerson,
        taxTreatment: "ss",
        ssClaimAge: s.ssClaimAge ?? 67,
        ...(window ?? {}),
      });
      return;
    }
    updateIncome(s.id, {
      kind,
      ...(kind === "va" ? { taxTreatment: "tax_free" as TaxTreatment } : {}),
    });
  }

  function setPerson(next: "primary" | "spouse") {
    const birth =
      next === "spouse" ? plan.spouse.birthDate : plan.primary.birthDate;
    const window = ssScheduleDates(birth, claimAge, endAge);
    updateIncome(s.id, { person: next, ...(window ?? {}) });
  }

  function setClaimAge(n: number) {
    const window = ssScheduleDates(owner.birthDate, n, endAge);
    updateIncome(s.id, { ssClaimAge: n, ...(window ?? {}) });
  }

  return (
    <li className="rounded-lg bg-elevated p-3 shadow-[0_0_0_1px_var(--color-border)]">
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
        <Field label="Kind">
          <SelectInput
            value={s.kind}
            onChange={(e) => setKind(e.target.value as IncomeKind)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        {s.kind === "ss" ? (
          <>
            <Field
              label="Who is this Social Security for?"
              hint="Names come from Family in Observe."
            >
              <SelectInput
                value={person}
                onChange={(e) =>
                  setPerson(e.target.value === "spouse" ? "spouse" : "primary")
                }
              >
                <option value="primary">
                  {plan.primary.name.trim() || "You (primary)"}
                </option>
                <option value="spouse">
                  {plan.spouse.name.trim() || "Spouse"}
                </option>
              </SelectInput>
            </Field>
            {s.kind === "ss" && ssOrdinal >= 3 ? (
              <p className="text-xs leading-relaxed text-[#e8c547]">
                You already have two Social Security incomes. Are you sure you
                want a third? That’s unusual unless another family member lives
                with you and has their own benefit.
              </p>
            ) : null}
            <Field
              label="PIA at FRA (today $)"
              hint={
                s.ssPia
                  ? `Pays ${usd(ssBenefitFromPia(s.ssPia, claimAge, s.ssFra ?? 67), true)}/mo at claim age ${claimAge}`
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
                value={claimAge}
                onValue={setClaimAge}
              />
            </Field>
            {!ssWindow ? (
              <p className="text-xs leading-relaxed text-[#e8c547]">
                Add a birth date for {ownerLabel} in Family so MACH RUN can set
                the Social Security start and end dates.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-[#e8c547]">
                Social Security for {ownerLabel} starts at claiming age {claimAge}{" "}
                and is set to expire at age {endAge} (Family → Project through
                primary age).
              </p>
            )}
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
            onValue={(v) => updateIncome(s.id, { endDate: v === "" ? null : v })}
          />
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
  );
}