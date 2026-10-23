import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/ui/field";
import { listPayTablesFn, readPayUploadFn, savePayUploadFn } from "@/lib/retired-pay/desk-api";
import type { PayFiles, PayPageId, PayYearRow } from "@/lib/retired-pay/catalog";

const INPUTS: Array<{ id: PayPageId; label: string }> = [
  { id: "officers", label: "Officers" },
  { id: "prior", label: "Prior enlisted" },
  { id: "warrant", label: "Warrant" },
  { id: "enlisted", label: "Enlisted" },
];

const EMPTY: PayFiles = { officers: "", prior: "", warrant: "", enlisted: "" };

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function PayTablesDesk() {
  const [rows, setRows] = useState<PayYearRow[]>([]);
  const [files, setFiles] = useState<PayFiles>(EMPTY);
  const [names, setNames] = useState<Record<PayPageId, string>>({ officers: "", prior: "", warrant: "", enlisted: "" });
  const [preview, setPreview] = useState<{ year: number; spot: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function reload() {
    const result = await listPayTablesFn();
    if (!result.allowed) {
      setLocked(true);
      return;
    }
    setRows(result.rows);
  }

  useEffect(() => {
    void reload().catch(() => setError("Could not load the pay years."));
  }, []);

  async function onFile(id: PayPageId, file: File | undefined) {
    setPreview(null);
    setError(null);
    if (!file) {
      setFiles((current) => ({ ...current, [id]: "" }));
      setNames((current) => ({ ...current, [id]: "" }));
      return;
    }
    if (file.size > 1_000_000) {
      setError(`${INPUTS.find((row) => row.id === id)?.label ?? "That page"} is too large.`);
      return;
    }
    const text = await file.text();
    setFiles((current) => ({ ...current, [id]: text }));
    setNames((current) => ({ ...current, [id]: file.name }));
  }

  async function readPages() {
    setBusy("read");
    setError(null);
    setPreview(null);
    try {
      const result = await readPayUploadFn({ data: files });
      if (!result.allowed) {
        setLocked(true);
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview({ year: result.year, spot: result.spot });
    } catch {
      setError("Could not read those pages.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!preview) return;
    setBusy("save");
    setError(null);
    try {
      const result = await savePayUploadFn({ data: files });
      if (!result.allowed) {
        setLocked(true);
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(null);
      setFiles(EMPTY);
      setNames({ officers: "", prior: "", warrant: "", enlisted: "" });
      setFormKey((key) => key + 1);
      await reload();
    } catch {
      setError("Could not save that year.");
    } finally {
      setBusy(null);
    }
  }

  if (locked) return <p className="text-sm text-muted">Basic pay is locked.</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="overflow-hidden rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-border)]">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Year</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Quiz</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-t border-border">
                <td className="px-4 py-3">January 1, {row.year}</td>
                <td className="px-4 py-3 text-muted">{row.source === "uploaded" ? "Uploaded" : "On file"}</td>
                <td className="px-4 py-3">{row.inUse ? "In use" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 rounded-lg bg-surface p-4 shadow-[0_0_0_1px_var(--color-border)]">
        <p className="text-sm text-muted">
          Save the four official DFAS basic-pay pages as HTML. The year is read from the page, not typed.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {INPUTS.map((input) => (
            <label key={input.id} className="block text-sm">
              <span className="mb-1 block text-muted">{input.label}</span>
              <input
                key={`${input.id}-${formKey}`}
                type="file"
                accept=".html,.htm,text/html"
                className="block w-full text-sm"
                onChange={(event) => void onFile(input.id, event.target.files?.[0])}
              />
              {names[input.id] ? <span className="mt-1 block text-xs text-subtle">{names[input.id]}</span> : null}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton disabled={busy != null} onClick={() => void readPages()}>
            {busy === "read" ? "Reading" : "Read the pages"}
          </PrimaryButton>
          {preview ? (
            <PrimaryButton disabled={busy != null} onClick={() => void save()}>
              {busy === "save" ? "Saving" : `Save ${preview.year}`}
            </PrimaryButton>
          ) : null}
        </div>
        {preview ? (
          <p className="text-sm">
            January 1, {preview.year}. E-7 over 20 is {money(preview.spot)}.
          </p>
        ) : null}
        {error ? <p className="text-sm text-fg">{error}</p> : null}
      </div>
    </div>
  );
}
