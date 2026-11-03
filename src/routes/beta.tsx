import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { DebriefForm } from "@/components/beta/debrief-form";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { RedirectToSignIn, isRealUser } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { betaPageFn, saveBetaDraftFn, submitBetaFn } from "@/lib/beta/api";
import { emptyAnswers, hatMissing, todayIso, type BetaAnswers, type BetaPage } from "@/lib/beta/form";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/beta")({
  head: () =>
    pageHead({
      title: "Beta Testing Feedback / Debrief Form | MACH RUN",
      description: "A private debrief for invited MACH RUN beta testers.",
      path: "/beta",
      noindex: true,
    }),
  component: BetaPageView,
});

function formAnswers(next: Extract<BetaPage, { open: true }>, keep?: BetaAnswers): BetaAnswers {
  if (keep) return keep;
  if (next.draft) return next.draft;
  const blank = emptyAnswers(todayIso());
  if (next.knownHat) blank.hat = next.knownHat;
  return blank;
}

function submittedDate(iso: string): string {
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

function BetaPageView() {
  const { user, isPending } = useCurrentUserState();
  const [page, setPage] = useState<BetaPage | null>(null);
  const [answers, setAnswers] = useState<BetaAnswers>(() => emptyAnswers(todayIso()));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!isRealUser(user)) return;
    let live = true;
    void betaPageFn()
      .then((next) => {
        if (!live) return;
        setPage(next);
        if (next.open) setAnswers(formAnswers(next));
      })
      .catch(() => {
        if (live) setError("The debrief is unavailable.");
      });
    return () => {
      live = false;
    };
  }, [user]);

  async function reload(nextAnswers?: BetaAnswers) {
    const next = await betaPageFn();
    setPage(next);
    if (next.open) setAnswers(formAnswers(next, nextAnswers));
  }

  async function onDraft() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("draft");
    setError(null);
    setNote(null);
    try {
      const result = await saveBetaDraftFn({ data: answers });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await reload(answers);
      setNote("Draft saved.");
    } catch {
      setError("The draft did not save.");
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function onSubmit() {
    if (busyRef.current) return;
    busyRef.current = true;
    if (hatMissing(answers)) {
      busyRef.current = false;
      setError("A mailing address is required, or check “Please do not send a hat.”");
      setNote(null);
      return;
    }
    setBusy("submit");
    setError(null);
    setNote(null);
    try {
      const result = await submitBetaFn({ data: answers });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await reload();
      setNote("Submitted.");
    } catch {
      setError("The debrief did not submit.");
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  if (isPending && !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg text-muted">
        Loading…
      </main>
    );
  }
  if (!isPending && !isRealUser(user)) return <RedirectToSignIn />;

  const open = page?.open === true;
  const atLimit = open && page.submittedCount >= page.limit;

  return (
    <main className="box-border min-h-screen w-screen max-w-[100vw] bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            Fighter pilot debrief
          </p>
          <h1 className="mt-2 font-display text-4xl text-fg">Beta Testing Feedback / Debrief Form</h1>
        </header>

        {page == null && !error ? <p className="text-sm text-muted">Loading…</p> : null}
        {error ? <p className="text-sm text-negative">{error}</p> : null}
        {note ? <p className="text-sm text-fg">{note}</p> : null}

        {page && !page.open ? (
          <p className="text-base text-fg">This debrief is not open for this account.</p>
        ) : null}

        {open ? (
          <>
            <p className="text-sm font-medium text-fg">
              {page.submittedCount} of {page.limit} submitted.
            </p>

            {atLimit ? (
              <p className="text-base text-fg">
                You have used all {page.limit} debriefs. Ask MACH RUN if you need another pass.
              </p>
            ) : (
              <section className="w-full space-y-6 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)] sm:p-6">
                <DebriefForm
                  answers={answers}
                  email={page.email}
                  addressOnFile={page.knownHat != null}
                  onChange={setAnswers}
                  busy={busy}
                  onDraft={() => void onDraft()}
                  onSubmit={() => void onSubmit()}
                />
              </section>
            )}

            {page.submitted.length > 0 ? (
              <section className="space-y-4">
                <h2 className="font-display text-2xl text-fg">Submitted</h2>
                {page.submitted.map((row) => (
                  <article
                    key={row.id}
                    className="w-full space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)] sm:p-6"
                  >
                    <p className="text-sm font-medium text-fg">Submitted {submittedDate(row.submittedAt)} UTC</p>
                    <DebriefForm answers={row.answers} email={row.answers.email || page.email} readOnly />
                  </article>
                ))}
              </section>
            ) : null}

            <p className="text-xs leading-relaxed text-muted">
              MACH RUN is a household calculator and planning sketch, not financial, tax, legal, or investment advice. Always confirm important numbers with the relevant agency or a qualified professional.
            </p>
          </>
        ) : null}
      </div>
      <MachFooter staticInset />
    </main>
  );
}
