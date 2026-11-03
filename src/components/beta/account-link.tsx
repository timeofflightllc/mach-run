import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { betaPageFn } from "@/lib/beta/api";
import { BETA_SECTIONS, type BetaAnswers, type BetaPage } from "@/lib/beta/form";

type OpenPage = Extract<BetaPage, { open: true }>;

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

function line(label: string, value: string) {
  return (
    <p className="text-sm text-fg">
      <span className="text-muted">{label}: </span>
      {value.trim() || "—"}
    </p>
  );
}

function ReadOnlyDebrief({ answers }: { answers: BetaAnswers }) {
  return (
    <div className="space-y-5 border-t border-border pt-4">
      {BETA_SECTIONS.map((section) => {
        const answer = answers.sections[section.key];
        return (
          <div key={section.key} className="space-y-1">
            <p className="text-sm font-semibold text-fg">{section.title}</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{answer.notes.trim() || "—"}</p>
            <p className="text-sm text-muted">
              Continued in a separate writeup: {answer.continued ? "yes" : "no"}
            </p>
          </div>
        );
      })}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-fg">Thank-you gift</p>
        <p className="text-sm text-muted">Please do not send a hat: {answers.hat.decline ? "yes" : "no"}</p>
        {line("Full name", answers.hat.fullName)}
        {line("Street address (line 1)", answers.hat.line1)}
        {line("Street address (line 2)", answers.hat.line2)}
        {line("City", answers.hat.city)}
        {line("State", answers.hat.state)}
        {line("ZIP", answers.hat.zip)}
        {line("Country", answers.hat.country)}
        {line("Delivery notes", answers.hat.notes)}
      </div>
    </div>
  );
}

/** Card under Referrals. Hidden unless this email is invited. */
export function BetaAccountLink() {
  const [page, setPage] = useState<OpenPage | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void betaPageFn()
      .then((next) => {
        if (!live || !next.open) return;
        setPage(next);
      })
      .catch(() => {
        /* Not invited, or the check failed. Show nothing. */
      });
    return () => {
      live = false;
    };
  }, []);

  if (!page) return null;
  const atLimit = page.submittedCount >= page.limit;

  return (
    <section className="space-y-3 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
      <p className="font-display text-lg text-fg">Beta debrief</p>
      <p className="text-sm text-fg">
        {page.submittedCount} of {page.limit} submitted.
      </p>
      {atLimit ? (
        <p className="text-sm text-fg">You have used all {page.limit} debriefs.</p>
      ) : (
        <Link to="/beta" className="inline-flex text-sm font-medium text-fg underline underline-offset-4">
          File a debrief
        </Link>
      )}
      {page.submitted.length > 0 ? (
        <div className="space-y-2">
          {page.submitted.map((row, index) => {
            const pass = page.submitted.length - index;
            const open = openId === row.id;
            return (
              <div key={row.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : row.id)}
                  className="text-left text-sm text-fg underline underline-offset-4"
                >
                  Pass {pass} · {when(row.submittedAt)} UTC
                </button>
                {open ? <ReadOnlyDebrief answers={row.answers} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
