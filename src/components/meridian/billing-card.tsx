import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getBillingSummary, type BillingCharge, type BillingSummary } from "@/lib/billing/api";
import { formatDeskTrialEnd } from "@/lib/billing/desk-trial";
import {
  ADVISOR_MONTHLY_USD,
  ADVISOR_UNLIMITED_MONTHLY_USD,
  ADVISOR_UNLIMITED_YEARLY_USD,
  ADVISOR_YEARLY_USD,
  MACH_MONTHLY_USD,
  MACH_YEARLY_USD,
  UNLIMITED_MONTHLY_USD,
  UNLIMITED_YEARLY_USD,
  packageLabel,
  type MachPackage,
} from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function chargeLine(charge: BillingCharge): string {
  return `${money(charge.amountCents, charge.currency)} on ${formatDeskTrialEnd(charge.at)}`;
}

function listPrice(plan: MachPackage, interval: "month" | "year" | null): string | null {
  if (interval !== "month" && interval !== "year") return null;
  const yearly = interval === "year";
  const amount =
    plan === "advisor"
      ? yearly
        ? ADVISOR_UNLIMITED_YEARLY_USD
        : ADVISOR_UNLIMITED_MONTHLY_USD
      : plan === "advisor_lite"
        ? yearly
          ? ADVISOR_YEARLY_USD
          : ADVISOR_MONTHLY_USD
        : plan === "unlimited"
          ? yearly
            ? UNLIMITED_YEARLY_USD
            : UNLIMITED_MONTHLY_USD
          : plan === "individual"
            ? yearly
              ? MACH_YEARLY_USD
              : MACH_MONTHLY_USD
            : null;
  if (amount == null) return null;
  return `${yearly ? "Yearly" : "Monthly"} · $${amount}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">{label}</p>
      <p className="mt-1 text-sm text-fg">{value}</p>
    </div>
  );
}

export function BillingCard({
  busy,
  opening,
  addingCard,
  onManage,
  onAddCard,
}: {
  busy: boolean;
  opening: boolean;
  addingCard: boolean;
  onManage: () => void;
  onAddCard: () => void;
}) {
  const ent = useEntitlement();
  const [summary, setSummary] = useState<BillingSummary | null>(null);

  useEffect(() => {
    let live = true;
    void getBillingSummary()
      .then((row) => {
        if (live) setSummary(row);
      })
      .catch(() => {
        if (live) setSummary({ ok: false });
      });
    return () => {
      live = false;
    };
  }, []);

  const loaded = summary?.ok === true && summary.hasCustomer;
  const payment =
    listPrice(ent.billed === "free" ? ent.plan : ent.billed, ent.interval) ??
    (ent.paid ? "Not billed to a card" : "None");
  const previous = !summary
    ? "Loading…"
    : !summary.ok
      ? "Unavailable"
      : !summary.hasCustomer || !summary.last
        ? "None"
        : chargeLine(summary.last);
  const upcoming = !summary
    ? "Loading…"
    : !summary.ok
      ? "Unavailable"
      : !summary.hasCustomer
        ? "None"
        : summary.canceling
          ? `None. Access through ${formatDeskTrialEnd(ent.periodEnd)}.`
          : summary.upcoming === "unavailable"
            ? "Unavailable"
            : summary.next
              ? chargeLine(summary.next)
              : "None";
  const showPortal = ent.paid || loaded;

  return (
    <section className="space-y-5 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-lg text-fg">Billing</p>
          <p className="mt-1 text-sm text-muted">Card, invoices, and cancel.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showPortal ? (
            <button
              type="button"
              disabled={busy}
              onClick={onManage}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
            >
              {opening ? "Opening…" : "Manage billing"}
            </button>
          ) : null}
          <Link to="/pricing" className="text-sm text-fg underline underline-offset-4">
            Change plan
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Current plan" value={packageLabel(ent.plan)} />
        <Fact label="Payment" value={payment} />
        <Fact label="Previous charge" value={previous} />
        <Fact label="Upcoming charge" value={upcoming} />
      </div>

      {ent.status === "past_due" ? (
        <p className="text-sm text-negative">The last payment did not go through.</p>
      ) : null}
      {ent.status === "trialing" && ent.billed === "unlimited" ? (
        <p className="text-sm text-muted">
          Unlimited trial ends {formatDeskTrialEnd(ent.periodEnd)}.{" "}
          <button
            type="button"
            disabled={busy}
            onClick={onAddCard}
            className="underline underline-offset-4 hover:text-fg disabled:opacity-60"
          >
            {addingCard ? "Opening…" : "Add a card"}
          </button>{" "}
          to keep it.
        </p>
      ) : null}

      <div className="border-t border-border pt-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">Receipts</p>
        {!summary ? (
          <p className="mt-2 text-sm text-muted">Loading…</p>
        ) : !summary.ok ? (
          <p className="mt-2 text-sm text-muted">Receipts are unavailable right now.</p>
        ) : summary.hasCustomer && summary.receipts.length > 0 ? (
          <ul className="mt-2 divide-y divide-border">
            {summary.receipts.map((row) => (
              <li key={`${row.at}-${row.amountCents}`} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="text-fg">
                  {formatDeskTrialEnd(row.at)} · {money(row.amountCents, row.currency)}
                </span>
                {row.url ? (
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-fg underline underline-offset-4"
                  >
                    Receipt
                  </a>
                ) : (
                  <span className="shrink-0 text-muted">Receipt unavailable</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No payments yet.</p>
        )}
        {summary?.ok === true && summary.hasCustomer && summary.receipts.length === 24 ? (
          <p className="mt-2 text-sm text-muted">Older receipts are in Manage billing.</p>
        ) : null}
      </div>
    </section>
  );
}
