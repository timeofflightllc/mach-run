import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ConfirmRemove } from "@/components/meridian/confirm-remove";
import {
  DangerButton,
  Field,
  GhostButton,
  MonthInput,
  NumberInput,
  MonthYearMoney,
  MoneyInput,
  PrimaryButton,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import type { AccountKind, Mortgage, Plan, Portfolio, TaxBucket } from "@/lib/plan/types";
import { newId, usePlanStore } from "@/lib/plan/store";
import { usd } from "@/lib/plan/format";
import { startingNetWorth } from "@/lib/plan/engine";
import {
  emptyMortgage,
  mortgageAssociated,
  mortgagePayoffDate,
  originalPrincipal,
  remainingMortgage,
} from "@/lib/plan/mortgage";
import { UpgradeNudge } from "@/components/meridian/upgrade-nudge";
import {
  InstitutionInput,
  InstitutionMark,
} from "@/components/meridian/institution-field";
import { atAccountCap, useEntitlement } from "@/lib/billing/use-entitlement";
import { usePlannerCopy } from "@/components/meridian/use-planner-copy";
import { fillPlanner } from "@/lib/site-copy/planner-copy";
import {
  accountOwnerOptions,
  accountOwnerValue,
  explicitTaxOwner,
  needsTaxOwner,
} from "@/lib/plan/family-owners";

const KIND_LABELS: { value: AccountKind; label: string; bucket: TaxBucket }[] = [
  { value: "401k", label: "401(k)", bucket: "pre_tax" },
  { value: "401k_roth", label: "401(k) Roth", bucket: "roth" },
  { value: "ira", label: "Traditional IRA", bucket: "pre_tax" },
  { value: "roth_ira", label: "Roth IRA", bucket: "roth" },
  { value: "tsp", label: "TSP", bucket: "pre_tax" },
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

const slot = "w-[12.5rem] max-w-full shrink-0";
const slotName = "w-[10rem] max-w-full shrink-0";
const slotType = "w-[11.5rem] max-w-full shrink-0";
const slotTax = "w-[7.75rem] max-w-full shrink-0";
const slotReturn = "w-[6.5rem] max-w-full shrink-0";
const slotValue = "w-[8rem] max-w-full shrink-0";
const slotOwner = "w-[8rem] max-w-full shrink-0";
const control = "h-10 max-w-full";
const summaryCols =
  "@min-[46rem]:grid @min-[46rem]:min-w-[72rem] @min-[46rem]:grid-cols-[minmax(9rem,1.15fr)_minmax(7.5rem,0.85fr)_minmax(8rem,10rem)_minmax(6.5rem,0.7fr)_minmax(7rem,0.8fr)_minmax(7rem,0.75fr)_7.25rem] @min-[46rem]:items-center @min-[46rem]:gap-x-4";

export function PortfolioForm() {
  const plan = usePlanStore((s) => s.plan);
  const updatePortfolio = usePlanStore((s) => s.updatePortfolio);
  const addPortfolio = usePlanStore((s) => s.addPortfolio);
  const removePortfolio = usePlanStore((s) => s.removePortfolio);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const ent = useEntitlement();
  const capped = atAccountCap(plan.portfolios.length, ent);

  const spendable = plan.portfolios
    .filter((p) => p.spendable)
    .reduce((s, p) => s + p.currentValue, 0);
  const net = startingNetWorth(plan);
  const copy = usePlannerCopy();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 2xl:max-w-[90rem] min-[2000px]:max-w-[110rem]">
      {copy.assetsBody.trim() ? (
        <p className="whitespace-pre-wrap text-sm text-muted">
          {fillPlanner(copy.assetsBody, {
            spendable: usd(spendable),
            net: usd(net),
            return: String(plan.assumptions.defaultReturnPct),
          })}
        </p>
      ) : null}
      <ul className={`flex flex-col gap-2 overflow-x-auto ${summaryCols}`}>
        {plan.portfolios.length > 0 ? (
          <li className="col-span-full hidden grid-cols-subgrid items-center text-[0.7rem] font-medium uppercase tracking-[0.12em] text-subtle @min-[46rem]:grid">
            <span className="min-w-0 pl-3">Name</span>
            <span className="min-w-0">Kind</span>
            <span className="min-w-0">Value</span>
            <span className="min-w-0">Tax</span>
            <span className="min-w-0">Flags</span>
            <span className="min-w-0">Owner</span>
            <span className="pr-3" />
          </li>
        ) : null}
        {plan.portfolios.map((p) => (
          <AccountTile
            key={p.id}
            plan={plan}
            portfolio={p}
            open={openId === p.id}
            onEdit={() => setOpenId(p.id)}
            onSave={() => setOpenId(null)}
            onChange={(patch) => updatePortfolio(p.id, patch)}
            onRemove={() => setPendingRemove(p.id)}
          />
        ))}
      </ul>
      {capped ? (
        <UpgradeNudge kind="accounts" />
      ) : (
        <GhostButton
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
          <Plus className="size-4" />
          Add account
        </GhostButton>
      )}
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
  open,
  onEdit,
  onSave,
  onChange,
  onRemove,
}: {
  plan: Plan;
  portfolio: Portfolio;
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
    <Field label="Include in" className="w-auto shrink-0">
      <div className="flex h-10 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={p.spendable}
            onChange={(e) => onChange({ spendable: e.target.checked })}
          />
          Spendable
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={p.includeInNetWorth}
            onChange={(e) => onChange({ includeInNetWorth: e.target.checked })}
          />
          Net worth
        </label>
      </div>
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
  const save = (
    <PrimaryButton className="h-10 self-end" onClick={onSave}>
      Save account
    </PrimaryButton>
  );
  const remove = (
    <div className="flex items-end justify-end">
      <DangerButton
        aria-label={`Remove ${p.name || "account"}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRemove();
        }}
      >
        <Trash2 className="size-4" />
      </DangerButton>
    </div>
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
    <div className="flex flex-wrap items-end justify-start gap-x-2 gap-y-2">{cells}</div>
  );

  return (
    <li className="col-span-full rounded-lg bg-section-lift px-3 py-2 shadow-[0_0_0_1px_var(--color-section-lift-border)] @min-[46rem]:grid @min-[46rem]:grid-cols-subgrid @min-[46rem]:items-center @min-[46rem]:px-0">
      <div
        className="col-span-full grid px-0 transition-[grid-template-rows] duration-300 ease-out @min-[46rem]:px-3"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 pb-1">
            {line([
              institution,
              name,
              accountType(),
              tax,
              returns,
              value,
              include,
              owner,
              save,
              remove,
            ])}
            {ownerPrompt}
            {invested}
            {warn}
            {p.kind === "real_estate" ? (
              <RealEstateMortgage
                portfolioId={p.id}
                asOf={plan.assumptions.asOfDate}
                propertyValue={p.currentValue}
                mortgage={p.mortgage ?? emptyMortgage()}
                onChange={(mortgage) => onChange({ mortgage })}
              />
            ) : null}
          </div>
        </div>
      </div>
      <div
        className="col-span-full grid transition-[grid-template-rows] duration-300 ease-out @min-[46rem]:grid-cols-subgrid"
        style={{ gridTemplateRows: open ? "0fr" : "1fr" }}
        inert={open}
      >
        <div className="col-span-full min-h-0 overflow-hidden @min-[46rem]:grid @min-[46rem]:grid-cols-subgrid">
          <AccountSummary plan={plan} portfolio={p} onEdit={onEdit} onRemove={onRemove} />
        </div>
      </div>
    </li>
  );
}

function AccountSummary({
  plan,
  portfolio: p,
  onEdit,
  onRemove,
}: {
  plan: Plan;
  portfolio: Portfolio;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const kind = KIND_LABELS.find((k) => k.value === p.kind)?.label ?? p.kind;
  const tax = BUCKETS.find((k) => k.value === p.taxBucket)?.label ?? p.taxBucket;
  const ownerValue = accountOwnerValue(plan, p.kind, p.owner);
  const owner =
    accountOwnerOptions(plan, p.kind).find((o) => o.value === ownerValue)?.label ??
    "Select owner";
  const flags = [
    p.spendable ? "Spendable" : null,
    p.includeInNetWorth ? "Net worth" : null,
  ].filter(Boolean);
  const mortgage =
    p.kind === "real_estate" && mortgageAssociated(p.mortgage) ? "mortgage" : null;
  return (
    <>
      <div className="col-span-full flex items-center gap-3 @min-[46rem]:hidden">
        <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-fg">
          {p.kind === "real_estate" ? null : (
            <InstitutionMark
              institutionId={p.institutionId ?? null}
              institutionName={p.institutionName ?? ""}
              size={18}
            />
          )}
          <span className="min-w-0 truncate">
            <span className="font-medium">{p.name.trim() || "Account"}</span>
            <span className="text-muted"> · {kind}</span>
            <span className="text-muted"> · {usd(p.currentValue)}</span>
            <span className="text-muted"> · {tax}</span>
            <span className="text-muted"> · {flags.length ? flags.join(", ") : "—"}</span>
            <span className="text-muted"> · {owner}</span>
            {mortgage ? <span className="text-muted"> · {mortgage}</span> : null}
          </span>
        </p>
        <button type="button" className="shrink-0 text-xs text-muted hover:text-negative" onClick={onRemove}>
          Remove
        </button>
        <button type="button" className="shrink-0 text-sm font-medium text-fg" onClick={onEdit}>
          Edit
        </button>
      </div>
      <div className="col-span-full hidden grid-cols-subgrid items-center text-sm @min-[46rem]:grid">
        <span className="flex min-w-0 items-center gap-1.5 pl-3 font-medium text-fg">
          {p.kind === "real_estate" ? null : (
            <InstitutionMark
              institutionId={p.institutionId ?? null}
              institutionName={p.institutionName ?? ""}
              size={18}
            />
          )}
          <span className="min-w-0 truncate">{p.name.trim() || "Account"}</span>
        </span>
        <span className="min-w-0 truncate text-muted">{kind}</span>
        <span className="min-w-0 truncate whitespace-nowrap tabular-nums text-fg">{usd(p.currentValue)}</span>
        <span className="min-w-0 truncate text-muted">{tax}</span>
        <span className="min-w-0 truncate text-muted">{flags.length ? flags.join(", ") : "—"}</span>
        <span className="min-w-0 truncate text-muted">{owner}</span>
        <span className="flex min-w-0 items-center justify-end gap-3 pr-3">
          <button type="button" className="text-xs text-muted hover:text-negative" onClick={onRemove}>
            Remove
          </button>
          <button type="button" className="font-medium text-fg" onClick={onEdit}>
            Edit
          </button>
        </span>
      </div>
    </>
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
    <div
      className="mx-[50px] mt-3 rounded-lg px-3 py-3"
      style={{
        background: "color-mix(in oklab, #e8c547 12%, transparent)",
        boxShadow: "0 0 0 1px color-mix(in oklab, #e8c547 45%, transparent)",
      }}
    >
      <label className="flex items-start gap-2 text-xs leading-relaxed text-[#5c4a18]">
        <input
          type="checkbox"
          className="mt-0.5 shrink-0"
          checked={associated}
          onChange={(e) => patch({ associated: e.target.checked })}
        />
        <span>
          Check if there is a mortgage or loan/liability associated with this
          real estate account.
        </span>
      </label>
      {associated ? (
        <div
          className="mt-3 rounded-md px-3 py-3"
          style={{
            background: "color-mix(in oklab, #e8c547 8%, transparent)",
            boxShadow: "0 0 0 1px color-mix(in oklab, #e8c547 35%, transparent)",
          }}
        >
          <div className="flex items-center gap-2">
            <InstitutionMark
              institutionId={mortgage.institutionId ?? null}
              institutionName={mortgage.institutionName ?? ""}
            />
            <p className="text-xs font-medium tracking-wide text-[#5c4a18]">
              Associated loan / mortgage
            </p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#5c4a18]">
            Remaining principal is subtracted from net worth. Property value still
            grows at the return above. Do not include the P&I amount inputted below in Spending.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
            <Field label="Institution" className={slot}>
              <InstitutionInput
                institutionId={mortgage.institutionId ?? null}
                institutionName={mortgage.institutionName ?? ""}
                onChange={(next) => patch(next)}
              />
            </Field>
            <Field label="Origination (month/year)" className="w-auto shrink-0">
              <MonthInput
                value={mortgage.originationDate}
                onValue={(v) => patch({ originationDate: v })}
              />
            </Field>
            <Field label="APR (%)" className="w-[5rem] shrink-0">
              <NumberInput
                min={0}
                max={25}
                step={0.125}
                value={mortgage.aprPct}
                onValue={(n) => patch({ aprPct: n })}
              />
            </Field>
            <MonthYearMoney
              compact
              fieldClassName="w-[6.75rem] shrink-0"
              monthLabel="P&I / month"
              yearLabel="P&I / year"
              monthly={mortgage.monthlyPi || 0}
              onMonthly={(n) => patch({ monthlyPi: n })}
            />
            <Field label="Length (years)" className="w-[6.25rem] shrink-0">
              <NumberInput
                min={1}
                max={50}
                step={1}
                value={mortgage.termYears}
                onValue={(n) => patch({ termYears: n })}
              />
            </Field>
            <Field label="In spending" className="w-auto shrink-0">
              <label className="flex h-10 items-center gap-2 text-xs text-[#5c4a18]">
                <input
                  type="checkbox"
                  checked={Boolean(mortgage.includeInSpending)}
                  onChange={(e) => patch({ includeInSpending: e.target.checked })}
                />
                Yes
              </label>
            </Field>
          </div>
          {hasLoan ? (
            <p className="mt-3 text-xs leading-relaxed text-[#5c4a18]">
              Original principal about {usd(original)}. Remaining now {usd(remaining)}.
              Equity in this property {usd(equity)}
              {payoff ? ` · paid off ${payoff.slice(0, 7)}` : ""}.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-[#5c4a18]">
              Enter P&I, APR, origination, and term to model the loan. Leave
              P&I at blank if this property is free and clear.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
