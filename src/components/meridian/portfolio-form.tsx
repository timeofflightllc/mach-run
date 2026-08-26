import { Plus, Trash2 } from "lucide-react";
import {
  DangerButton,
  Field,
  GhostButton,
  NumberInput,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import type { AccountKind, TaxBucket } from "@/lib/plan/types";
import { newId, usePlanStore } from "@/lib/plan/store";
import { usd } from "@/lib/plan/format";
import { UpgradeNudge } from "@/components/meridian/upgrade-nudge";
import { atAccountCap, useEntitlement } from "@/lib/billing/use-entitlement";

const KIND_LABELS: { value: AccountKind; label: string; bucket: TaxBucket }[] = [
  { value: "401k", label: "401(k)", bucket: "pre_tax" },
  { value: "401k_roth", label: "401(k) Roth", bucket: "roth" },
  { value: "ira", label: "Traditional IRA", bucket: "pre_tax" },
  { value: "roth_ira", label: "Roth IRA", bucket: "roth" },
  { value: "tsp", label: "TSP", bucket: "pre_tax" },
  { value: "roth", label: "Roth (other)", bucket: "roth" },
  { value: "traditional", label: "Traditional (other)", bucket: "pre_tax" },
  { value: "taxable", label: "Taxable brokerage", bucket: "taxable" },
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
  const net = plan.portfolios
    .filter((p) => p.includeInNetWorth)
    .reduce((s, p) => s + p.currentValue, 0);

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
                <NumberInput
                  min={0}
                  step={100}
                  value={Math.round(p.currentValue * 100) / 100}
                  onValue={(n) => updatePortfolio(p.id, { currentValue: n })}
                />
              </Field>
              <Field label="Return %">
                <NumberInput
                  step={0.1}
                  value={p.returnPct ?? plan.assumptions.defaultReturnPct}
                  onValue={(n) => updatePortfolio(p.id, { returnPct: n })}
                />
              </Field>
              <Field label="Owner">
                <TextInput
                  value={p.owner}
                  onChange={(e) => updatePortfolio(p.id, { owner: e.target.value })}
                />
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
                <div className="flex h-11 items-center gap-3 text-xs text-muted">
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
                    NW
                  </label>
                </div>
              </Field>
            </div>
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
              owner: "Joint",
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
