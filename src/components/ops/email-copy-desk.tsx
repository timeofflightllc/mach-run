import { useEffect, useState } from "react";
import { Field, GhostButton, PrimaryButton, TextArea, TextInput } from "@/components/ui/field";
import { listOpsEmailCopyFn, saveOpsEmailCopyFn, sendOpsEmailTestFn } from "@/lib/ops/api";

type Row = {
  kind: string;
  label: string;
  audience: string;
  tokens: string[];
  subject: string;
  body: string;
  footer: string;
  custom: boolean;
};

export function EmailCopyDesk() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function reload() {
    const r = await listOpsEmailCopyFn({ data: {} });
    if (!r.allowed) {
      setLoadError("Desk mail copy is locked.");
      return;
    }
    setRows(r.rows);
  }

  useEffect(() => {
    void reload().catch(() => setLoadError("Could not load email copy."));
  }, []);

  function patch(kind: string, next: Partial<Row>) {
    setRows((list) => list.map((row) => (row.kind === kind ? { ...row, ...next } : row)));
  }

  async function save(row: Row) {
    setBusy(row.kind + ":save");
    setStatus((s) => ({ ...s, [row.kind]: null }));
    try {
      const r = await saveOpsEmailCopyFn({
        data: { kind: row.kind, subject: row.subject, body: row.body, footer: row.footer },
      });
      if (!r.ok) {
        setStatus((s) => ({ ...s, [row.kind]: r.error }));
        return;
      }
      const cleared = !row.subject.trim() && !row.body.trim();
      setStatus((s) => ({
        ...s,
        [row.kind]: cleared ? "Back to the built-in email." : "Saved. Nobody was emailed.",
      }));
      await reload();
    } catch {
      setStatus((s) => ({ ...s, [row.kind]: "Could not save." }));
    } finally {
      setBusy(null);
    }
  }

  async function sendTest(row: Row) {
    setBusy(row.kind + ":test");
    setStatus((s) => ({ ...s, [row.kind]: null }));
    try {
      const r = await sendOpsEmailTestFn({
        data: { kind: row.kind, subject: row.subject, body: row.body, footer: row.footer },
      });
      if (!r.ok) {
        setStatus((s) => ({ ...s, [row.kind]: r.error }));
        return;
      }
      setStatus((s) => ({ ...s, [row.kind]: `Test sent to ${r.to}.` }));
    } catch {
      setStatus((s) => ({ ...s, [row.kind]: "Could not send the test." }));
    } finally {
      setBusy(null);
    }
  }

  if (loadError) return <p className="text-sm text-muted">{loadError}</p>;
  if (!rows.length) return <p className="text-sm text-muted">Loading email copy…</p>;

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted">
        These three go out on their own. Subject, body, and the footer under the card are editable.
        The logo, colors, and buttons stay. Save does not send mail. Clear subject and body, then
        save, to use the built-in email again. Send test goes only to the email on this desk login.
      </p>
      {rows.map((row) => (
        <section
          key={row.kind}
          className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--color-border)]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg text-fg">{row.label}</h2>
            <p className="text-xs text-muted">{row.custom ? "Saved copy" : "Built-in"}</p>
          </div>
          <p className="mt-1 text-sm text-muted">{row.audience}</p>
          <div className="mt-4 space-y-3">
            <Field label="Subject">
              <TextInput
                className="max-w-none"
                value={row.subject}
                onChange={(e) => patch(row.kind, { subject: e.target.value })}
              />
            </Field>
            <Field label="Body">
              <TextArea
                className="max-w-none"
                value={row.body}
                rows={12}
                onChange={(e) => patch(row.kind, { body: e.target.value })}
              />
            </Field>
            <Field label="Footer" hint="Small print under the card. Clear it to send with no footer.">
              <TextArea
                className="max-w-none"
                value={row.footer}
                rows={4}
                onChange={(e) => patch(row.kind, { footer: e.target.value })}
              />
            </Field>
            <p className="text-xs text-muted">
              Tokens: {row.tokens.map((token) => `{{${token}}}`).join(", ")}. Anything else is left as typed.
              {row.kind === "verify"
                ? " {{code}} is required. A line that is only {{code}} becomes the code box and Verify button."
                : ""}
              {row.kind === "first_flight" ? " A line of numbered steps stays a checklist." : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton disabled={busy !== null} onClick={() => void save(row)}>
                {busy === row.kind + ":save" ? "Saving…" : "Save"}
              </PrimaryButton>
              <GhostButton disabled={busy !== null} onClick={() => void sendTest(row)}>
                {busy === row.kind + ":test" ? "Sending…" : "Send test"}
              </GhostButton>
            </div>
            {status[row.kind] ? <p className="text-sm text-muted">{status[row.kind]}</p> : null}
          </div>
        </section>
      ))}
    </div>
  );
}
