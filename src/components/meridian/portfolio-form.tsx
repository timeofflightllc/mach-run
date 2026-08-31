import { Plus, Trash2 } from "lucide-react";
import {
  DangerButton,
  Field,
  GhostButton,
  MonthInput,
  NumberInput,
  MoneyInput,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import type { AccountKind, Mortgage, TaxBucket } from "@/lib/plan/types";
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
import { atAccountCap, useEntitlement } from "@/lib/billing/use-entitlement";
import {
  familyOwnerOptions,
  isTaxQualified,
  normalizeOwner,
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
  { value: "education", label: "Education", bucket: "none" },
  { value: "real_estate", label: "Real estate", bucket: "none" },
  { value: "other", label: "Other", bucket: "none" },
];

const BUCKETS: TaxBucket[] = ["roth", "pre_tax", "taxable", "none"];

export function PortfolioForm() {
  const plan = usePlanStore((s) => s.plan);
  const updatePortfolio = usePlanStore((s) => s.updatePortfolio);
  const addPortfolio = usePlanStore((s) => s.addPortfolio);
  const removePortfolio = usePlanStore((s) => s.removePortfolio);
  const ent = useEntitlement();
  const capped = atAccountCap(plan.portfolios.length, ent);

  const spendable = plan.portfolios
    .filter((p) => p.spendable)
    .reduce((s, p) => s + p.currentValue, 0);
  const net = startingNetWorth(plan);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Spendable (retirement) {usd(spendable)} · Net worth {usd(net)}. These
        accounts are the only ones Orient can sweep into and Decide can
        contribute to. Per-account return blank uses the global{" "}
        {plan.assumptions.defaultReturnPct}% nominal.
      </p>
      <ul className="flex flex-col gap-3">
        {plan.portfolios.map((p) => (
          <li
            key={p.id}
            className="rounded-lg bg-elevated p-3 shadow-[0_0_0_1px_var(--color-border)]"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <TextInput
                value={p.name}
                onChange={(e) => updatePortfolio(p.id, { name: e.target.value })}
                className="h-10"
              />
              <DangerButton
                aria-label={`Remove ${p.name}`}
                onClick={() => removePortfolio(p.id)}
              >
                <Trash2 className="size-4" />
              </DangerButton>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Field label="Value">
                <MoneyInput
                  min={0}
                  value={Math.round(p.currentValue * 100) / 100}
                  onValue={(n) => updatePortfolio(p.id, { currentValue: n })}
                />
              </Field>
              {p.kind === "annuity" ? (
                <Field
                  label="Amount invested"
                  hint="Premiums paid — cost basis. Earnings come out first and are ordinary income; basis comes out tax-free."
                >
                  <MoneyInput
                    min={0}
                    value={Math.round((p.costBasis ?? 0) * 100) / 100}
                    onValue={(n) => updatePortfolio(p.id, { costBasis: n })}
                  />
                </Field>
              ) : null}
              <Field label="Return %">
                <NumberInput
                  step={0.1}
                  value={p.returnPct ?? plan.assumptions.defaultReturnPct}
                  onValue={(n) => updatePortfolio(p.id, { returnPct: n })}
                />
              </Field>
              <Field label="Account owner">
                <SelectInput
                  value={normalizeOwner(p.owner)}
                  onChange={(e) =>
                    updatePortfolio(p.id, { owner: e.target.value })
                  }
                >
                  {familyOwnerOptions(plan, p.kind).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Kind">
                <SelectInput
                  value={p.kind}
                  onChange={(e) => {
                    const kind = e.target.value as AccountKind;
                    const row = KIND_LABELS.find((k) => k.value === kind);
                    updatePortfolio(p.id, {
                      kind,
                      ...(row ? { taxBucket: row.bucket } : {}),
                      ...(kind === "real_estate"
                        ? { mortgage: p.mortgage ?? emptyMortgage(), spendable: false }
                        : {}),
                      ...(isTaxQualified(kind) && normalizeOwner(p.owner) === "joint"
                        ? { owner: "primary" }
                        : {}),
                    });
                  }}
                >
                  {KIND_LABELS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Tax bucket">
                <SelectInput
                  value={p.taxBucket}
                  onChange={(e) =>
                    updatePortfolio(p.id, { taxBucket: e.target.value as TaxBucket })
                  }
                >
                  {BUCKETS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Flags">
                <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={p.spendable}
                      onChange={(e) =>
                        updatePortfolio(p.id, { spendable: e.target.checked })
                      }
                    />
                    Spendable
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={p.includeInNetWorth}
                      onChange={(e) =>
                        updatePortfolio(p.id, { includeInNetWorth: e.target.checked })
                      }
                    />
                    Net Worth
                  </label>
                </div>
              </Field>
            </div>
            {p.kind === "real_estate" ? (
              <RealEstateMortgage
                portfolioId={p.id}
                asOf={plan.assumptions.asOfDate}
                propertyValue={p.currentValue}
                mortgage={p.mortgage ?? emptyMortgage()}
                onChange={(mortgage) => updatePortfolio(p.id, { mortgage })}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {capped ? (
        <UpgradeNudge kind="accounts" />
      ) : (
        <GhostButton
          onClick={() =>
            addPortfolio({
              id: newId("port"),
              name: "New account",
              kind: "taxable",
              owner: "primary",
              currentValue: 0,
              returnPct: null,
              taxBucket: "taxable",
              spendable: true,
              includeInNetWorth: true,
            })
          }
        >
          <Plus className="size-4" />
          Add account
        </GhostButton>
      )}
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
    <div
      className="mx-[50px] mt-3 rounded-lg px-3 py-3"
      style={{
        background: "color-mix(in oklab, #e8c547 12%, transparent)",
        boxShadow: "0 0 0 1px color-mix(in oklab, #e8c547 45%, transparent)",
      }}
    >
      <label className="flex items-start gap-2 text-xs leading-relaxed text-[#e8c547]">
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
          <p className="text-xs font-medium tracking-wide text-[#e8c547]">
            Associated loan / mortgage
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#e8c547]">
            Remaining principal is subtracted from net worth. Property value still
            grows at the return above. Check the box only if this P&I is not
            already in Spending.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Field label="Origination (month/year)">
              <MonthInput
                value={mortgage.originationDate}
                onValue={(v) => patch({ originationDate: v })}
              />
            </Field>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <Field label="APR (%)" className="w-[8.75rem]">
                <NumberInput
                  min={0}
                  max={25}
                  step={0.125}
                  value={mortgage.aprPct}
                  onValue={(n) => patch({ aprPct: n })}
                />
              </Field>
              <Field label="P&I / month" className="w-[8.75rem]">
                <MoneyInput
                  min={0}
                  value={Math.round((mortgage.monthlyPi || 0) * 100) / 100}
                  onValue={(n) => patch({ monthlyPi: n })}
                />
              </Field>
              <Field label="Length (years)" className="w-[8.75rem]">
                <NumberInput
                  min={1}
                  max={50}
                  step={1}
                  value={mortgage.termYears}
                  onValue={(n) => patch({ termYears: n })}
                />
              </Field>
              <Field label="In spending">
                <label className="flex min-h-11 items-center gap-2 text-xs text-[#e8c547]">
                  <input
                    type="checkbox"
                    checked={Boolean(mortgage.includeInSpending)}
                    onChange={(e) => patch({ includeInSpending: e.target.checked })}
                  />
                  Include this P&I in spending
                </label>
              </Field>
            </div>
          </div>
          {hasLoan ? (
            <p className="mt-3 text-xs leading-relaxed text-[#e8c547]">
              Original principal about {usd(original)}. Remaining now {usd(remaining)}.
              Equity in this property {usd(equity)}
              {payoff ? ` · paid off ${payoff.slice(0, 7)}` : ""}.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-[#e8c547]">
              Enter P&I, APR, origination, and term to model the loan. Leave
              P&I at blank if this property is free and clear.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
