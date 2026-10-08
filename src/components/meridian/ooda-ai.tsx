import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { askMachOoda } from "@/lib/ooda-ai/api";
import { buildOodaAskContext } from "@/lib/ooda-ai/context";
import { MACH_MONTHLY_USD, MACH_YEARLY_USD } from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { OODA_DISCLAIMER } from "@/lib/plan/disclaimer";
import type { PeerBrief } from "@/lib/plan/peers";
import type { Plan, SimResult } from "@/lib/plan/types";

type Turn = { q: string; a: string | null };

function Disclaimer() {
  return <p className="text-xs italic leading-relaxed text-subtle">{OODA_DISCLAIMER}</p>;
}

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
    const prior = turns;
    setBusy(true);
    setError(null);
    setQuestion("");
    setTurns((prev) => [...prev, { q, a: null }]);
    try {
      const history = prior
        .slice(-4)
        .filter((t) => t.a)
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
        setTurns((prev) =>
          prev.map((turn, index) =>
            index === prev.length - 1 && turn.q === q && turn.a == null
              ? { q, a: result.answer }
              : turn,
          ),
        );
      } else {
        setTurns((prev) => prev.filter((turn, index) => !(index === prev.length - 1 && turn.a == null)));
        setQuestion(q);
        setError(result.error);
      }
    } catch {
      setTurns((prev) => prev.filter((turn, index) => !(index === prev.length - 1 && turn.a == null)));
      setQuestion(q);
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
      <p className="mt-2 font-display text-xl font-bold text-fg">
        Ask OODA AI about this MACH RUN:
      </p>
      <div className="mt-3">
        <Disclaimer />
      </div>
      {!paid ? (
        <div className="mt-4 flex flex-col items-start gap-2 border-t border-border pt-4">
          {!signedIn ? (
            <>
              <p className="text-sm text-muted">
                OODA AI is on MACH RUN Unlimited — ${MACH_MONTHLY_USD}/month or $
                {MACH_YEARLY_USD}/year.
              </p>
              <Link
                to="/login"
                className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
              >
                Sign in, then go Unlimited
              </Link>
            </>
          ) : (
            <Link
              to="/pricing"
              className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
            >
              Unlock OODA AI
            </Link>
          )}
        </div>
      ) : (
        <>
          {turns.length ? (
            <div className="mt-4 flex max-h-[min(24rem,50vh)] flex-col gap-2 overflow-y-auto pr-1">
              {turns.map((t, i) => (
                <div key={`${i}-${t.q.slice(0, 24)}`} className="flex flex-col gap-2">
                  <div className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-canopy px-3.5 py-2 text-sm leading-relaxed text-white">
                      {t.q}
                    </p>
                  </div>
                  {t.a ? (
                    <div className="flex justify-start">
                      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-sm leading-relaxed text-slate-800 shadow-[0_0_0_1px_#e2e8f0]">
                        {t.a}
                      </p>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <p className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm tracking-widest text-slate-400 shadow-[0_0_0_1px_#e2e8f0]">
                        ···
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
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
            <span className="text-xs text-subtle">Enter to send</span>
          </div>
          {error ? <p className="mt-4 text-sm text-negative">{error}</p> : null}
        </>
      )}
    </div>
  );
}