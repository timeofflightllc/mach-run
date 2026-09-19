import { useEffect, useMemo, useState } from "react";
import { Field, TextInput } from "@/components/ui/field";
import { listOpsRoster } from "@/lib/ops/api";
import { OPS_ROSTER_PAGE, type OpsRosterRow } from "@/lib/ops/roster";
import { OpsDeleteAccount } from "./ops-delete-account";

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
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
        Click a person, then Delete. MACH RUN asks for your desk password, then
        one more confirm. Packages stay on Roster.
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
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-subtle">
            <tr>
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
                <td className="px-3 py-6 text-muted" colSpan={5}>
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
        <section className="rounded-xl bg-surface p-4 text-sm shadow-[0_0_0_1px_var(--color-border)]">
          <h2 className="font-display text-2xl text-fg">{selected.email ?? selected.id}</h2>
          <p className="mt-1 text-muted">
            {selected.name ?? "No display name"}
            {selected.id ? ` · ${selected.id}` : ""}
          </p>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-subtle">Package</dt>
              <dd className="text-fg">{selected.packageLabel}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-subtle">Created</dt>
              <dd className="text-fg">{fmtDate(selected.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-subtle">Sign-in</dt>
              <dd className="text-fg">{selected.authHint}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-subtle">Status</dt>
              <dd className="text-fg">{selected.status}</dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-border/70 pt-4">
            <OpsDeleteAccount
              row={selected}
              onDeleted={() => {
                setOpenId(null);
                setTick((n) => n + 1);
              }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
