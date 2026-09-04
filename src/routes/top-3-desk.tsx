import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MissingPage } from "@/components/missing-page";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import {
  cancelOpsSubscriptionFn,
  compOpsTimeFn,
  listOpsEventsFn,
  listOpsRoster,
  probeOpsDoor,
  setOpsPackageFn,
} from "@/lib/ops/api";
import { actionLabel, type OpsAdminEvent } from "@/lib/ops/events";
import type { MachPackage } from "@/lib/billing/limits";
import { packageLabel } from "@/lib/billing/limits";
import {
  EMPTY_OPS_COUNTS,
  OPS_ROSTER_PAGE,
  type OpsPaidFilter,
  type OpsPlanFilter,
  type OpsRosterRow,
  type OpsStatusFilter,
} from "@/lib/ops/roster";

export const Route = createFileRoute("/top-3-desk")({
  component: Top3DeskDoor,
});

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function intervalLabel(value: OpsRosterRow["interval"]): string {
  if (value === "year") return "Yearly";
  if (value === "month") return "Monthly";
  return "—";
}

function Top3DeskDoor() {
  const [gate, setGate] = useState<"wait" | "no" | "yes">("wait");
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState<OpsPlanFilter>("all");
  const [paid, setPaid] = useState<OpsPaidFilter>("all");
  const [status, setStatus] = useState<OpsStatusFilter>("all");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<OpsRosterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState(EMPTY_OPS_COUNTS);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [feed, setFeed] = useState<OpsAdminEvent[]>([]);

  useEffect(() => {
    let live = true;
    void probeOpsDoor()
      .then((r) => {
        if (live) setGate(r.allowed ? "yes" : "no");
      })
      .catch(() => {
        if (live) setGate("no");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (gate !== "yes") return;
    let live = true;
    void listOpsRoster({ q, plan, paid, status, offset })
      .then((r) => {
        if (!live) return;
        if (!r.allowed) {
          setGate("no");
          return;
        }
        setRows(r.rows);
        setTotal(r.total);
        setCounts(r.counts);
        setError(r.error);
      })
      .catch(() => {
        if (live) {
          setRows([]);
          setTotal(0);
          setError("Roster is unavailable.");
        }
      });
    void listOpsEventsFn({})
      .then((r) => {
        if (live && r.allowed) setFeed(r.events);
      })
      .catch(() => {
        /* feed is optional */
      });
    return () => {
      live = false;
    };
  }, [gate, q, plan, paid, status, offset, tick]);

  const selected = useMemo(
    () => rows.find((row) => row.id === openId) ?? null,
    [rows, openId],
  );

  if (gate !== "yes") return <MissingPage />;

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + OPS_ROSTER_PAGE, total);

  return (
    <main className="min-h-screen bg-bg px-6 py-10 text-fg">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            MACH RUN
          </p>
          <h1 className="mt-2 font-display text-4xl text-fg">Top 3 Desk</h1>
          <p className="mt-2 text-sm text-muted">Roster. Packages only — no household numbers.</p>
          <p className="mt-3 max-w-3xl text-xs text-subtle">
            Vercel Deployment Protection password: Preview deployments only. Never on
            Production. Production lock is MACH_OWNER_EMAILS plus this page’s 404.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <CountTile label="Free" value={counts.free} />
          <CountTile label="Individual" value={counts.individual} />
          <CountTile label="Ind. Unlimited" value={counts.unlimited} />
          <CountTile label="Advisor Lite" value={counts.advisor_lite} />
          <CountTile label="Advisor Unl." value={counts.advisor} />
          <CountTile label="Trialing" value={counts.trialing} />
          <CountTile label="Past due" value={counts.past_due} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search">
            <TextInput
              value={q}
              onChange={(e) => {
                setOffset(0);
                setQ(e.target.value);
              }}
              placeholder="Email or name"
            />
          </Field>
          <Field label="Package">
            <SelectInput
              value={plan}
              onChange={(e) => {
                setOffset(0);
                setPlan(e.target.value as OpsPlanFilter);
              }}
            >
              <option value="all">All</option>
              <option value="free">Free</option>
              <option value="individual">Individual</option>
              <option value="unlimited">Individual Unlimited</option>
              <option value="advisor_lite">Advisor Lite</option>
              <option value="advisor">Advisor Unlimited</option>
            </SelectInput>
          </Field>
          <Field label="Paid">
            <SelectInput
              value={paid}
              onChange={(e) => {
                setOffset(0);
                setPaid(e.target.value as OpsPaidFilter);
              }}
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="free">Free</option>
            </SelectInput>
          </Field>
          <Field label="Status">
            <SelectInput
              value={status}
              onChange={(e) => {
                setOffset(0);
                setStatus(e.target.value as OpsStatusFilter);
              }}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past due</option>
              <option value="canceled">Canceled</option>
              <option value="none">None</option>
            </SelectInput>
          </Field>
        </div>

        {error ? <p className="text-sm text-negative">{error}</p> : null}

        <div className="overflow-x-auto rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Package</th>
                <th className="px-3 py-2 font-medium">Bill</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Period end</th>
                <th className="px-3 py-2 font-medium">Sign-in</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-muted" colSpan={7}>
                    {counts.free +
                      counts.individual +
                      counts.unlimited +
                      counts.advisor_lite +
                      counts.advisor ===
                    0
                      ? "No registered users yet."
                      : "No people match that search."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      "cursor-pointer border-t border-border/60 hover:bg-elevated/60 " +
                      (openId === row.id ? "bg-elevated" : "")
                    }
                    onClick={() => setOpenId(row.id === openId ? null : row.id)}
                  >
                    <td className="px-3 py-2 text-fg">{row.email ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{row.name ?? "—"}</td>
                    <td className="px-3 py-2 text-fg">
                      {row.packageLabel}
                      {row.isComp ? (
                        <span className="ml-2 rounded bg-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-subtle">
                          Comp
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted">{intervalLabel(row.interval)}</td>
                    <td className="px-3 py-2 text-muted">{row.status}</td>
                    <td className="px-3 py-2 text-muted">{fmtDate(row.periodEnd)}</td>
                    <td className="px-3 py-2 text-muted">{row.authHint}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <p>
            {total === 0 ? "0" : `${from}–${to}`} of {total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
              disabled={offset <= 0}
              onClick={() => setOffset(Math.max(0, offset - OPS_ROSTER_PAGE))}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
              disabled={offset + OPS_ROSTER_PAGE >= total}
              onClick={() => setOffset(offset + OPS_ROSTER_PAGE)}
            >
              Next
            </button>
          </div>
        </div>

        {selected ? (
          <PersonPane row={selected} onDone={() => setTick((n) => n + 1)} />
        ) : null}

        <section className="rounded-xl bg-surface p-4 text-sm shadow-[0_0_0_1px_var(--color-border)]">
          <h2 className="font-medium text-fg">Recent desk log</h2>
          {feed.length === 0 ? (
            <p className="mt-2 text-muted">No desk events yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {feed.map((ev) => (
                <li key={ev.id} className="text-muted">
                  <span className="text-subtle">{fmtDate(ev.at)}</span>
                  {" · "}
                  <span className="text-fg">{actionLabel(ev.action)}</span>
                  {" · "}
                  {ev.targetEmail ?? ev.targetUserId ?? "—"}
                  {ev.note ? ` — ${ev.note}` : ""}
                  {ev.actorEmail ? ` (${ev.actorEmail})` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2 shadow-[0_0_0_1px_var(--color-border)]">
      <p className="text-[11px] uppercase tracking-wide text-subtle">{label}</p>
      <p className="font-display text-2xl tabular-nums text-fg">{value}</p>
    </div>
  );
}

function PersonPane({ row, onDone }: { row: OpsRosterRow; onDone: () => void }) {
  const who = row.email ?? row.id;
  const [pkg, setPkg] = useState<MachPackage>(row.plan);
  const [interval, setInterval] = useState<"month" | "year">(row.interval ?? "year");
  const [cancelNow, setCancelNow] = useState(false);
  const [pkgNote, setPkgNote] = useState("");
  const [compMode, setCompMode] = useState<"month" | "year" | "custom">("month");
  const [customEnd, setCustomEnd] = useState("");
  const [compNote, setCompNote] = useState("");
  const [cancelWhen, setCancelWhen] = useState<"period_end" | "now">("period_end");
  const [cancelNote, setCancelNote] = useState("");
  const [busy, setBusy] = useState<"pkg" | "comp" | "cancel" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [personLog, setPersonLog] = useState<OpsAdminEvent[]>([]);

  useEffect(() => {
    let live = true;
    void listOpsEventsFn({ targetUserId: row.id })
      .then((r) => {
        if (live && r.allowed) setPersonLog(r.events);
      })
      .catch(() => {
        if (live) setPersonLog([]);
      });
    return () => {
      live = false;
    };
  }, [row.id, row.periodEnd, row.status, row.plan]);

  async function run(
    kind: "pkg" | "comp" | "cancel",
    confirmText: string,
    work: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) {
    if (!window.confirm(confirmText)) return;
    setBusy(kind);
    setMsg(null);
    setErr(null);
    try {
      const result = await work();
      if (result.ok) {
        setMsg(result.message ?? "Done.");
        onDone();
      } else {
        setErr(result.error ?? "Could not save.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl bg-surface p-4 text-sm shadow-[0_0_0_1px_var(--color-border)]">
      <h2 className="font-display text-2xl text-fg">{who}</h2>
      <p className="mt-1 text-muted">
        {row.name ?? "No display name"}
        {row.isComp ? " · Comp seat" : ""}
      </p>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <Fact label="Package" value={row.packageLabel} />
        <Fact label="Billing" value={intervalLabel(row.interval)} />
        <Fact label="Status" value={row.status} />
        <Fact label="Period end" value={fmtDate(row.periodEnd)} />
        <Fact label="Created" value={fmtDate(row.createdAt)} />
        <Fact label="Sign-in" value={row.authHint} />
        <Fact label="Stripe customer" value={row.stripeCustomerId ?? "—"} />
        <Fact label="Stripe subscription" value={row.stripeSubscriptionId ?? "—"} />
      </dl>
      <div className="mt-4 flex flex-wrap gap-3">
        {row.stripeCustomerUrl ? (
          <a
            className="text-fg underline underline-offset-4"
            href={row.stripeCustomerUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open customer in Stripe
          </a>
        ) : null}
        {row.stripeSubscriptionUrl ? (
          <a
            className="text-fg underline underline-offset-4"
            href={row.stripeSubscriptionUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open subscription in Stripe
          </a>
        ) : null}
      </div>

      {msg ? <p className="mt-4 text-positive">{msg}</p> : null}
      {err ? <p className="mt-4 text-negative">{err}</p> : null}

      <div className="mt-6 grid gap-6 border-t border-border/70 pt-4 lg:grid-cols-3">
        <div className="space-y-3">
          <h3 className="font-medium text-fg">Set package</h3>
          <Field label="Package">
            <SelectInput value={pkg} onChange={(e) => setPkg(e.target.value as MachPackage)}>
              <option value="free">Free</option>
              <option value="individual">Individual</option>
              <option value="unlimited">Individual Unlimited</option>
              <option value="advisor_lite">Advisor Lite</option>
              <option value="advisor">Advisor Unlimited</option>
            </SelectInput>
          </Field>
          {pkg !== "free" ? (
            <Field label="Interval">
              <SelectInput
                value={interval}
                onChange={(e) => setInterval(e.target.value === "year" ? "year" : "month")}
              >
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </SelectInput>
            </Field>
          ) : (
            <label className="flex items-center gap-2 text-muted">
              <input
                type="checkbox"
                checked={cancelNow}
                onChange={(e) => setCancelNow(e.target.checked)}
              />
              Cancel Stripe now (default is period end)
            </label>
          )}
          <Field label="Note (optional)">
            <TextInput value={pkgNote} onChange={(e) => setPkgNote(e.target.value)} />
          </Field>
          <button
            type="button"
            disabled={busy !== null}
            className="rounded-lg border border-border px-3 py-2 text-fg disabled:opacity-40"
            onClick={() => {
              const label = packageLabel(pkg);
              const extra =
                pkg === "free"
                  ? cancelNow
                    ? " now"
                    : " at period end"
                  : ` (${interval})`;
              void run(
                "pkg",
                `Set ${who} to ${label}${extra}?`,
                () =>
                  setOpsPackageFn({
                    userId: row.id,
                    plan: pkg,
                    interval,
                    cancelNow,
                    note: pkgNote,
                  }),
              );
            }}
          >
            {busy === "pkg" ? "Saving…" : "Set package"}
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium text-fg">Comp time</h3>
          <Field label="Extend">
            <SelectInput
              value={compMode}
              onChange={(e) =>
                setCompMode(e.target.value as "month" | "year" | "custom")
              }
            >
              <option value="month">+1 month</option>
              <option value="year">+1 year</option>
              <option value="custom">Custom end date</option>
            </SelectInput>
          </Field>
          {compMode === "custom" ? (
            <Field label="Period end">
              <TextInput
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Note (required)">
            <TextInput value={compNote} onChange={(e) => setCompNote(e.target.value)} />
          </Field>
          <button
            type="button"
            disabled={busy !== null}
            className="rounded-lg border border-border px-3 py-2 text-fg disabled:opacity-40"
            onClick={() =>
              void run(
                "comp",
                `Comp extra time for ${who}?`,
                () =>
                  compOpsTimeFn({
                    userId: row.id,
                    mode: compMode,
                    customEnd,
                    note: compNote,
                  }),
              )
            }
          >
            {busy === "comp" ? "Saving…" : "Comp time"}
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium text-fg">Cancel subscription</h3>
          <Field label="When">
            <SelectInput
              value={cancelWhen}
              onChange={(e) =>
                setCancelWhen(e.target.value === "now" ? "now" : "period_end")
              }
            >
              <option value="period_end">At period end</option>
              <option value="now">Now</option>
            </SelectInput>
          </Field>
          <Field label="Note (optional)">
            <TextInput value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} />
          </Field>
          <button
            type="button"
            disabled={busy !== null}
            className="rounded-lg border border-border px-3 py-2 text-fg disabled:opacity-40"
            onClick={() =>
              void run(
                "cancel",
                `Cancel the subscription for ${who} ${cancelWhen === "now" ? "now" : "at period end"}? Login stays.`,
                () =>
                  cancelOpsSubscriptionFn({
                    userId: row.id,
                    when: cancelWhen,
                    note: cancelNote,
                  }),
              )
            }
          >
            {busy === "cancel" ? "Saving…" : "Cancel subscription"}
          </button>
        </div>
      </div>

      <div className="mt-6 border-t border-border/70 pt-4">
        <h3 className="font-medium text-fg">Log for this person</h3>
        {personLog.length === 0 ? (
          <p className="mt-2 text-muted">No events for this person yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {personLog.map((ev) => (
              <li key={ev.id} className="text-muted">
                <span className="text-subtle">{fmtDate(ev.at)}</span>
                {" · "}
                <span className="text-fg">{actionLabel(ev.action)}</span>
                {ev.note ? ` — ${ev.note}` : ""}
                {ev.actorEmail ? ` (${ev.actorEmail})` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="break-all text-fg">{value}</dd>
    </div>
  );
}
