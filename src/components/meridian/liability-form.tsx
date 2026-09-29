import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmRemove } from "@/components/meridian/confirm-remove";
import {
  InstitutionInput,
  InstitutionMark,
} from "@/components/meridian/institution-field";
import { usePlannerCopy } from "@/components/meridian/use-planner-copy";
import {
  DangerButton,
  Field,
  GhostButton,
  MonthInput,
  MonthYearMoney,
  NumberInput,
  PrimaryButton,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import { familyOwnerOptions, normalizeOwner } from "@/lib/plan/family-owners";
import { usd } from "@/lib/plan/format";
import { formatMonthYear } from "@/lib/plan/dates";
import {
  emptyLiability,
  liabilityPayoffDate,
  originalLiability,
  remainingLiability,
} from "@/lib/plan/liability";
import { newId, usePlanStore } from "@/lib/plan/store";
import type { Liability, LiabilityKind, Plan } from "@/lib/plan/types";

const KINDS: { value: LiabilityKind; label: string }[] = [
  { value: "car", label: "Car loan" },
  { value: "student", label: "Student loan" },
  { value: "heloc", label: "HELOC" },
  { value: "personal", label: "Personal loan" },
  { value: "credit_card", label: "Credit card" },
  { value: "other", label: "Other" },
];

const summaryGrid =
  "grid-cols-[minmax(0,1.15fr)_minmax(0,1.1fr)_minmax(8.5rem,8.5rem)_minmax(13rem,13rem)_minmax(8rem,8rem)_minmax(7.25rem,7.25rem)] items-center gap-x-3";
const slot = "w-[12.5rem] max-w-full shrink-0";
const control = "h-10 max-w-full";

function kindLabel(kind: LiabilityKind): string {
  return KINDS.find((row) => row.value === kind)?.label ?? "Loan";
}

function ownerLabel(plan: Plan, owner: string): string {
  return familyOwnerOptions(plan, "taxable").find((row) => row.value === normalizeOwner(owner))?.label ?? "You (primary)";
}

function whenLabel(l: Liability): string {
  const start = l.originationDate ? formatMonthYear(l.originationDate) : "—";
  const payoff = liabilityPayoffDate(l);
  const end = payoff ? formatMonthYear(payoff) : "open";
  return `${start} → ${end}`;
}

export function LiabilityForm() {
  const plan = usePlanStore((s) => s.plan);
  const addLiability = usePlanStore((s) => s.addLiability);
  const removeLiability = usePlanStore((s) => s.removeLiability);
  const copy = usePlannerCopy();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const rows = plan.liabilities ?? [];

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-4 2xl:max-w-[90rem] min-[2000px]:max-w-[110rem]">
      {copy.liabilitiesBody.trim() ? (
        <p className="whitespace-pre-wrap text-sm text-muted">{copy.liabilitiesBody}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {rows.length > 0 ? (
          <li className={`hidden px-3 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-subtle @min-[46rem]:grid ${summaryGrid}`}>
            <span className="min-w-0">Name</span>
            <span className="min-w-0">Kind</span>
            <span className="text-right">Remaining</span>
            <span>When</span>
            <span>Owner</span>
            <span />
          </li>
        ) : null}
        {rows.map((l) => (
          <LiabilityRow
            key={l.id}
            plan={plan}
            liability={l}
            open={openId === l.id}
            onEdit={() => setOpenId(l.id)}
            onSave={() => setOpenId(null)}
            onRemove={() => setPendingRemove(l.id)}
          />
        ))}
      </ul>
      <GhostButton
        onClick={() => {
          const id = newId("lia");
          addLiability({
            ...emptyLiability(),
            id,
            name: "",
            kind: "car",
          });
          setOpenId(id);
        }}
      >
        <Plus className="size-4" />
        Add liability
      </GhostButton>
      {pendingRemove ? (
        <ConfirmRemove
          title="Remove liability"
          body="Are you sure you want to remove this liability? This cannot be undone."
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            removeLiability(pendingRemove);
            if (openId === pendingRemove) setOpenId(null);
            setPendingRemove(null);
          }}
        />
      ) : null}
    </div>
  );
}

function LiabilityRow({
  plan,
  liability: l,
  open,
  onEdit,
  onSave,
  onRemove,
}: {
  plan: Plan;
  liability: Liability;
  open: boolean;
  onEdit: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const updateLiability = usePlanStore((s) => s.updateLiability);
  const asOf = plan.assumptions.asOfDate;
  const owners = familyOwnerOptions(plan, "taxable");
  const remaining = remainingLiability(l, asOf);
  const original = originalLiability(l);
  const payoff = liabilityPayoffDate(l);
  const hasLoan = l.monthlyPi > 0 && l.termYears > 0;
  const name = l.name.trim() || "Liability";

  return (
    <li className="rounded-lg bg-section-lift px-3 py-2 shadow-[0_0_0_1px_var(--color-section-lift-border)]">
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 pb-1">
            <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
              <Field label="Institution" className={slot}>
                <InstitutionInput
                  institutionId={l.institutionId ?? null}
                  institutionName={l.institutionName ?? ""}
                  onChange={(next) => updateLiability(l.id, next)}
                />
              </Field>
              <Field label="Name" className="w-[10rem] max-w-full shrink-0">
                <TextInput
                  value={l.name}
                  replaceSeed="New liability"
                  placeholder="Name this loan"
                  onChange={(e) => updateLiability(l.id, { name: e.target.value })}
                  className={control}
                />
              </Field>
              <Field label="Kind" className="w-[11.5rem] max-w-full shrink-0">
                <SelectInput
                  value={l.kind}
                  className={control}
                  onChange={(e) => updateLiability(l.id, { kind: e.target.value as LiabilityKind })}
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Account owner" className="w-[8rem] max-w-full shrink-0">
                <SelectInput
                  value={normalizeOwner(l.owner)}
                  className={control}
                  onChange={(e) => updateLiability(l.id, { owner: e.target.value })}
                >
                  {owners.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <PrimaryButton className="h-10 self-end" onClick={onSave}>
                Save liability
              </PrimaryButton>
              <div className="flex items-end justify-end">
                <DangerButton
                  aria-label={`Remove ${l.name || "liability"}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemove();
                  }}
                >
                  <Trash2 className="size-4" />
                </DangerButton>
              </div>
            </div>
            <div
              className="rounded-lg px-3 py-3"
              style={{
                background: "color-mix(in oklab, #e8c547 12%, transparent)",
                boxShadow: "0 0 0 1px color-mix(in oklab, #e8c547 45%, transparent)",
              }}
            >
              <p className="text-xs font-medium tracking-wide text-[#5c4a18]">Loan terms</p>
              <p className="mt-1 text-xs leading-relaxed text-[#5c4a18]">
                Remaining principal is subtracted from net worth. Check the box only if this P&I is not already in Spending.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
                <Field label="Origination (month/year)" className="w-auto shrink-0">
                  <MonthInput
                    value={l.originationDate}
                    onValue={(v) => updateLiability(l.id, { originationDate: v })}
                  />
                </Field>
                <Field label="APR (%)" className="w-[5rem] shrink-0">
                  <NumberInput
                    min={0}
                    max={25}
                    step={0.125}
                    value={l.aprPct}
                    onValue={(n) => updateLiability(l.id, { aprPct: n })}
                  />
                </Field>
                <MonthYearMoney
                  compact
                  fieldClassName="w-[6.75rem] shrink-0"
                  monthLabel="P&I / month"
                  yearLabel="P&I / year"
                  monthly={l.monthlyPi || 0}
                  onMonthly={(n) => updateLiability(l.id, { monthlyPi: n })}
                />
                <Field label="Length (years)" className="w-[6.25rem] shrink-0">
                  <NumberInput
                    min={1}
                    max={50}
                    step={1}
                    value={l.termYears}
                    onValue={(n) => updateLiability(l.id, { termYears: n })}
                  />
                </Field>
                <Field label="In spending" className="w-auto shrink-0">
                  <label className="flex h-10 items-center gap-2 text-xs text-[#5c4a18]">
                    <input
                      type="checkbox"
                      checked={Boolean(l.includeInSpending)}
                      onChange={(e) => updateLiability(l.id, { includeInSpending: e.target.checked })}
                    />
                    Yes
                  </label>
                </Field>
              </div>
              {hasLoan ? (
                <p className="mt-3 text-xs leading-relaxed text-[#5c4a18]">
                  Original principal about {usd(original)}. Remaining now {usd(remaining)}
                  {payoff ? ` · paid off ${payoff.slice(0, 7)}` : ""}.
                </p>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-[#5c4a18]">
                  Enter P&I, APR, origination, and term to model the loan.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "0fr" : "1fr" }}
        inert={open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex items-center gap-3 @min-[46rem]:hidden">
            <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-fg">
              <InstitutionMark
                institutionId={l.institutionId ?? null}
                institutionName={l.institutionName ?? ""}
                size={18}
              />
              <span className="min-w-0 truncate">
                <span className="font-medium">{name}</span>
                <span className="text-muted"> · {kindLabel(l.kind)}</span>
                <span className="text-muted"> · {hasLoan ? usd(remaining) : "—"}</span>
                <span className="text-muted"> · {whenLabel(l)}</span>
                <span className="text-muted"> · {ownerLabel(plan, l.owner)}</span>
              </span>
            </p>
            <button type="button" className="shrink-0 text-xs text-muted hover:text-negative" onClick={onRemove}>
              Remove
            </button>
            <button type="button" className="shrink-0 text-sm font-medium text-fg" onClick={onEdit}>
              Edit
            </button>
          </div>
          <div className={`hidden text-sm @min-[46rem]:grid ${summaryGrid}`}>
            <span className="flex min-w-0 items-center gap-1.5 font-medium text-fg">
              <InstitutionMark
                institutionId={l.institutionId ?? null}
                institutionName={l.institutionName ?? ""}
                size={18}
              />
              <span className="min-w-0 truncate">{name}</span>
            </span>
            <span className="min-w-0 truncate text-muted">{kindLabel(l.kind)}</span>
            <span className="min-w-0 truncate whitespace-nowrap text-right tabular-nums text-fg">
              {hasLoan ? usd(remaining) : "—"}
            </span>
            <span className="min-w-0 truncate whitespace-nowrap tabular-nums text-muted">{whenLabel(l)}</span>
            <span className="min-w-0 truncate text-muted">{ownerLabel(plan, l.owner)}</span>
            <span className="flex min-w-0 items-center justify-end gap-3">
              <button type="button" className="text-xs text-muted hover:text-negative" onClick={onRemove}>
                Remove
              </button>
              <button type="button" className="font-medium text-fg" onClick={onEdit}>
                Edit
              </button>
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
