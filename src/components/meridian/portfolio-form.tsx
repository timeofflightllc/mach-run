import { useState, type ReactNode } from "react";
import { ConfirmRemove } from "@/components/meridian/confirm-remove";
import {
  Field,
  MonthInput,
  NumberInput,
  MonthYearMoney,
  MoneyInput,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import type { AccountKind, Mortgage, Plan, Portfolio, TaxBucket } from "@/lib/plan/types";
import { newId, usePlanStore } from "@/lib/plan/store";
import { usd } from "@/lib/plan/format";
import { startingNetWorth, startingSpendable } from "@/lib/plan/engine";
import {
  emptyMortgage,
  mortgageAssociated,
  mortgagePayoffDate,
  originalPrincipal,
  remainingMortgage,
} from "@/lib/plan/mortgage";
import { UpgradeNudge } from "@/components/meridian/upgrade-nudge";
import { InstitutionInput } from "@/components/meridian/institution-field";
import { atAccountCap, useEntitlement } from "@/lib/billing/use-entitlement";
import { hasBalanceSheet } from "@/lib/billing/limits";
import { usePlannerCopy } from "@/components/meridian/use-planner-copy";
import { fillPlanner } from "@/lib/site-copy/planner-copy";
import { formatMonthYear } from "@/lib/plan/dates";
import {
  accountOwnerOptions,
  accountOwnerValue,
  childIdFromOwner,
  explicitTaxOwner,
  needsTaxOwner,
} from "@/lib/plan/family-owners";
import { child529StopDate, sunsetAgeOf } from "@/lib/plan/college-529";

const KIND_LABELS: { value: AccountKind; label: string; bucket: TaxBucket }[] = [
  { value: "401k", label: "401(k)", bucket: "pre_tax" },
  { value: "401k_roth", label: "401(k) Roth", bucket: "roth" },
  { value: "ira", label: "Traditional IRA", bucket: "pre_tax" },
  { value: "roth_ira", label: "Roth IRA", bucket: "roth" },
  { value: "tsp", label: "TSP", bucket: "pre_tax" },
  { value: "tsp_roth", label: "Roth TSP", bucket: "roth" },
  { value: "roth", label: "Roth (other)", bucket: "roth" },
  { value: "traditional", label: "Traditional (other)", bucket: "pre_tax" },
  { value: "taxable", label: "Taxable brokerage", bucket: "taxable" },
  { value: "annuity", label: "Annuity (non-qualified)", bucket: "taxable" },
  { value: "cash", label: "Cash", bucket: "taxable" },
  { value: "529", label: "529", bucket: "none" },
  { value: "ugma", label: "UGMA / UTMA", bucket: "none" },
  { value: "trump", label: "Trump Account", bucket: "pre_tax" },
  { value: "education", label: "Education", bucket: "none" },
  { value: "real_estate", label: "Real estate", bucket: "none" },
  { value: "other", label: "Other", bucket: "none" },
];

const BUCKETS: { value: TaxBucket; label: string }[] = [
  { value: "roth", label: "Roth" },
  { value: "pre_tax", label: "Pre-tax" },
  { value: "taxable", label: "Taxable" },
  { value: "none", label: "None" },
];

const ask = "w-full items-center text-center [&>span]:w-full";
const slot = ask;
const slotName = ask;
const slotType = ask;
const slotTax = ask;
const slotReturn = ask;
const slotValue = ask;
const slotOwner = ask;
const control = "max-w-none text-center text-base";

export function PortfolioForm() {
  const plan = usePlanStore((s) => s.plan);
  const updatePortfolio = usePlanStore((s) => s.updatePortfolio);
  const addPortfolio = usePlanStore((s) => s.addPortfolio);
  const removePortfolio = usePlanStore((s) => s.removePortfolio);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const ent = useEntitlement();
  const capped = atAccountCap(plan.portfolios.length, ent);

  const spendable = startingSpendable(plan);
  const net = startingNetWorth(plan);
  const copy = usePlannerCopy();

  const named = plan.portfolios.some((p) => p.name.trim().length > 0);
  const balanced = plan.portfolios.some((p) => p.currentValue > 0);
  const ownersReady =
    plan.portfolios.length > 0 &&
    plan.portfolios.every((p) => !needsTaxOwner(p.kind) || Boolean(explicitTaxOwner(p.owner)));
  const bar = (on: boolean) => (on ? "h-1.5 flex-1 rounded-full bg-[#3a8a58]" : "h-1.5 flex-1 rounded-full bg-[#d5d0c6]");
  const assetsLine = copy.assetsBody.trim()
    ? fillPlanner(copy.assetsBody, {
        spendable: usd(spendable),
        net: usd(net),
        return: String(plan.assumptions.defaultReturnPct),
      })
    : "";

  return (
    <div className="flex w-full flex-col">
      <div className="mb-4 flex gap-1.5" aria-hidden="true">
        <span className={bar(named)} />
        <span className={bar(balanced)} />
        <span className={bar(ownersReady)} />
      </div>
      <h2 className="text-center font-sans text-[1.65rem] font-medium leading-tight text-[#1a2330]">
        What accounts do you have?
      </h2>
      {assetsLine ? (
        <p className="mt-2 whitespace-pre-wrap text-center text-sm text-[#3d4a54]">{assetsLine}</p>
      ) : null}
      <div className="mt-6 flex flex-col gap-4">
        {plan.portfolios.length ? (
          <ul className="flex flex-col gap-2">
            {plan.portfolios.map((p) => (
              <AccountTile
                key={p.id}
                plan={plan}
                portfolio={p}
                showNetWorth={hasBalanceSheet(ent.plan)}
                open={openId === p.id}
                onEdit={() => setOpenId(p.id)}
                onSave={() => setOpenId(null)}
                onChange={(patch) => updatePortfolio(p.id, patch)}
                onRemove={() => setPendingRemove(p.id)}
              />
            ))}
          </ul>
        ) : null}
        {plan.portfolios.some((p) => p.quizPile) ? (
          <p className="text-center text-sm leading-snug text-[#3d4a54]">
            This is the combined balance you entered. Split it with Add account.
          </p>
        ) : null}
        {capped ? (
          <UpgradeNudge kind="accounts" />
        ) : (
          <button
            type="button"
            className="min-h-12 rounded-xl bg-[#f3f0e8] px-3 text-base text-[#1a2330] hover:bg-[#e7e2d8]"
            onClick={() => {
              const id = newId("port");
              addPortfolio({
                id,
                name: "",
                kind: "taxable",
                owner: "primary",
                currentValue: 0,
                returnPct: null,
                taxBucket: "taxable",
                spendable: true,
                includeInNetWorth: true,
                institutionId: null,
                institutionName: "",
              });
              setOpenId(id);
            }}
          >
            Add account
          </button>
        )}
      </div>
      {pendingRemove ? (
        <ConfirmRemove
          title="Remove account"
          body="Are you sure you want to remove this account? This cannot be undone."
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            if (openId === pendingRemove) setOpenId(null);
            removePortfolio(pendingRemove);
            setPendingRemove(null);
          }}
        />
      ) : null}
    </div>
  );
}

function AccountTile({
  plan,
  portfolio: p,
  showNetWorth,
  open,
  onEdit,
  onSave,
  onChange,
  onRemove,
}: {
  plan: Plan;
  portfolio: Portfolio;
  showNetWorth: boolean;
  open: boolean;
  onEdit: () => void;
  onSave: () => void;
  onChange: (patch: Partial<Portfolio>) => void;
  onRemove: () => void;
}) {
  const rate = p.returnPct ?? plan.assumptions.defaultReturnPct;
  const setKind = (kind: AccountKind) => {
    const row = KIND_LABELS.find((k) => k.value === kind);
    const entering = needsTaxOwner(kind) && !needsTaxOwner(p.kind);
    onChange({
      kind,
      ...(row ? { taxBucket: row.bucket } : {}),
      ...(kind === "real_estate"
        ? { mortgage: p.mortgage ?? emptyMortgage(), spendable: false }
        : {}),
      ...(kind === "529"
        ? { sunsetAge: p.kind === "529" && sunsetAgeOf(p) ? sunsetAgeOf(p) : 23 }
        : { sunsetAge: undefined }),
      ...(entering ? { owner: "" } : {}),
    });
  };

  const institution =
    p.kind === "real_estate" ? null : (
      <Field label="Institution" className={slot}>
        <InstitutionInput
          institutionId={p.institutionId ?? null}
          institutionName={p.institutionName ?? ""}
          onChange={(next) => onChange(next)}
        />
      </Field>
    );
  const name = (
    <Field label="Account name" className={slotName}>
      <TextInput
        value={p.name}
        replaceSeed="New account"
        placeholder="Name this account"
        onChange={(e) => onChange({ name: e.target.value })}
        className={control}
      />
    </Field>
  );
  const accountType = () => (
    <Field label="Account type" className={slotType}>
      <SelectInput value={p.kind} className={control} onChange={(e) => setKind(e.target.value as AccountKind)}>
        {KIND_LABELS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </SelectInput>
    </Field>
  );
  const tax = (
    <Field label="Tax category" className={slotTax}>
      <SelectInput
        value={p.taxBucket}
        className={control}
        onChange={(e) => onChange({ taxBucket: e.target.value as TaxBucket })}
      >
        {BUCKETS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </SelectInput>
    </Field>
  );
  const returns = (
    <Field label="Rate of return (%)" className={slotReturn}>
      <NumberInput step={0.1} value={rate} className={control} onValue={(n) => onChange({ returnPct: n })} />
    </Field>
  );
  const value = (
    <Field label="Account value" className={slotValue}>
      <MoneyInput
        min={0}
        className={control}
        value={Math.round(p.currentValue * 100) / 100}
        onValue={(n) => onChange({ currentValue: n })}
      />
    </Field>
  );
  const include = (
    <Field label="Include in" className={ask}>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-fg">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={p.spendable}
            onChange={(e) => onChange({ spendable: e.target.checked })}
          />
          Spendable
        </label>
        {showNetWorth ? (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={p.includeInNetWorth}
              onChange={(e) => onChange({ includeInNetWorth: e.target.checked })}
            />
            Net worth
          </label>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Spendable means this balance can be drawn in retirement. Leave it off for a house or a debt
        you are not spending.
      </p>
    </Field>
  );
  const mustPickOwner = needsTaxOwner(p.kind);
  const chosenOwner = explicitTaxOwner(p.owner);
  const ownerValue = accountOwnerValue(plan, p.kind, p.owner);
  const owner = (
    <Field label="Account owner" className={slotOwner}>
      <SelectInput
        value={ownerValue}
        className={control}
        onChange={(e) => onChange({ owner: e.target.value })}
      >
        {ownerValue === "" ? <option value="">Select owner</option> : null}
        {accountOwnerOptions(plan, p.kind).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectInput>
    </Field>
  );
  const ownerPrompt =
    mustPickOwner && !chosenOwner ? (
      <p className="text-xs leading-relaxed text-[#5c4a18]">
        Pick who owns this account. The IRS yearly limit belongs to you or your spouse, not to the
        account. Until you pick, MACH RUN will not invest a capped contribution here, and it will
        not give this account its own limit.
      </p>
    ) : null;
  const ownerAndFlags = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {owner}
        {ownerPrompt}
      </div>
      {include}
    </div>
  );
  const save = (
    <button type="button" className="min-h-12 rounded-xl bg-[#3a8a58] px-3 text-base font-medium text-white" onClick={onSave}>
      Save account
    </button>
  );
  const remove = (
    <button type="button" className="text-sm text-muted hover:text-negative" onClick={onRemove}>
      Remove
    </button>
  );
  const warn =
    rate === 0 && p.currentValue > 0 ? (
      <p className="text-xs leading-relaxed text-[#5c4a18]">
        This account has a balance and a 0% return. It will not grow.
      </p>
    ) : rate > 12 ? (
      <p className="text-xs leading-relaxed text-[#5c4a18]">
        A return above 12% is high. MACH RUN will use the number you typed, but double-check it.
      </p>
    ) : null;
  const invested =
    p.kind === "annuity" ? (
      <Field label="Amount invested" className={slot} hint="Premiums paid — cost basis. Earnings come out first and are ordinary income; basis comes out tax-free.">
        <MoneyInput
          min={0}
          value={Math.round((p.costBasis ?? 0) * 100) / 100}
          onValue={(n) => onChange({ costBasis: n })}
        />
      </Field>
    ) : null;

  const line = (cells: (ReactNode | null)[]) => (
    <div className="flex w-full flex-col gap-4">{cells}</div>
  );

  return (
    <li className="rounded-xl bg-[#f3f0e8] px-3 py-2">
      {open ? (
        <div className="flex flex-col gap-4 py-2">
          {line([institution, name, accountType(), tax, returns, value, ownerAndFlags])}
          {invested}
          {warn ? <div className="text-center">{warn}</div> : null}
          {p.kind === "real_estate" ? (
            <RealEstateMortgage
              portfolioId={p.id}
              asOf={plan.assumptions.asOfDate}
              propertyValue={p.currentValue}
              mortgage={p.mortgage ?? emptyMortgage()}
              onChange={(mortgage) => onChange({ mortgage })}
            />
          ) : null}
          {p.kind === "529" ? <College529Stop plan={plan} portfolio={p} onChange={onChange} /> : null}
          {save}
          <div className="text-center">{remove}</div>
        </div>
      ) : (
        <AccountSummary portfolio={p} onEdit={onEdit} onRemove={onRemove} />
      )}
    </li>
  );
}

function College529Stop({
  plan,
  portfolio: p,
  onChange,
}: {
  plan: Plan;
  portfolio: Portfolio;
  onChange: (patch: Partial<Portfolio>) => void;
}) {
  const age = sunsetAgeOf(p);
  const childId = childIdFromOwner(p.owner);
  const child = (plan.children ?? []).find((row) => row.id === childId) ?? null;
  const stopDate = child529StopDate(child?.birthDate, age);
  const asOfKey = (plan.assumptions.asOfDate ?? "").slice(0, 7);
  const already = Boolean(stopDate && asOfKey >= stopDate.slice(0, 7));
  const name = child?.name.trim() || "This child";
  let note =
    "Blank keeps this 529 in the plan through longevity. Set an age to treat the balance as spent on that birthday.";
  if (age != null && !child) {
    note = "Pick the child who owns this 529. Sunset uses that child's birthday.";
  } else if (age != null && child && !child.birthDate) {
    note = `Add ${name}'s birthday in Family so MACH RUN knows when they turn ${age}.`;
  } else if (already) {
    note = `${name} is already ${age}. This 529 is treated as spent. It is left out of net worth, spendable cash, and the rest of the run.`;
  } else if (stopDate && age != null) {
    note = `In ${formatMonthYear(stopDate)}, when ${name} turns ${age}, this money is treated as spent. After that month it is left out of net worth, spendable cash, contributions, and every later calculation.`;
  }
  return (
    <div className="flex max-w-none flex-col items-center gap-1 text-center">
      <Field label="Sunset age" className="w-full items-center text-center [&>span]:w-full">
        <NumberInput
          min={1}
          max={99}
          step={1}
          value={age ?? 0}
          className="max-w-none text-center text-base"
          onValue={(n) =>
            onChange({
              sunsetAge: n > 0 ? Math.min(99, Math.round(n)) : undefined,
            })
          }
        />
      </Field>
      <p className="text-center text-sm leading-relaxed text-[#3d4a54]">{note}</p>
    </div>
  );
}

function AccountSummary({
  portfolio: p,
  onEdit,
  onRemove,
}: {
  portfolio: Portfolio;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const kind = KIND_LABELS.find((k) => k.value === p.kind)?.label ?? p.kind;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-medium text-fg">{p.name.trim() || "Account"}</span>
        <span className="block text-xs text-muted">{kind} · {usd(p.currentValue)}</span>
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
  );
}

function RealEstateMortgage({
  asOf,
  propertyValue,
  mortgage,
  onChange,
}: {
  portfolioId: string;
  asOf: string;
  propertyValue: number;
  mortgage: Mortgage;
  onChange: (m: Mortgage) => void;
}) {
  const patch = (partial: Partial<Mortgage>) => onChange({ ...mortgage, ...partial });
  const associated = mortgageAssociated(mortgage);
  const original = originalPrincipal(mortgage);
  const remaining = remainingMortgage(mortgage, asOf);
  const equity = propertyValue - remaining;
  const payoff = mortgagePayoffDate(mortgage);
  const hasLoan = associated && mortgage.monthlyPi > 0 && mortgage.termYears > 0;

  return (
    <div className="flex flex-col gap-4 text-center">
      <label className="flex items-start justify-center gap-2 text-sm leading-relaxed text-[#3d4a54]">
        <input
          type="checkbox"
          className="mt-1 shrink-0"
          checked={associated}
          onChange={(e) => patch({ associated: e.target.checked })}
        />
        <span>Check if there is a mortgage or loan associated with this real estate account.</span>
      </label>
      {associated ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-[#3d4a54]">
            Remaining principal is subtracted from net worth. Property value still grows at the return above. Do not include this P&I in Spending.
          </p>
          <Field label="Institution" className={ask}>
            <InstitutionInput
              institutionId={mortgage.institutionId ?? null}
              institutionName={mortgage.institutionName ?? ""}
              onChange={(next) => patch(next)}
            />
          </Field>
          <Field label="Origination (month/year)" className={ask}>
            <MonthInput
              value={mortgage.originationDate}
              onValue={(v) => patch({ originationDate: v })}
              className="justify-center"
            />
          </Field>
          <Field label="APR (%)" className={ask}>
            <NumberInput
              min={0}
              max={25}
              step={0.125}
              value={mortgage.aprPct}
              className={control}
              onValue={(n) => patch({ aprPct: n })}
            />
          </Field>
          <MonthYearMoney
            compact
            fieldClassName={ask}
            monthLabel="P&I / month"
            yearLabel="P&I / year"
            monthly={mortgage.monthlyPi || 0}
            onMonthly={(n) => patch({ monthlyPi: n })}
          />
          <Field label="Length (years)" className={ask}>
            <NumberInput
              min={1}
              max={50}
              step={1}
              value={mortgage.termYears}
              className={control}
              onValue={(n) => patch({ termYears: n })}
            />
          </Field>
          <Field label="In spending" className={ask}>
            <label className="flex items-center justify-center gap-2 text-sm text-[#1a2330]">
              <input
                type="checkbox"
                checked={Boolean(mortgage.includeInSpending)}
                onChange={(e) => patch({ includeInSpending: e.target.checked })}
              />
              Yes
            </label>
          </Field>
          {hasLoan ? (
            <p className="text-center text-sm leading-relaxed text-[#3d4a54]">
              Original principal about {usd(original)}. Remaining now {usd(remaining)}. Equity in this property {usd(equity)}
              {payoff ? ` · paid off ${payoff.slice(0, 7)}` : ""}.
            </p>
          ) : (
            <p className="text-center text-sm leading-relaxed text-[#3d4a54]">
              Enter P&I, APR, origination, and term to model the loan. Leave P&I blank if this property is free and clear.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
