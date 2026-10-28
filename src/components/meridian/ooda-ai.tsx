import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { askMachOoda } from "@/lib/ooda-ai/api";
import { buildOodaAskContext, type OodaSurvivalFact } from "@/lib/ooda-ai/context";
import { readMachBackFact, subscribeMachBackFact } from "@/lib/ooda-ai/page-facts";
import { spendingWhatIf, spendingWhatIfContext } from "@/lib/ooda-ai/spending-what-if";
import { usd } from "@/lib/plan/format";
import { MACH_MONTHLY_USD, MACH_YEARLY_USD } from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { OODA_DISCLAIMER } from "@/lib/plan/disclaimer";
import type { PeerBrief } from "@/lib/plan/peers";
import type { Plan, SimResult } from "@/lib/plan/types";

type Turn = { q: string; a: string | null };

function SpendingWhatIf({
  plan,
  busy,
  onAsk,
}: {
  plan: Plan;
  busy: boolean;
  onAsk: (question: string, context: string) => void;
}) {
  function run(delta: number) {
    const result = spendingWhatIf(plan, delta);
    const amount = usd(Math.abs(delta));
    const question = delta < 0 ? `What if I invest ${amount} less a month?` : `What if I invest ${amount} more a month?`;
    onAsk(question, spendingWhatIfContext(result));
  }
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-subtle">Invest</p>
      <div className="mt-1.5 inline-flex gap-1 rounded-xl bg-[#f3f0e8] p-1" role="group" aria-label="Invest">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(-500)}
          className="h-8 rounded-lg px-2.5 text-xs font-medium text-[#1a2330] hover:bg-white disabled:opacity-50"
        >
          Invest $500 less
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(500)}
          className="h-8 rounded-lg px-2.5 text-xs font-medium text-[#1a2330] hover:bg-white disabled:opacity-50"
        >
          Invest $500 more
        </button>
      </div>
    </div>
  );
}

function StarterQuestions({
  busy,
  onAsk,
  showSurvival,
  showAccounts,
  showMachBack,
}: {
  busy: boolean;
  onAsk: (question: string) => void;
  showSurvival: boolean;
  showAccounts: boolean;
  showMachBack: boolean;
}) {
  const questions = [
    showSurvival ? "What is the chance of success on this run?" : null,
    showAccounts ? "Which account is the largest?" : null,
    showMachBack ? "What did Mach Back say?" : null,
  ].filter((question): question is string => question != null);
  if (!questions.length) return null;
  return (
    <div className="mt-3 flex flex-col items-end gap-1.5">
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          disabled={busy}
          onClick={() => onAsk(question)}
          className="max-w-[85%] rounded-2xl rounded-br-md bg-[#7eb6ea] px-3.5 py-2 text-left text-sm leading-snug text-[#1a2330] disabled:opacity-50"
        >
          {question}
        </button>
      ))}
    </div>
  );
}

function Disclaimer() {
  return <p className="text-[10px] italic leading-snug text-subtle">{OODA_DISCLAIMER}</p>;
}

export function OodaAiCard({
  plan,
  sim,
  brief,
  survival = null,
}: {
  plan: Plan;
  sim: SimResult;
  brief: PeerBrief | null;
  survival?: OodaSurvivalFact | null;
}) {
  const ent = useEntitlement();
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const paid = Boolean(ent.paid);
  const machBack = useSyncExternalStore(subscribeMachBackFact, readMachBackFact, () => null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [turns]);

  async function ask(text?: string, contextOverride?: string) {
    const q = (text ?? question).trim();
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
      const context =
        contextOverride ??
        `${buildOodaAskContext(plan, sim, brief, {
          survival,
          machBack: readMachBackFact(),
        })}${history ? `\n\nEarlier OODA AI turns:\n${history}` : ""}`;
      const result = await askMachOoda({
        data: {
          question: q,
          context,
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
    <div className="rounded-xl bg-surface px-5 py-5">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
        OODA AI*
      </p>
      <p className="mt-2 font-display text-xl font-bold text-fg">
        Ask OODA AI about this MACH RUN:
      </p>
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
          <div
            ref={threadRef}
            className="mt-3 flex h-80 flex-col gap-2 overflow-y-auto rounded-2xl bg-[#f4f1ea] px-3 py-3"
            aria-live="polite"
          >
            {turns.length ? (
              turns.map((t, i) => (
                <div key={`${i}-${t.q.slice(0, 24)}`} className="flex flex-col gap-2">
                  <div className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#7eb6ea] px-3.5 py-2 text-sm leading-relaxed text-[#1a2330]">
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
              ))
            ) : (
              <p className="text-sm text-subtle">Ask about this MACH RUN.</p>
            )}
          </div>
          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask();
                }
              }}
              rows={2}
              maxLength={600}
              placeholder="e.g. If I delay SS two years, does the runway actually move?"
              className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm text-fg outline-none placeholder:text-subtle focus:border-accent/40"
            />
            <button
              type="button"
              aria-label="Send"
              disabled={busy || !question.trim()}
              onClick={() => void ask()}
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7eb6ea] text-[#1a2330] disabled:bg-[#d5d0c6] disabled:text-[#6b7280]"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                <path
                  d="M12 19V5M6 11l6-6 6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <StarterQuestions
            busy={busy}
            onAsk={(q) => void ask(q)}
            showSurvival={survival != null && Number.isFinite(survival.score)}
            showAccounts={plan.portfolios.length > 0}
            showMachBack={machBack != null}
          />
          <SpendingWhatIf busy={busy} onAsk={(q, context) => void ask(q, context)} plan={plan} />
          {error ? <p className="mt-4 text-sm text-negative">{error}</p> : null}
        </>
      )}
      <div className="mt-4 border-t border-border pt-2">
        <Disclaimer />
      </div>
    </div>
  );
}