import { useEffect, useState } from "react";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import {
  deleteOpsAnnouncementFn,
  loadOpsSiteCopy,
  saveOpsAnnouncementFn,
  saveOpsSitePageFn,
} from "@/lib/site-copy/api";
import { SITE_PAGE_SLUGS, type SiteAnnouncement, type SitePage, type SitePageSlug } from "@/lib/site-copy/types";

const PAGE_LABEL: Record<SitePageSlug, string> = {
  about: "About",
  contact: "Contact",
  privacy: "Privacy",
  announcements: "Features (header)",
};

export function SiteCopyDesk() {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [notes, setNotes] = useState<SiteAnnouncement[]>([]);
  const [slug, setSlug] = useState<SitePageSlug>("about");
  const [draft, setDraft] = useState<SitePage | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState({
    at: new Date().toISOString().slice(0, 10),
    title: "",
    blurb: "",
  });

  async function reload() {
    const r = await loadOpsSiteCopy();
    if (!r.allowed) {
      setStatus("Desk copy is locked.");
      return;
    }
    setPages(r.copy.pages);
    setNotes(r.copy.announcements);
    const current = r.copy.pages.find((p) => p.slug === slug) ?? r.copy.pages[0];
    if (current) setDraft(current);
  }

  useEffect(() => {
    void reload().catch(() => setStatus("Could not load site copy."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const next = pages.find((p) => p.slug === slug);
    if (next) setDraft(next);
  }, [slug, pages]);

  async function savePage() {
    if (!draft) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await saveOpsSitePageFn({ data: draft });
      setStatus(r.ok ? `${PAGE_LABEL[draft.slug]} saved.` : r.error ?? "Save failed.");
      if (r.ok) await reload();
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(item: SiteAnnouncement) {
    setBusy(true);
    setStatus(null);
    try {
      const r = await saveOpsAnnouncementFn({ data: item });
      setStatus(r.ok ? "Feature saved." : r.error ?? "Save failed.");
      if (r.ok) await reload();
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!fresh.title.trim() || !fresh.blurb.trim()) {
      setStatus("New feature needs a title and a note.");
      return;
    }
    await saveNote({
      id: "",
      at: fresh.at.trim() || new Date().toISOString().slice(0, 10),
      title: fresh.title,
      blurb: fresh.blurb,
      sortOrder: 0,
    });
    setFresh({ at: new Date().toISOString().slice(0, 10), title: "", blurb: "" });
  }

  async function removeNote(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await deleteOpsAnnouncementFn({ data: { id } });
      setStatus(r.ok ? "Feature deleted." : r.error ?? "Delete failed.");
      if (r.ok) await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-surface p-4 text-sm shadow-[0_0_0_1px_var(--color-border)]">
        <h2 className="font-display text-xl font-bold text-fg">Site pages</h2>
        <p className="mt-1 text-muted">
          About, Contact intro, Privacy, and the Features header. Lines that start
          with # become headings. Use [Contact](/contact) for a link.
        </p>
        <div className="mt-3 inline-flex flex-wrap rounded-lg bg-elevated p-1">
          {SITE_PAGE_SLUGS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSlug(id)}
              className={
                "h-10 rounded-md px-3 text-sm font-medium " +
                (slug === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")
              }
            >
              {PAGE_LABEL[id]}
            </button>
          ))}
        </div>
        {draft ? (
          <div className="mt-4 space-y-3">
            <Field label="Title">
              <TextInput
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field label="Line under the title">
              <TextInput
                value={draft.kicker}
                onChange={(e) => setDraft({ ...draft, kicker: e.target.value })}
              />
            </Field>
            <Field label="Body">
              <textarea
                rows={14}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                className="w-full min-w-0 rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg outline-none"
              />
            </Field>
            <PrimaryButton type="button" disabled={busy} onClick={() => void savePage()}>
              Save {PAGE_LABEL[draft.slug]}
            </PrimaryButton>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl bg-surface p-4 text-sm shadow-[0_0_0_1px_var(--color-border)]">
        <h2 className="font-display text-xl font-bold text-fg">Feature announcements</h2>
        <p className="mt-1 text-muted">
          Add, edit, or delete. Newest sort order sits at the top of Features.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Date">
            <TextInput
              value={fresh.at}
              onChange={(e) => setFresh({ ...fresh, at: e.target.value })}
              placeholder="2026-09-07"
            />
          </Field>
          <Field label="Title" className="md:col-span-2">
            <TextInput
              value={fresh.title}
              onChange={(e) => setFresh({ ...fresh, title: e.target.value })}
            />
          </Field>
          <Field label="Short note" className="md:col-span-3">
            <TextInput
              value={fresh.blurb}
              onChange={(e) => setFresh({ ...fresh, blurb: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-3">
          <PrimaryButton type="button" disabled={busy} onClick={() => void addNote()}>
            Add feature
          </PrimaryButton>
        </div>

        <ul className="mt-5 space-y-4">
          {notes.map((item) => (
            <li key={item.id} className="border-t border-border pt-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Date">
                  <TextInput
                    value={item.at}
                    onChange={(e) =>
                      setNotes((list) =>
                        list.map((n) => (n.id === item.id ? { ...n, at: e.target.value } : n)),
                      )
                    }
                  />
                </Field>
                <Field label="Title" className="md:col-span-2">
                  <TextInput
                    value={item.title}
                    onChange={(e) =>
                      setNotes((list) =>
                        list.map((n) =>
                          n.id === item.id ? { ...n, title: e.target.value } : n,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Short note" className="md:col-span-3">
                  <TextInput
                    value={item.blurb}
                    onChange={(e) =>
                      setNotes((list) =>
                        list.map((n) =>
                          n.id === item.id ? { ...n, blurb: e.target.value } : n,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveNote(item)}
                  className="h-10 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeNote(item.id, item.title)}
                  className="h-10 rounded-lg px-3 text-sm font-medium text-negative shadow-[0_0_0_1px_var(--color-border)] disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {status ? <p className="text-sm text-muted">{status}</p> : null}
    </div>
  );
}
