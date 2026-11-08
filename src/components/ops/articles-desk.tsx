import { useEffect, useState } from "react";
import { SavedAt } from "@/components/ops/saved-at";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import { createOpsArticleFn, listOpsArticlesFn, saveOpsArticleFn } from "@/lib/articles/desk-api";
import { articleDateLabel } from "@/lib/articles/body";
import { articleDay, todayUtcDay } from "@/lib/articles/slug";
import type { ArticleRecord } from "@/lib/articles/types";

const areaClass =
  "w-full min-w-0 rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg outline-none";

function ArticleFields({
  pageTitle,
  h1,
  subtitle,
  body,
  date,
  onPageTitle,
  onH1,
  onSubtitle,
  onBody,
  onDate,
}: {
  pageTitle: string;
  h1: string;
  subtitle: string;
  body: string;
  date: string;
  onPageTitle: (value: string) => void;
  onH1: (value: string) => void;
  onSubtitle: (value: string) => void;
  onBody: (value: string) => void;
  onDate: (value: string) => void;
}) {
  return (
    <>
      <Field label="Page title">
        <TextInput value={pageTitle} onChange={(e) => onPageTitle(e.target.value)} />
      </Field>
      <Field label="H1">
        <TextInput value={h1} onChange={(e) => onH1(e.target.value)} />
      </Field>
      <Field label="Subtitle">
        <TextInput value={subtitle} onChange={(e) => onSubtitle(e.target.value)} />
      </Field>
      <Field label="Date">
        <TextInput type="date" value={date} onChange={(e) => onDate(e.target.value)} />
      </Field>
      <Field label="Body">
        <textarea rows={18} value={body} onChange={(e) => onBody(e.target.value)} className={areaClass} />
      </Field>
    </>
  );
}

export function ArticlesDesk() {
  const [articles, setArticles] = useState<ArticleRecord[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ pageTitle: "", h1: "", subtitle: "", body: "", date: "" });
  const [fresh, setFresh] = useState({ slug: "", pageTitle: "", h1: "", subtitle: "", body: "", date: todayUtcDay() });

  async function reload() {
    const result = await listOpsArticlesFn();
    if (!result.allowed) {
      setStatus("Articles are locked.");
      setArticles([]);
      return;
    }
    setArticles(result.articles);
  }

  useEffect(() => {
    void reload().catch(() => setStatus("Could not load articles."));
  }, []);

  function openRow(article: ArticleRecord) {
    setAdding(false);
    setOpen(article.slug);
    setDraft({
      pageTitle: article.pageTitle,
      h1: article.h1,
      subtitle: article.subtitle,
      body: article.body,
      date: articleDay(article.createdAt),
    });
    setStatus(null);
    setSavedAt(null);
  }

  async function saveOpen() {
    if (!open) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await saveOpsArticleFn({ data: { slug: open, ...draft } });
      if (!result.ok) {
        setStatus(result.error ?? "Could not save.");
        return;
      }
      setSavedAt(new Date());
      await reload();
    } catch {
      setStatus("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await createOpsArticleFn({ data: fresh });
      if (!result.ok) {
        setStatus(result.error ?? "Could not save.");
        return;
      }
      setSavedAt(new Date());
      setFresh({ slug: "", pageTitle: "", h1: "", subtitle: "", body: "", date: todayUtcDay() });
      setAdding(false);
      setOpen(fresh.slug);
      setDraft({ pageTitle: fresh.pageTitle, h1: fresh.h1, subtitle: fresh.subtitle, body: fresh.body, date: fresh.date });
      await reload();
    } catch {
      setStatus("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const current = articles?.find((article) => article.slug === open) ?? null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(null);
            setAdding(true);
            setStatus(null);
            setSavedAt(null);
          }}
        >
          New article
        </PrimaryButton>
        <SavedAt at={savedAt} />
        {status ? <p className="text-sm text-muted">{status}</p> : null}
      </div>

      {adding ? (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--color-border)]">
          <Field label="Slug" hint="Set once. Lowercase letters, numbers, and hyphens.">
            <TextInput
              value={fresh.slug}
              onChange={(e) => setFresh((row) => ({ ...row, slug: e.target.value }))}
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <ArticleFields
            pageTitle={fresh.pageTitle}
            h1={fresh.h1}
            subtitle={fresh.subtitle}
            body={fresh.body}
            onPageTitle={(pageTitle) => setFresh((row) => ({ ...row, pageTitle }))}
            onH1={(h1) => setFresh((row) => ({ ...row, h1 }))}
            onSubtitle={(subtitle) => setFresh((row) => ({ ...row, subtitle }))}
            onBody={(body) => setFresh((row) => ({ ...row, body }))}
            date={fresh.date}
            onDate={(date) => setFresh((row) => ({ ...row, date }))}
          />
          <PrimaryButton type="button" disabled={busy} onClick={() => void create()}>
            Save
          </PrimaryButton>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">H1</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {(articles ?? []).map((article) => (
              <tr key={article.slug} className="border-t border-border">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left font-medium text-fg underline underline-offset-4"
                    onClick={() => openRow(article)}
                  >
                    {article.h1}
                  </button>
                </td>
                <td className="px-4 py-3 text-muted">{article.slug}</td>
                <td className="px-4 py-3 text-muted">{articleDateLabel(article.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {current ? (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--color-border)]">
          <p className="text-sm text-muted">
            Slug <span className="text-fg">{current.slug}</span>
          </p>
          <ArticleFields
            pageTitle={draft.pageTitle}
            h1={draft.h1}
            subtitle={draft.subtitle}
            body={draft.body}
            onPageTitle={(pageTitle) => setDraft((row) => ({ ...row, pageTitle }))}
            onH1={(h1) => setDraft((row) => ({ ...row, h1 }))}
            onSubtitle={(subtitle) => setDraft((row) => ({ ...row, subtitle }))}
            onBody={(body) => setDraft((row) => ({ ...row, body }))}
            date={draft.date}
            onDate={(date) => setDraft((row) => ({ ...row, date }))}
          />
          <PrimaryButton type="button" disabled={busy} onClick={() => void saveOpen()}>
            Save
          </PrimaryButton>
        </div>
      ) : null}
    </section>
  );
}
