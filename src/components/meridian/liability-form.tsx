import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmRemove } from "@/components/meridian/confirm-remove";
import { snapMobileStepTop } from "@/components/meridian/snap-mobile-top";
import { InstitutionInput } from "@/components/meridian/institution-field";
import { usePlannerCopy } from "@/components/meridian/use-planner-copy";
import {
  Field,
  MonthInput,
  MonthYearMoney,
  NumberInput,
  PrimaryButton,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import { familyOwnerOptions, normalizeOwner } from "@/lib/plan/family-owners";
import { usd } from "@/lib/plan/format";
import {
  emptyLiability,
  liabilityPayoffDate,
  originalLiability,
  remainingLiability,
  syncLiabilitySpending,
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

const ask = "w-full items-center text-center [&>span]:w-full";
const control = "max-w-none text-center text-base";
const HIDE_SPENDING_NOTICE = "mach-hide-liability-spending-notice";

function spendingNoticeHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDE_SPENDING_NOTICE) === "1";
  } catch {
    return false;
  }
}

function hideSpendingNoticeNextTime() {
  try {
    window.localStorage.setItem(HIDE_SPENDING_NOTICE, "1");
  } catch {
    /* private mode */
  }
}

function kindLabel(kind: LiabilityKind): string {
  return KINDS.find((row) => row.value === kind)?.label ?? "Loan";
}

export function LiabilityForm({ onNone }: { onNone?: () => void }) {
  const plan = usePlanStore((s) => s.plan);
  const addLiability = usePlanStore((s) => s.addLiability);
  const removeLiability = usePlanStore((s) => s.removeLiability);
  const declareNoLiabilities = usePlanStore((s) => s.declareNoLiabilities);
  const copy = usePlannerCopy();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const rows = plan.liabilities ?? [];

  useEffect(() => {
    const live = usePlanStore.getState().plan;
    const spending = syncLiabilitySpending(live);
    if (spending === live.spending) return;
    usePlanStore.getState().setPlan({ ...live, spending });
  }, [plan.liabilities]);

  const none = plan.noLiabilities === true && rows.length === 0;
  const named = none || rows.some((l) => l.name.trim().length > 0);
  const terms =
    none ||
    rows.some(
      (l) =>
        Boolean(l.originationDate) &&
        Number.isFinite(l.aprPct) &&
        l.monthlyPi > 0 &&
        l.termYears > 0,
    );
  const ownersReady = none || (rows.length > 0 && rows.every((l) => Boolean(normalizeOwner(l.owner))));
  const bar = (on: boolean) => (on ? "h-1.5 flex-1 rounded-full bg-[#3a8a58]" : "h-1.5 flex-1 rounded-full bg-[#d5d0c6]");

  return (
    <div className="flex w-full flex-col">
      <div className="mb-4 flex gap-1.5" aria-hidden="true">
        <span className={bar(named)} />
        <span className={bar(terms)} />
        <span className={bar(ownersReady)} />
      </div>
      <h2 className="text-center font-sans text-[1.65rem] font-medium leading-tight text-[#1a2330]">
        What do you owe?
      </h2>
      {copy.liabilitiesBody.trim() ? (
        <p className="mt-2 whitespace-pre-wrap text-center text-sm text-[#3d4a54]">{copy.liabilitiesBody}</p>
      ) : null}
      <div className="mt-6 flex flex-col gap-4">
        {rows.length ? (
          <ul className="flex flex-col gap-2">
            {rows.map((l) => (
              <LiabilityRow
                key={l.id}
                plan={plan}
                liability={l}
                open={openId === l.id}
                onEdit={() => setOpenId(l.id)}
                onSave={() => {
                  setOpenId(null);
                  snapMobileStepTop();
                }}
                onRemove={() => setPendingRemove(l.id)}
              />
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          className="min-h-12 rounded-xl bg-[#f3f0e8] px-3 text-base text-[#1a2330] hover:bg-[#e7e2d8]"
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
          Add liability
        </button>
        {rows.length === 0 ? (
          <button
            type="button"
            className="min-h-12 rounded-xl bg-[#f3f0e8] px-3 text-base text-[#1a2330] hover:bg-[#e7e2d8]"
            onClick={() => {
              declareNoLiabilities();
              onNone?.();
            }}
          >
            I have no liabilities
          </button>
        ) : null}
      </div>
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
  const [spendingNotice, setSpendingNotice] = useState(false);

  return (
    <li className="rounded-xl bg-[#f3f0e8] px-3 py-2">
      {open ? (
        <div className="flex flex-col gap-4 py-2">
          <Field label="Institution" className={ask}>
            <InstitutionInput
              institutionId={l.institutionId ?? null}
              institutionName={l.institutionName ?? ""}
              onChange={(next) => updateLiability(l.id, next)}
            />
          </Field>
          <Field label="Name" className={ask}>
            <TextInput
              value={l.name}
              replaceSeed="New liability"
              placeholder="Name this loan"
              onChange={(e) => updateLiability(l.id, { name: e.target.value })}
              className={control}
            />
          </Field>
          <Field label="Kind" className={ask}>
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
          <Field label="Account owner" className={ask}>
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
          <p className="text-center text-sm leading-relaxed text-[#3d4a54]">
            Remaining principal is subtracted from net worth. Check the box only if this P&I is not already in Spending.
          </p>
          <Field label="Origination (month/year)" className={ask}>
            <MonthInput
              value={l.originationDate}
              onValue={(v) => updateLiability(l.id, { originationDate: v })}
              className="justify-center"
            />
          </Field>
          <Field label="APR (%)" className={ask}>
            <NumberInput
              min={0}
              max={25}
              step={0.125}
              value={l.aprPct}
              className={control}
              onValue={(n) => updateLiability(l.id, { aprPct: n })}
            />
          </Field>
          <MonthYearMoney
            compact
            fieldClassName={ask}
            monthLabel="P&I / month"
            yearLabel="P&I / year"
            monthly={l.monthlyPi || 0}
            onMonthly={(n) => updateLiability(l.id, { monthlyPi: n })}
          />
          <Field label="Length (years)" className={ask}>
            <NumberInput
              min={1}
              max={50}
              step={1}
              value={l.termYears}
              className={control}
              onValue={(n) => updateLiability(l.id, { termYears: n })}
            />
          </Field>
          <Field label="Automatically include in spending calculation?" className={ask}>
            <label className="flex items-center justify-center gap-2 text-sm text-[#1a2330]">
              <input
                type="checkbox"
                checked={Boolean(l.includeInSpending)}
                onChange={(e) => {
                  const on = e.target.checked;
                  updateLiability(l.id, { includeInSpending: on });
                  if (on && !spendingNoticeHidden()) setSpendingNotice(true);
                }}
              />
              Yes
            </label>
          </Field>
          <p className="text-center text-sm leading-relaxed text-[#3d4a54]">
            {hasLoan
              ? `Original principal about ${usd(original)}. Remaining now ${usd(remaining)}${payoff ? ` · paid off ${payoff.slice(0, 7)}` : ""}.`
              : "Enter P&I, APR, origination, and term to model the loan."}
          </p>
          <button type="button" className="min-h-12 rounded-xl bg-[#3a8a58] px-3 text-base font-medium text-white" onClick={onSave}>
            Save liability
          </button>
          <button type="button" className="text-sm text-muted hover:text-negative" onClick={onRemove}>
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-medium text-fg">{name}</span>
            <span className="block text-xs text-muted">
              {kindLabel(l.kind)} · {hasLoan ? usd(remaining) : "—"}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <button type="button" className="text-xs text-muted hover:text-negative" onClick={onRemove}>
              Remove
            </button>
            <button type="button" className="text-sm font-medium text-fg" onClick={onEdit}>
              Edit
            </button>
          </span>
        </div>
      )}
      {spendingNotice ? <SpendingIncludeNotice onClose={() => setSpendingNotice(false)} /> : null}
    </li>
  );
}


function SpendingIncludeNotice({ onClose }: { onClose: () => void }) {
  const [hideNext, setHideNext] = useState(false);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="spending-include-title"
    >
      <div className="w-full max-w-md rounded-xl bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--color-border)]">
        <p id="spending-include-title" className="text-sm leading-relaxed text-fg">
          This monthly debt payment will be included in monthly spending automatically. It will end
          at the scheduled payoff date. MACH RUN adds a spending line for this liability.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            className="size-4 shrink-0"
            checked={hideNext}
            onChange={(e) => setHideNext(e.target.checked)}
          />
          Do not show this message again
        </label>
        <PrimaryButton
          className="mt-4 h-9 w-auto px-4 text-sm"
          onClick={() => {
            if (hideNext) hideSpendingNoticeNextTime();
            onClose();
          }}
        >
          OK
        </PrimaryButton>
      </div>
    </div>,
    document.body,
  );
}
