import { useEffect, useState } from "react";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import { listOpsPromosFn, saveOpsPromoFn, setOpsPromoActiveFn } from "@/lib/ops/api";
import {
  CHECKOUT_PACKAGES,
  PACKAGE_LABEL,
  describePromo,
  type PromoKind,
  type PromoRecord,
} from "@/lib/billing/promo";
import type { CheckoutPackage } from "@/lib/billing/limits";

const EMPTY = {
  code: "",
  kind: "trial_days" as PromoKind,
  trialDays: "30",
  percentOff: "20",
  packages: ["unlimited"] as CheckoutPackage[],
  startsAt: "",
  endsAt: "",
  note: "",
};

export function PromoCodesDesk() {
  const [rows, setRows] = useState<PromoRecord[]>([]);
  const [draft, setDraft] = useState(EMPTY);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const r = await listOpsPromosFn({ data: {} });
    if (!r.allowed) {
      setStatus("Desk codes are locked.");
      return;
    }
    setRows(r.rows);
  }

  useEffect(() => {
    void reload().catch(() => setStatus("Could not load codes."));
  }, []);

  function togglePkg(pkg: CheckoutPackage) {
    setDraft((d) => {
      const has = d.packages.includes(pkg);
      return {
        ...d,
        packages: has ? d.packages.filter((p) => p !== pkg) : [...d.packages, pkg],
      };
    });
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const r = await saveOpsPromoFn({
        data: {
          code: draft.code,
          kind: draft.kind,
          trialDays: Number(draft.trialDays) || 0,
          percentOff: Number(draft.percentOff) || 0,
          packages: draft.packages,
          startsAt: draft.startsAt,
          endsAt: draft.endsAt,
          note: draft.note,
        },
      });
      if (!r.ok) {
        setStatus(r.error);
        return;
      }
      setStatus(`${r.promo.code} is live.`);
      setDraft(EMPTY);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function setActive(code: string, active: boolean) {
    setBusy(true);
    setStatus(null);
    try {
      const r = await setOpsPromoActiveFn({ data: { code, active } });
      setStatus(r.ok ? (active ? `${code} is on.` : `${code} is off.`) : r.error);
      if (r.ok) await reload();
    } finally {
      setBusy(false);
    }
  }

  function loadRow(row: PromoRecord) {
    if (row.builtin) return;
    setDraft({
      code: row.code,
      kind: row.kind,
      trialDays: String(row.trialDays ?? 30),
      percentOff: String(row.percentOff ?? 20),
      packages: [...row.packages],
      startsAt: row.startsAt ?? "",
      endsAt: row.endsAt ?? "",
      note: row.note,
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Create a code, pick the window, pick the offer, pick the packages. Pricing
        checks this list at checkout. SUPER14 / EAGLE / MARVIN / INVERTED stay
        built in until you save a row with the same name, which overrides them.
        Used = unique people who applied that code at checkout. Active = those
        still trialing or paid.
      </p>

      <div className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--color-border)]">
        <p className="font-display text-lg text-fg">New or replace</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Code">
            <TextInput
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              placeholder="WINGMAN"
              autoComplete="off"
            />
          </Field>
          <Field label="Offer">
            <select
              className="h-11 w-full rounded-lg border border-border bg-elevated px-3 text-sm text-fg"
              value={draft.kind}
              onChange={(e) =>
                setDraft({ ...draft, kind: e.target.value as PromoKind })
              }
            >
              <option value="trial_days">Free time (days)</option>
              <option value="percent_off">Percent off first invoice</option>
            </select>
          </Field>
          {draft.kind === "trial_days" ? (
            <Field label="Days free">
              <TextInput
                inputMode="numeric"
                value={draft.trialDays}
                onChange={(e) => setDraft({ ...draft, trialDays: e.target.value })}
              />
            </Field>
          ) : (
            <Field label="Percent off">
              <TextInput
                inputMode="numeric"
                value={draft.percentOff}
                onChange={(e) => setDraft({ ...draft, percentOff: e.target.value })}
              />
            </Field>
          )}
          <Field label="Internal note">
            <TextInput
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="Squadron meetup"
            />
          </Field>
          <Field label="Start date (blank = now)">
            <TextInput
              type="date"
              value={draft.startsAt}
              onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
            />
          </Field>
          <Field label="End date (blank = open)">
            <TextInput
              type="date"
              value={draft.endsAt}
              onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium tracking-wide text-muted">Applies to</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={draft.packages.length === CHECKOUT_PACKAGES.length}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    packages: e.target.checked ? [...CHECKOUT_PACKAGES] : [],
                  })
                }
              />
              All paid packages
            </label>
            {CHECKOUT_PACKAGES.map((pkg) => (
              <label key={pkg} className="flex items-center gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={draft.packages.includes(pkg)}
                  onChange={() => togglePkg(pkg)}
                />
                {PACKAGE_LABEL[pkg]}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <PrimaryButton type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save code"}
          </PrimaryButton>
        </div>
        {status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.code}
            className="rounded-xl bg-surface px-4 py-3 shadow-[0_0_0_1px_var(--color-border)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-fg">
                  {row.code}
                  {row.builtin ? (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-subtle">
                      Built in
                    </span>
                  ) : null}
                  {!row.active ? (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#e8c547]">
                      Off
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted">{describePromo(row)}</p>
                <p className="mt-1 text-sm text-fg">
                  Used {row.used} · Active {row.activeUsers}
                  {row.activeUsers === 0 ? " (none live)" : ""}
                </p>
                {row.activeEmails.length > 0 ? (
                  <p className="mt-1 text-xs text-subtle">{row.activeEmails.join(" · ")}</p>
                ) : null}
                <p className="mt-1 text-xs text-subtle">
                  {row.startsAt || row.endsAt
                    ? `${row.startsAt ?? "open"} → ${row.endsAt ?? "open"}`
                    : "No date window"}
                  {row.note ? ` · ${row.note}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.builtin ? null : (
                  <>
                    <button
                      type="button"
                      className="text-sm text-muted hover:text-fg"
                      onClick={() => loadRow(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-sm text-muted hover:text-fg"
                      disabled={busy}
                      onClick={() => void setActive(row.code, !row.active)}
                    >
                      {row.active ? "Turn off" : "Turn on"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
