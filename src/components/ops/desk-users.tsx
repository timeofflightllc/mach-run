import { useEffect, useMemo, useState } from "react";
import { Field, TextInput } from "@/components/ui/field";
import { paidFromStatus } from "@/lib/billing/limits";
import { getOpsUserUsageFn, listOpsRoster } from "@/lib/ops/api";
import { activityLabel, describeActivity } from "@/lib/ops/activity";
import { OPS_ROSTER_PAGE, type OpsRosterRow } from "@/lib/ops/roster";
import { RISK_GRADE_CLASS, scoreBotRisk, type RiskGrade } from "@/lib/ops/risk";
import { EMPTY_USER_USAGE, type OpsUserUsage } from "@/lib/ops/user-usage";
import { OpsDeleteAccount } from "./ops-delete-account";

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function fmtWhen(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function DeskUsers() {
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<OpsRosterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    void listOpsRoster({ data: { q, plan: "all", paid: "all", status: "all", offset } })
      .then((r) => {
        if (!live) return;
        setRows(r.rows);
        setTotal(r.total);
        setError(r.error);
      })
      .catch(() => {
        if (live) {
          setRows([]);
          setTotal(0);
          setError("Users list is unavailable.");
        }
      });
    return () => {
      live = false;
    };
  }, [q, offset, tick]);

  const selected = useMemo(
    () => rows.find((row) => row.id === openId) ?? null,
    [rows, openId],
  );

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + OPS_ROSTER_PAGE, total);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Click a person for account facts and site use. Risk is a guess from
        email, IPs, sign-in history, and usage — not a verdict. Counts only, no
        dollar amounts. Delete still asks for your desk password.
      </p>
      <div className="max-w-md">
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
      </div>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">Risk</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Package</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Sign-in</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted" colSpan={6}>
                  {total === 0 && !q
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
                  <td className="px-3 py-2">
                    <RiskMark grade={row.riskGrade ?? "C"} label={row.riskLabel} />
                  </td>
                  <td className="px-3 py-2 text-fg">{row.email ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{row.name ?? "—"}</td>
                  <td className="px-3 py-2 text-fg">{row.packageLabel}</td>
                  <td className="px-3 py-2 text-muted">{fmtDate(row.createdAt)}</td>
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
        <UserDetail
          row={selected}
          onDeleted={() => {
            setOpenId(null);
            setTick((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function UserDetail({
  row,
  onDeleted,
}: {
  row: OpsRosterRow;
  onDeleted: () => void;
}) {
  const [usage, setUsage] = useState<OpsUserUsage>(EMPTY_USER_USAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setUsage(EMPTY_USER_USAGE);
    void getOpsUserUsageFn({ data: { userId: row.id } })
      .then((raw) => {
        if (!live) return;
        const r = raw as OpsUserUsage;
        setUsage({ ...EMPTY_USER_USAGE, ...r });
        setLoading(false);
      })
      .catch(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [row.id]);

  const shape = usage.shape;
  const risk = useMemo(
    () =>
      scoreBotRisk({
        email: row.email,
        emailVerified: usage.emailVerified ?? row.emailVerified,
        name: row.name,
        createdAt: row.createdAt,
        authHint: row.authHint,
        paid: paidFromStatus(row.status),
        isComp: row.isComp,
        calculateCount: usage.calculateCount,
        loginCount: usage.loginCount,
        pdfCount: usage.pdfCount,
        backupCount: usage.backupCount,
        planPresent: usage.planPresent,
        lastIps: usage.lastIps.length ? usage.lastIps : [],
        userAgents: usage.userAgents ?? [],
        sharedIpUsers: row.sharedIpUsers,
      }),
    [row, usage],
  );

  return (
    <section className="rounded-xl bg-surface p-4 text-sm shadow-[0_0_0_1px_var(--color-border)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-fg">{row.email ?? row.id}</h2>
          <p className="mt-1 text-muted">
            {row.name ?? "No display name"}
            {row.id ? ` · ${row.id}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-subtle">Bot / spam guess</p>
          <RiskMark grade={risk.grade} label={risk.label} className="text-5xl leading-none" />
          <p className={"mt-1 text-sm " + RISK_GRADE_CLASS[risk.grade]}>{risk.label}</p>
        </div>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
        {risk.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-subtle">
        Heuristic only. Cross-checks email, IPs shared with other users, sign-in
        history, user-agent, and whether they ever ran a MACH Run.
      </p>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Package" value={row.packageLabel} />
        <Fact label="Billing" value={intervalLabel(row.interval)} />
        <Fact label="Status" value={row.status} />
        <Fact label="Period end" value={fmtDate(row.periodEnd)} />
        <Fact label="Created" value={fmtDate(row.createdAt)} />
        <Fact label="Sign-in method" value={row.authHint} />
        <Fact
          label="Email verified"
          value={
            usage.emailVerified == null ? "—" : usage.emailVerified ? "Yes" : "No"
          }
        />
        <Fact label="Stripe customer" value={row.stripeCustomerId ?? "—"} />
        <Fact label="Stripe subscription" value={row.stripeSubscriptionId ?? "—"} />
      </dl>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Sign-ins recorded" value={usage.loginCount} />
        <Stat label="MACH Runs" value={usage.calculateCount} />
        <Stat label="PDF downloads" value={usage.pdfCount} />
        <Stat label="Backups" value={usage.backupCount} />
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Most recent sign-in" value={fmtWhen(usage.lastLoginAt)} />
        <Fact label="Active sessions" value={String(usage.activeSessions)} />
        <Fact label="Last device" value={usage.deviceHint ?? "—"} />
        <Fact label="Last MACH Run" value={fmtWhen(usage.lastCalculateAt)} />
        <Fact label="Last PDF" value={fmtWhen(usage.lastPdfAt)} />
        <Fact label="Plan last saved" value={fmtWhen(usage.planSavedAt)} />
      </dl>
      <div className="mt-2">
        <Fact
          label="Recent IPs"
          value={usage.lastIps.length ? usage.lastIps.join(" · ") : "—"}
        />
      </div>

      <div className="mt-4 rounded-lg bg-elevated px-3 py-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
          Household inventory
        </h3>
        <p className="mt-1 text-xs text-subtle">
          Block counts from the saved plan. No balances, names, or birthdays.
        </p>
        {loading ? (
          <p className="mt-2 text-sm text-muted">Loading usage…</p>
        ) : !usage.planPresent && !shape ? (
          <p className="mt-2 text-sm text-muted">No MACH RUN saved yet.</p>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Profiles" value={shape?.profiles ?? 0} />
            <Stat label="Family people" value={shape?.familyPeople ?? 0} />
            <Stat label="Accounts" value={shape?.accounts ?? 0} />
            <Stat label="Incomes" value={shape?.incomes ?? 0} />
            <Stat label="Contributions" value={shape?.contributions ?? 0} />
            <Stat label="Spending rules" value={shape?.spending ?? 0} />
            <Stat label="Liabilities" value={shape?.liabilities ?? 0} />
            <Stat label="Mortgages" value={shape?.mortgages ?? 0} />
          </dl>
        )}
        {usage.planLocked ? (
          <p className="mt-2 text-xs text-muted">
            Saved plan is encrypted. Inventory above is from the last Calculate
            if one exists.
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg bg-elevated px-3 py-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
          Recent activity
        </h3>
        {usage.events.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No Calculate, PDF, sign-in, or save events yet. Sign-in counts start
            after this deploy.
          </p>
        ) : (
          <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto text-sm text-muted">
            {usage.events.map((ev) => (
              <li key={ev.id}>
                <span className="text-subtle">{fmtWhen(ev.at)}</span>
                {" · "}
                <span className="text-fg">{activityLabel(ev.action)}</span>
                {describeActivity(ev) ? ` — ${describeActivity(ev)}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

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

      <div className="mt-6 border-t border-border/70 pt-4">
        <OpsDeleteAccount row={row} onDeleted={onDeleted} />
      </div>
    </section>
  );
}

function RiskMark({
  grade,
  label,
  className = "",
}: {
  grade: RiskGrade;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={"font-display font-semibold tabular-nums " + RISK_GRADE_CLASS[grade] + " " + className}
      title={label}
    >
      {grade}
    </span>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-elevated px-3 py-2 shadow-[0_0_0_1px_var(--color-border)]">
      <p className="text-[11px] uppercase tracking-wide text-subtle">{label}</p>
      <p className="font-display text-2xl tabular-nums text-fg">{value}</p>
    </div>
  );
}

function intervalLabel(value: OpsRosterRow["interval"]): string {
  if (value === "year") return "Yearly";
  if (value === "month") return "Monthly";
  return "—";
}
