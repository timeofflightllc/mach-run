import { useEffect, useState } from "react";
import { DebriefForm } from "@/components/beta/debrief-form";
import { Field, GhostButton, PrimaryButton } from "@/components/ui/field";
import {
  betaDeskCsvFn,
  betaDeskFn,
  betaDeskOneFn,
  grantBetaEmailFn,
  revokeBetaEmailFn,
  setBetaLimitFn,
} from "@/lib/beta/desk-api";
import { betaText } from "@/lib/beta/export";
import { downloadBetaPdf } from "@/lib/beta/pdf";
import type { BetaAccount, BetaDeskDetail, BetaDeskRow, BetaInvite } from "@/lib/beta/desk";

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function BetaDesk() {
  const [email, setEmail] = useState("");
  const [accounts, setAccounts] = useState<BetaAccount[]>([]);
  const [invites, setInvites] = useState<BetaInvite[]>([]);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<BetaDeskRow[]>([]);
  const [open, setOpen] = useState<BetaDeskDetail | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const result = await betaDeskFn();
    if (!result.allowed) {
      setStatus("Beta is locked.");
      return;
    }
    setInvites(result.invites);
    setAccounts(result.accounts);
    setLimits(Object.fromEntries(result.invites.map((row) => [row.email, String(row.limit)])));
    setRows(result.rows);
  }

  useEffect(() => {
    void reload().catch(() => setStatus("Could not load beta."));
  }, []);

  async function grant() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await grantBetaEmailFn({ data: { email } });
      if (!result.allowed) {
        setStatus("Beta is locked.");
        return;
      }
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      setEmail("");
      setStatus(
        result.mailed
          ? "Invited. The email is on its way. They start with 3 submissions."
          : "Invited, but the email did not send. They start with 3 submissions.",
      );
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function saveLimit(address: string, current: number) {
    if ((limits[address] ?? "") === String(current)) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await setBetaLimitFn({ data: { email: address, limit: limits[address] } });
      if (!result.allowed) {
        setStatus("Beta is locked.");
        return;
      }
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      setStatus("Limit saved. Debriefs already submitted stay.");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(address: string) {
    setBusy(true);
    setStatus(null);
    try {
      const result = await revokeBetaEmailFn({ data: { email: address } });
      if (!result.allowed) {
        setStatus("Beta is locked.");
        return;
      }
      if (open?.email === address) setOpen(null);
      setStatus("Invite removed. Submitted debriefs stay.");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function openRow(id: string) {
    setBusy(true);
    setStatus(null);
    try {
      const result = await betaDeskOneFn({ data: { id } });
      if (!result.allowed) {
        setStatus("Beta is locked.");
        return;
      }
      setOpen(result.row);
      if (!result.row) setStatus("That debrief is gone.");
    } finally {
      setBusy(false);
    }
  }

  function downloadText() {
    if (!open) return;
    download(`mach-run-beta-${open.id}.txt`, betaText(open), "text/plain;charset=utf-8");
  }

  function downloadPdf() {
    if (!open) return;
    void downloadBetaPdf(open);
  }

  async function downloadAll() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await betaDeskCsvFn();
      if (!result.allowed) {
        setStatus("Beta is locked.");
        return;
      }
      download("mach-run-beta-debriefs.csv", result.csv, "text/csv;charset=utf-8");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="max-w-xl space-y-3 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
        <p className="font-display text-lg text-fg">Invite</p>
        <p className="text-sm text-muted">
          Pick an account that already exists. They start with 3 debriefs, and the invite email goes to that address.
        </p>
        <Field label="Account">
          <select
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 w-full rounded-lg border border-border bg-elevated px-3 text-sm text-fg outline-none"
          >
            <option value="">{accounts.length ? "Select an account" : "No accounts waiting"}</option>
            {accounts.map((account) => (
              <option key={account.email} value={account.email}>
                {account.name ? `${account.name} — ${account.email}` : account.email}
              </option>
            ))}
          </select>
        </Field>
        <PrimaryButton disabled={busy || !email} onClick={() => void grant()}>
          Grant access
        </PrimaryButton>
      </section>

      {status ? <p className="text-sm text-muted">{status}</p> : null}

      <div className="overflow-x-auto rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Limit</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-muted" colSpan={4}>
                  No one is invited.
                </td>
              </tr>
            ) : (
              invites.map((row) => (
                <tr key={row.email} className="border-t border-border">
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3 tabular-nums">{row.submitted}</td>
                  <td className="px-4 py-3">
                    <input
                      inputMode="numeric"
                      value={limits[row.email] ?? ""}
                      onChange={(event) => setLimits((current) => ({ ...current, [row.email]: event.target.value }))}
                      onBlur={() => void saveLimit(row.email, row.limit)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void saveLimit(row.email, row.limit);
                      }}
                      className="h-10 w-20 rounded-lg border border-border bg-elevated px-3 text-sm text-fg"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <GhostButton disabled={busy} onClick={() => void revoke(row.email)}>
                      Revoke
                    </GhostButton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-fg">Submitted debriefs</h2>
          <GhostButton disabled={busy} onClick={() => void downloadAll()}>
            Download all CSV
          </GhostButton>
        </div>
        <div className="overflow-x-auto rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Pass</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-muted" colSpan={5}>
                    No submitted debriefs.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">{row.name || "—"}</td>
                    <td className="px-4 py-3">{row.email || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{row.pass}</td>
                    <td className="px-4 py-3">{when(row.submittedAt)} UTC</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-sm font-medium text-fg underline underline-offset-4"
                        onClick={() => void openRow(row.id)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {open ? (
        <section className="space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-fg">
              {open.name || "Debrief"} · pass {open.pass} · {when(open.submittedAt)} UTC
            </p>
            <div className="flex flex-wrap gap-2">
              <GhostButton onClick={downloadText}>Download text</GhostButton>
              <GhostButton onClick={downloadPdf}>Download PDF</GhostButton>
            </div>
          </div>
          <DebriefForm answers={open.answers} email={open.email} readOnly />
        </section>
      ) : null}
    </div>
  );
}
