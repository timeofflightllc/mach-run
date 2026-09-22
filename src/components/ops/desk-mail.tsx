import { useMemo, useState } from "react";
import { Field, PrimaryButton, SelectInput, TextInput } from "@/components/ui/field";
import { sendOpsDeskMailFn } from "@/lib/ops/api";
import {
  audienceLabel,
  mergeMail,
  peopleFromRoster,
  withMailFooter,
} from "@/lib/ops/mail";
import type { OpsPaidFilter, OpsPlanFilter, OpsRosterRow, OpsStatusFilter } from "@/lib/ops/roster";

export function DeskMail({
  q,
  plan,
  paid,
  status,
  rows,
  total,
  only,
  onClearOnly,
  onQuery,
}: {
  q: string;
  plan: OpsPlanFilter;
  paid: OpsPaidFilter;
  status: OpsStatusFilter;
  rows: OpsRosterRow[];
  total: number;
  only: OpsRosterRow | null;
  onClearOnly: () => void;
  onQuery: (patch: {
    q?: string;
    plan?: OpsPlanFilter;
    paid?: OpsPaidFilter;
    status?: OpsStatusFilter;
  }) => void;
}) {
  const [subject, setSubject] = useState("A note from MACH RUN");
  const [body, setBody] = useState(
    "Hi {{first_name}},\n\nA short note about your MACH RUN ({{package}}) account.\n\n— MACH RUN",
  );
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  const people = useMemo(() => {
    if (only) return peopleFromRoster([only]);
    return peopleFromRoster(rows);
  }, [only, rows]);

  const query = { q, plan, paid, status };
  const toLine = only
    ? `Send to 1 person — ${only.email ?? only.id}`
    : audienceLabel(query, people.length);
  const sample = people[0] ?? null;
  const previewSubject = sample ? mergeMail(subject, sample) : subject;
  const previewBody = sample ? withMailFooter(mergeMail(body, sample)) : withMailFooter(body);

  async function send() {
    setBusy(true);
    setStatusLine(null);
    try {
      const r = await sendOpsDeskMailFn({
        data: {
          confirm,
          subject,
          body,
          q: only?.email ?? q,
          plan: only ? "all" : plan,
          paid: only ? "all" : paid,
          status: only ? "all" : status,
          onlyUserId: only?.id ?? "",
        },
      });
      if (!r.ok) {
        setStatusLine(r.error ?? "Send failed.");
        return;
      }
      setConfirm("");
      const fail = r.failed ? ` · ${r.failed} failed` : "";
      setStatusLine(`${r.sent} sent · ${r.skipped} skipped${fail}.`);
    } catch (e) {
      setStatusLine(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl bg-surface p-4 text-sm shadow-[0_0_0_1px_var(--color-border)]">
      <div>
        <h2 className="font-display text-xl font-bold text-fg">Desk mail</h2>
        <p className="mt-1 text-muted">
          One template, one Resend send per person. Tokens: {"{{first_name}}"} {"{{name}}"}{" "}
          {"{{email}}"} {"{{package}}"}. No household numbers.
        </p>
        <p className="mt-2 text-fg">{toLine}</p>
        {only ? (
          <button
            type="button"
            className="mt-1 text-sm text-fg underline underline-offset-4"
            onClick={onClearOnly}
          >
            Use the roster filter instead
          </button>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Search">
              <TextInput
                value={q}
                onChange={(e) => onQuery({ q: e.target.value })}
                placeholder="Email or name"
              />
            </Field>
            <Field label="Package">
              <SelectInput
                value={plan}
                onChange={(e) => onQuery({ plan: e.target.value as OpsPlanFilter })}
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
                onChange={(e) => onQuery({ paid: e.target.value as OpsPaidFilter })}
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="free">Free / unpaid</option>
              </SelectInput>
            </Field>
            <Field label="Status">
              <SelectInput
                value={status}
                onChange={(e) => onQuery({ status: e.target.value as OpsStatusFilter })}
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
        )}
        {!only && total > people.length ? (
          <p className="mt-1 text-xs text-subtle">
            This page only (max {rows.length} rows). {total} match the filter.
          </p>
        ) : null}
      </div>

      <Field label="Subject">
        <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
      </Field>
      <Field label="Body">
        <textarea
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg outline-none"
        />
      </Field>

      <div className="rounded-lg bg-elevated p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">Preview</p>
        {sample ? (
          <p className="mt-1 text-xs text-subtle">Merged for {sample.email}</p>
        ) : (
          <p className="mt-1 text-xs text-subtle">No emails in this filter.</p>
        )}
        <p className="mt-2 font-medium text-fg">{previewSubject}</p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted">{previewBody}</pre>
      </div>

      <Field
        label='Type SEND to send'
        hint="This sends N separate emails. There is no undo."
      >
        <TextInput
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <PrimaryButton type="button" disabled={busy || !people.length} onClick={() => void send()}>
        {busy ? "Sending…" : toLine}
      </PrimaryButton>
      {statusLine ? <p className="text-sm text-muted">{statusLine}</p> : null}
    </section>
  );
}
