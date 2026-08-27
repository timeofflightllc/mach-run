import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { askMachOoda } from "@/lib/ooda-ai/api";
import { buildOodaAskContext } from "@/lib/ooda-ai/context";
import { MACH_MONTHLY_USD, MACH_YEARLY_USD } from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { PeerBrief } from "@/lib/plan/peers";
import type { Plan, SimResult } from "@/lib/plan/types";

type Turn = { q: string; a: string };

export function OodaAiCard({
  plan,
  sim,
  brief,
}: {
  plan: Plan;
  sim: SimResult;
  brief: PeerBrief | null;
}) {
  const ent = useEntitlement();
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const paid = Boolean(ent.paid);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    const q = question.trim();
    if (!q || busy || !paid) return;
    setBusy(true);
    setError(null);
    try {
      const history = turns
        .slice(-4)
        .map((t) => `Q: ${t.q}\nA: ${t.a}`)
        .join("\n\n");
      const result = await askMachOoda({
        data: {
          question: q,
          context: `${buildOodaAskContext(plan, sim, brief)}${
            history ? `\n\nEarlier OODA AI turns:\n${history}` : ""
          }`,
        },
      });
      if (result.ok) {
        setTurns((prev) => [...prev, { q, a: result.answer }]);
        setQuestion("");
      } else setError(result.error);
    } catch {
      setError("OODA AI could not complete that pass.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--color-border)]">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
        OODA AI*
      </p>
      <p className="mt-2 font-display text-lg text-fg">Ask about this analysis.</p>
      <p className="mt-1 text-sm text-muted">
        Unlimited only. Questions hit the MACH OODA Financial Analysis you just
        ran — runway, RMDs, a stage, whether the save rate is a joke.
      </p>
      {!paid ? (
        <div className="mt-4 flex flex-col items-start gap-2 border-t border-border pt-4">
          <p className="text-sm text-muted">
            OODA AI is on MACH Unlimited — ${MACH_MONTHLY_USD}/month or $
            {MACH_YEARLY_USD}/year.
          </p>
          <Link
            to={signedIn ? "/pricing" : "/login"}
            className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
          >
            {signedIn ? "Unlock OODA AI" : "Sign in, then go Unlimited"}
          </Link>
        </div>
      ) : (
        <>
          {turns.length ? (
            <div className="mt-4 flex flex-col gap-3">
              {turns.map((t, i) => (
                <div key={`${i}-${t.q.slice(0, 12)}`} className="space-y-1.5">
                  <p className="text-sm font-semibold text-fg">You: {t.q}</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                    {t.a}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void ask();
            }}
            rows={3}
            maxLength={600}
            placeholder="e.g. If I delay SS two years, does the runway actually move?"
            className="mt-4 w-full resize-y rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm text-fg outline-none placeholder:text-subtle focus:border-accent/40"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={busy || !question.trim()}
              onClick={() => void ask()}
              className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-50"
            >
              {busy ? "Briefing…" : "Ask OODA AI"}
            </button>
            <span className="text-xs text-subtle">Enter + ⌘ to send</span>
          </div>
          {error ? <p className="mt-4 text-sm text-negative">{error}</p> : null}
        </>
      )}
    </div>
  );
}
