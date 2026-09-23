import { useEffect, useMemo, useState } from "react";
import { Field, GhostButton, PrimaryButton, SelectInput, TextInput } from "@/components/ui/field";
import { listOpsRoster, loadOpsMailDraftFn, saveOpsMailDraftFn, sendOpsDeskMailFn } from "@/lib/ops/api";
import {
  audienceLabel,
  MAIL_FOOTER_TEXT,
  mailPersonMatch,
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
  onPickOnly,
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
  onPickOnly: (row: OpsRosterRow) => void;
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
  const [footer, setFooter] = useState(MAIL_FOOTER_TEXT);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [findQ, setFindQ] = useState("");
  const [findHits, setFindHits] = useState<OpsRosterRow[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    let live = true;
    void loadOpsMailDraftFn({ data: {} })
      .then((r) => {
        if (!live || !r.allowed || !r.draft) return;
        setSubject(r.draft.subject);
        setBody(r.draft.body);
        setFooter(r.draft.footer);
      })
      .catch(() => {
        /* built-in copy stays */
      });
    return () => {
      live = false;
    };
  }, []);

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
  const previewBody = sample
    ? withMailFooter(mergeMail(body, sample), mergeMail(footer, sample))
    : withMailFooter(body, footer);

  const localHits = useMemo(() => {
    if (!findQ.trim()) return [];
    return rows.filter((row) => mailPersonMatch(row, findQ)).slice(0, 12);
  }, [findQ, rows]);

  useEffect(() => {
    const needle = findQ.trim();
    if (needle.length < 2) {
      setFindHits(localHits);
      setHighlight(0);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      void listOpsRoster({ data: { q: needle, plan: "all", paid: "all", status: "all", offset: 0 } })
        .then((r) => {
          if (!live) return;
          const extra = r.allowed ? r.rows.filter((row) => mailPersonMatch(row, needle)) : [];
          const seen = new Set<string>();
          const merged: OpsRosterRow[] = [];
          for (const row of [...localHits, ...extra]) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            merged.push(row);
            if (merged.length >= 12) break;
          }
          setFindHits(merged);
          setHighlight(0);
        })
        .catch(() => {
          if (live) setFindHits(localHits);
        });
    }, 180);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [findQ, localHits]);

  function pick(row: OpsRosterRow) {
    onPickOnly(row);
    setFindQ("");
    setListOpen(false);
    setFindHits([]);
  }

  async function saveDraft() {
    setSaving(true);
    setStatusLine(null);
    try {
      const r = await saveOpsMailDraftFn({ data: { subject, body, footer } });
      if (!r.ok) {
        setStatusLine(r.error);
        return;
      }
      setStatusLine("Draft saved. Nobody was emailed.");
    } catch {
      setStatusLine("Could not save the draft.");
    } finally {
      setSaving(false);
    }
  }

  async function send() {
    setBusy(true);
    setStatusLine(null);
    try {
      const r = await sendOpsDeskMailFn({
        data: {
          confirm,
          subject,
          body,
          footer,
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

  const showList = listOpen && findQ.trim().length > 0 && findHits.length > 0;

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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-elevated px-3 py-1 text-sm text-fg">
              {only.name ? `${only.name} · ` : ""}
              {only.email ?? only.id}
            </span>
            <button
              type="button"
              className="text-sm text-fg underline underline-offset-4"
              onClick={onClearOnly}
            >
              Use the roster filter instead
            </button>
          </div>
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

      <div className="relative">
        <Field label="Find a person" hint="Type a name. Click the one you want.">
          <TextInput
            value={findQ}
            autoComplete="off"
            spellCheck={false}
            placeholder="Matt…"
            onFocus={() => setListOpen(true)}
            onChange={(e) => {
              setFindQ(e.target.value);
              setListOpen(true);
            }}
            onKeyDown={(e) => {
              if (!showList) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((i) => Math.min(findHits.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                const row = findHits[highlight];
                if (row) {
                  e.preventDefault();
                  pick(row);
                }
              } else if (e.key === "Escape") {
                setListOpen(false);
              }
            }}
          />
        </Field>
        {showList ? (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
            {findHits.map((row, i) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={
                    "flex w-full flex-col items-start px-3 py-2 text-left " +
                    (i === highlight ? "bg-elevated" : "")
                  }
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(row)}
                >
                  <span className="text-sm text-fg">{row.name || "No display name"}</span>
                  <span className="text-xs text-muted">
                    {row.email ?? row.id}
                    {row.packageLabel ? ` · ${row.packageLabel}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
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
      <Field
        label="Footer"
        hint="Shown under the body. Clear it to send with no footer."
      >
        <textarea
          rows={5}
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
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
        label="Type SEND to send"
        hint="This sends N separate emails. There is no undo."
      >
        <TextInput
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <GhostButton type="button" disabled={busy || saving} onClick={() => void saveDraft()}>
          {saving ? "Saving…" : "Save draft"}
        </GhostButton>
        <PrimaryButton type="button" disabled={busy || saving || !people.length} onClick={() => void send()}>
          {busy ? "Sending…" : toLine}
        </PrimaryButton>
      </div>
      {statusLine ? <p className="text-sm text-muted">{statusLine}</p> : null}
    </section>
  );
}
