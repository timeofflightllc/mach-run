import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { betaPageFn } from "@/lib/beta/api";
import { downloadBetaPdf } from "@/lib/beta/pdf";
import type { BetaPage } from "@/lib/beta/form";

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

/** Card under Referrals. Hidden unless this email is invited. */
export function BetaAccountLink() {
  const [page, setPage] = useState<OpenPage | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

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
      <p className="font-display text-lg text-fg">Beta Testing Feedback / Debrief Form</p>
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
            const busy = downloading === row.id;
            return (
              <div key={row.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setDownloading(row.id);
                    void downloadBetaPdf({
                      name: row.answers.name,
                      email: row.answers.email || page.email,
                      pass,
                      submittedAt: row.submittedAt,
                      answers: row.answers,
                    }).finally(() => setDownloading(null));
                  }}
                  className="text-left text-sm text-fg underline underline-offset-4 disabled:opacity-60"
                >
                  {busy ? "Preparing PDF…" : `Pass ${pass} · ${when(row.submittedAt)} UTC`}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
