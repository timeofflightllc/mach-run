import { useEffect, useState } from "react";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import {
  deleteOpsAnnouncementFn,
  loadOpsSiteCopy,
  saveOpsAnnouncementFn,
  saveOpsSitePageFn,
} from "@/lib/site-copy/api";
import {
  SITE_PAGE_SLUGS,
  type FooterCopy,
  type PricingCopy,
  type SiteAnnouncement,
  type SitePage,
  type SitePageSlug,
} from "@/lib/site-copy/types";
import {
  DEFAULT_FOOTER_COPY,
  parseFooterCopy,
  serializeFooterCopy,
} from "@/lib/site-copy/footer-copy";
import {
  bulletsFromText,
  bulletsToText,
  DEFAULT_PRICING_COPY,
  parsePricingCopy,
  serializePricingCopy,
} from "@/lib/site-copy/pricing-copy";

const PAGE_LABEL: Record<SitePageSlug, string> = {
  about: "About",
  method: "The Method",
  faq: "FAQ",
  contact: "Contact",
  privacy: "Privacy",
  legal: "Legal / ToS",
  announcements: "Features (header)",
  pricing: "Pricing",
  footer: "Footer content",
};

function Area({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-0 rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg outline-none"
    />
  );
}

function PricingFields({
  value,
  onChange,
}: {
  value: PricingCopy;
  onChange: (next: PricingCopy) => void;
}) {
  const set = (patch: Partial<PricingCopy>) => onChange({ ...value, ...patch });
  const setCard = (
    key: "free" | "individual" | "unlimited" | "advisorLite" | "advisorUnlimited",
    patch: Partial<PricingCopy["free"]>,
  ) => onChange({ ...value, [key]: { ...value[key], ...patch } });

  return (
    <div className="mt-4 space-y-5">
      <p className="text-sm text-muted">
        Prices and package names are not edited here.
      </p>
      <Field label="Hero (two lines)">
        <Area rows={2} value={value.heroH1} onChange={(heroH1) => set({ heroH1 })} />
      </Field>
      <Field label="Hero sub">
        <TextInput value={value.heroSub} onChange={(e) => set({ heroSub: e.target.value })} />
      </Field>
      <Field label="Personal paragraph 1">
        <Area rows={2} value={value.personalP1} onChange={(personalP1) => set({ personalP1 })} />
      </Field>
      <Field label="Personal paragraph 2">
        <Area rows={2} value={value.personalP2} onChange={(personalP2) => set({ personalP2 })} />
      </Field>
      <Field label="Personal paragraph 3">
        <Area rows={2} value={value.personalP3} onChange={(personalP3) => set({ personalP3 })} />
      </Field>
      <Field label="Professional paragraph 1">
        <Area rows={2} value={value.advisorP1} onChange={(advisorP1) => set({ advisorP1 })} />
      </Field>
      <Field label="Professional paragraph 2">
        <Area rows={2} value={value.advisorP2} onChange={(advisorP2) => set({ advisorP2 })} />
      </Field>
      <Field label="Coupon label">
        <TextInput
          value={value.couponLabel}
          onChange={(e) => set({ couponLabel: e.target.value })}
        />
      </Field>
      <Field label="Note under Monthly (Personal)">
        <TextInput
          value={value.intervalNoteMonth}
          onChange={(e) => set({ intervalNoteMonth: e.target.value })}
        />
      </Field>
      <Field label="Note under Monthly (Professional)">
        <TextInput
          value={value.intervalNoteAdvisorMonth}
          onChange={(e) => set({ intervalNoteAdvisorMonth: e.target.value })}
        />
      </Field>
      <Field label="Note under Yearly">
        <TextInput
          value={value.intervalNoteYear}
          onChange={(e) => set({ intervalNoteYear: e.target.value })}
        />
      </Field>

      {(
        [
          ["free", "Free — tag + bullets"],
          ["individual", "Individual — tag + bullets"],
          ["unlimited", "Individual Unlimited — tag + bullets"],
          ["advisorLite", "Advisor Lite — tag + bullets"],
          ["advisorUnlimited", "Advisor Unlimited — tag + bullets"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-subtle">{label}</p>
          <Field label="Tag (line under the price)">
            <TextInput
              value={value[key].tag}
              onChange={(e) => setCard(key, { tag: e.target.value })}
            />
          </Field>
          {key === "advisorLite" ? (
            <Field label="Tag when Yearly is selected">
              <TextInput
                value={value.advisorLiteTagYear}
                onChange={(e) => set({ advisorLiteTagYear: e.target.value })}
              />
            </Field>
          ) : null}
          {key === "advisorUnlimited" ? (
            <Field label="Tag when Yearly is selected">
              <TextInput
                value={value.advisorUnlimitedTagYear}
                onChange={(e) => set({ advisorUnlimitedTagYear: e.target.value })}
              />
            </Field>
          ) : null}
          {key === "free" ? (
            <Field label="Free 4th bullet on Professional">
              <TextInput
                value={value.freeAdvisorBullet}
                onChange={(e) => set({ freeAdvisorBullet: e.target.value })}
              />
            </Field>
          ) : null}
          <Field label="Bullets (one per line; blank line omitted)">
            <Area
              rows={6}
              value={bulletsToText(value[key].bullets)}
              onChange={(text) => setCard(key, { bullets: bulletsFromText(text) })}
            />
          </Field>
        </div>
      ))}
    </div>
  );
}

function FooterFields({
  value,
  onChange,
}: {
  value: FooterCopy;
  onChange: (next: FooterCopy) => void;
}) {
  const set = (patch: Partial<FooterCopy>) => onChange({ ...value, ...patch });
  return (
    <div className="mt-4 space-y-5">
      <p className="text-sm text-muted">
        Calculator footer only. Other pages stay short. Links stay FAQ, Pricing, Privacy, and Terms.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Measure (title)">
          <TextInput value={value.measureTitle} onChange={(e) => set({ measureTitle: e.target.value })} />
        </Field>
        <Field label="Measure (line)">
          <TextInput value={value.measureBody} onChange={(e) => set({ measureBody: e.target.value })} />
        </Field>
        <Field label="Allocate (title)">
          <TextInput value={value.allocateTitle} onChange={(e) => set({ allocateTitle: e.target.value })} />
        </Field>
        <Field label="Allocate (line)">
          <TextInput value={value.allocateBody} onChange={(e) => set({ allocateBody: e.target.value })} />
        </Field>
        <Field label="Compound (title)">
          <TextInput value={value.compoundTitle} onChange={(e) => set({ compoundTitle: e.target.value })} />
        </Field>
        <Field label="Compound (line)">
          <TextInput value={value.compoundBody} onChange={(e) => set({ compoundBody: e.target.value })} />
        </Field>
        <Field label="Harvest (title)">
          <TextInput value={value.harvestTitle} onChange={(e) => set({ harvestTitle: e.target.value })} />
        </Field>
        <Field label="Harvest (line)">
          <TextInput value={value.harvestBody} onChange={(e) => set({ harvestBody: e.target.value })} />
        </Field>
      </div>
      <Field label="FAQ — line after the dash">
        <Area rows={2} value={value.faqBlurb} onChange={(faqBlurb) => set({ faqBlurb })} />
      </Field>
      <Field label="Free vs MACH RUN paid — line after the dash">
        <Area rows={3} value={value.paidBlurb} onChange={(paidBlurb) => set({ paidBlurb })} />
      </Field>
      <Field label="Privacy policy — line after the dash">
        <Area rows={2} value={value.privacyBlurb} onChange={(privacyBlurb) => set({ privacyBlurb })} />
      </Field>
      <Field label="OODA AI asterisk">
        <Area rows={3} value={value.oodaAiLine} onChange={(oodaAiLine) => set({ oodaAiLine })} />
      </Field>
      <Field label="Projections">
        <Area rows={4} value={value.projections} onChange={(projections) => set({ projections })} />
      </Field>
      <Field label="SSA / DFAS / VA">
        <Area rows={4} value={value.benefits} onChange={(benefits) => set({ benefits })} />
      </Field>
      <Field label="Boyd / OODA">
        <Area rows={4} value={value.boyd} onChange={(boyd) => set({ boyd })} />
      </Field>
    </div>
  );
}

export function SiteCopyDesk() {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [notes, setNotes] = useState<SiteAnnouncement[]>([]);
  const [slug, setSlug] = useState<SitePageSlug>("about");
  const [draft, setDraft] = useState<SitePage | null>(null);
  const [pricing, setPricing] = useState<PricingCopy>(DEFAULT_PRICING_COPY);
  const [footer, setFooter] = useState<FooterCopy>(DEFAULT_FOOTER_COPY);
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

  useEffect(() => {
    if (draft?.slug === "pricing") setPricing(parsePricingCopy(draft.body));
    if (draft?.slug === "footer") setFooter(parseFooterCopy(draft.body));
  }, [draft]);

  function onPricingChange(next: PricingCopy) {
    setPricing(next);
    setDraft((d) =>
      d ? { ...d, title: "Pricing", kicker: "", body: serializePricingCopy(next) } : d,
    );
  }

  function onFooterChange(next: FooterCopy) {
    setFooter(next);
    setDraft((d) =>
      d ? { ...d, title: "Footer content", kicker: "", body: serializeFooterCopy(next) } : d,
    );
  }

  async function savePage() {
    if (!draft) return;
    setBusy(true);
    setStatus(null);
    try {
      const payload =
        draft.slug === "pricing"
          ? { ...draft, title: "Pricing", kicker: "", body: serializePricingCopy(pricing) }
          : draft.slug === "footer"
            ? { ...draft, title: "Footer content", kicker: "", body: serializeFooterCopy(footer) }
            : draft;
      const r = await saveOpsSitePageFn({ data: payload });
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

  const pricingOpen = slug === "pricing";
  const footerOpen = slug === "footer";

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-surface p-4 text-sm shadow-[0_0_0_1px_var(--color-border)]">
        <h2 className="font-display text-xl font-bold text-fg">Site pages</h2>
        <p className="mt-1 text-muted">
          {pricingOpen
            ? "Pricing cards, hero, and bullets. One line per bullet."
            : footerOpen
              ? "Public footer words. Layout and links stay in code."
              : "About, The Method, FAQ, Contact intro, Privacy, Legal, and the Features header. Lines that start with # become headings. Use [Contact](/contact) for a link."}
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
        {draft && pricingOpen ? (
          <>
            <PricingFields value={pricing} onChange={onPricingChange} />
            <div className="mt-4">
              <PrimaryButton type="button" disabled={busy} onClick={() => void savePage()}>
                Save Pricing
              </PrimaryButton>
            </div>
          </>
        ) : draft && footerOpen ? (
          <>
            <FooterFields value={footer} onChange={onFooterChange} />
            <div className="mt-4">
              <PrimaryButton type="button" disabled={busy} onClick={() => void savePage()}>
                Save Footer content
              </PrimaryButton>
            </div>
          </>
        ) : draft ? (
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
