import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { AuthSlot } from "@/components/meridian/auth-slot";
import { CalculateButton } from "@/components/meridian/calculate-button";
import { CashChart, WealthChart } from "@/components/meridian/charts";
import { ContributionForm } from "@/components/meridian/contribution-form";
import { HouseholdForm } from "@/components/meridian/household-form";
import { IncomeForm } from "@/components/meridian/income-form";
import { KpiStrip } from "@/components/meridian/kpi-strip";
import { PortfolioForm } from "@/components/meridian/portfolio-form";
import { PeerBriefCard } from "@/components/meridian/peer-brief";
import { OodaAiCard } from "@/components/meridian/ooda-ai";
import { Section } from "@/components/meridian/section";
import { SpendingForm } from "@/components/meridian/spending-form";
import { Verdict } from "@/components/meridian/verdict";
import { YearTable } from "@/components/meridian/year-table";
import { MachFooter, BrandLockup } from "@/components/meridian/mach-mark";
import { GuestOnly } from "@/lib/auth/gates";
import { simulate } from "@/lib/plan/engine";
import { buildPeerBrief, type PeerBrief } from "@/lib/plan/peers";
import { usePlanStore } from "@/lib/plan/store";
import { useCloudPlan } from "@/lib/plan/use-cloud-plan";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { getEntitlement } from "@/lib/billing/api";
import type { Plan, SimResult } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const LOOP = [
  { id: "ooda-observe", label: "Observe" },
  { id: "ooda-orient", label: "Orient" },
  { id: "ooda-decide", label: "Decide" },
  { id: "ooda-act", label: "Act" },
] as const;

function PhaseLabel({ id, label }: { id: string; label: string }) {
  return (
    <p
      id={id}
      className="scroll-mt-40 font-display text-lg font-semibold uppercase tracking-[0.18em] text-muted sm:text-xl"
    >
      {label}
    </p>
  );
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  let n: HTMLElement | null = el.parentElement;
  while (n && n !== document.body) {
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 4) {
      return n;
    }
    n = n.parentElement;
  }
  return null;
}

function jumpToPhase(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const header = document.getElementById("mach-header");
  const headerH =
    header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
  const gap = 16;
  const parent = scrollParent(el);
  if (parent) {
    const parentRect = parent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const pad = Math.max(gap, headerH - parentRect.top + gap);
    parent.scrollTo({
      top: Math.max(0, parent.scrollTop + (elRect.top - parentRect.top) - pad),
      behavior: "smooth",
    });
    return;
  }
  const y = window.scrollY + el.getBoundingClientRect().top - headerH - gap;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

function Home() {
  const plan = usePlanStore((s) => s.plan);
  const patchAssumptions = usePlanStore((s) => s.patchAssumptions);
  const reset = usePlanStore((s) => s.reset);
  const { status: saveStatus, saveNow } = useCloudPlan();
  const ent = useEntitlement();
  const [tab, setTab] = useState<"act" | "loop">("loop");
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [pendingPhase, setPendingPhase] = useState<string | null>(null);
  const [run, setRun] = useState<{
    id: number;
    plan: Plan;
    sim: SimResult;
    brief: PeerBrief;
  } | null>(null);

  useEffect(() => {
    void Promise.resolve(usePlanStore.persist.rehydrate());
  }, []);

  useEffect(() => {
    const header = document.getElementById("mach-header");
    if (!header || typeof ResizeObserver === "undefined") return;
    const sync = () => {
      try {
        const h = Math.ceil(header.getBoundingClientRect().height);
        const prev = document.documentElement.style.getPropertyValue("--mach-header-h");
        if (prev === `${h}px`) return;
        document.documentElement.style.setProperty("--mach-header-h", `${h}px`);
      } catch {
        /* ignore */
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!pendingPhase) return;
    if (pendingPhase === "ooda-act" && tab !== "act") return;
    if (pendingPhase !== "ooda-act" && tab !== "loop") return;
    const id = pendingPhase;
    const t = window.setTimeout(() => {
      jumpToPhase(id);
      setPendingPhase(null);
    }, 40);
    return () => window.clearTimeout(t);
  }, [pendingPhase, tab]);

  const displayPlan = run
    ? {
        ...run.plan,
        assumptions: { ...run.plan.assumptions, dollars: plan.assumptions.dollars },
      }
    : plan;
  const sim = run?.sim;
  const real = plan.assumptions.dollars === "real";

  useEffect(() => {
    if (!ent.paid) return;
    setRun((prev) => {
      if (!prev?.brief || prev.brief.expanded) return prev;
      return { ...prev, brief: { ...prev.brief, expanded: true } };
    });
  }, [ent.paid]);

  async function calculate(opts?: { stay?: boolean }) {
    try {
      let paid = Boolean(ent.paid);
      try {
        const liveEnt = await getEntitlement();
        paid = Boolean(liveEnt.paid);
      } catch {
        /* keep hook entitlement */
      }
      const live = usePlanStore.getState().plan;
      const snapshot = structuredClone(live) as Plan;
      const nextSim = simulate(snapshot);
      const brief = buildPeerBrief(snapshot, nextSim, { expanded: paid });
      setRun({
        id: Date.now(),
        plan: snapshot,
        sim: { ...nextSim, months: [] },
        brief,
      });
      void saveNow(snapshot);
      setTab("act");
      if (!opts?.stay) setPendingPhase("ooda-act");
    } catch (err) {
      console.error("MACH Run calculate failed", err);
    }
  }

  function handleReset() {
    reset();
    setRun(null);
  }

  function goPhase(id: string) {
    setActivePhase(id);
    setTab(id === "ooda-act" ? "act" : "loop");
    setPendingPhase(id);
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header
        id="mach-header"
        className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-sm"
      >
        <div className="relative z-50 mx-auto max-w-[1400px] px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <BrandLockup />
              <p className="hidden truncate text-xs text-subtle sm:block">
                The Supersonic Financial Calculator
              </p>
            </div>
            <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
              <div className="hidden rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--color-border)] md:flex">
                <button
                  type="button"
                  aria-pressed={real}
                  onClick={() => patchAssumptions({ dollars: "real" })}
                  className={cn(
                    "relative z-30 h-9 rounded-md px-3 text-xs font-medium transition-colors",
                    real ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
                  )}
                >
                  Today $
                </button>
                <button
                  type="button"
                  aria-pressed={!real}
                  onClick={() => patchAssumptions({ dollars: "nominal" })}
                  className={cn(
                    "relative z-30 h-9 rounded-md px-3 text-xs font-medium",
                    !real ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
                  )}
                >
                  Future $
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleReset()}
                className="hidden h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted hover:bg-surface hover:text-fg md:inline-flex"
              >
                <RotateCcw className="size-3.5" />
                Reset baseline
              </button>
              <AuthSlot saved={saveStatus} />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 md:hidden">
            <div className="flex min-w-0 flex-1 rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--color-border)]">
              <button
                type="button"
                aria-pressed={real}
                onClick={() => patchAssumptions({ dollars: "real" })}
                className={cn(
                  "h-9 flex-1 rounded-md px-2 text-xs font-medium",
                  real ? "bg-accent text-accent-fg" : "text-muted",
                )}
              >
                Today $
              </button>
              <button
                type="button"
                aria-pressed={!real}
                onClick={() => patchAssumptions({ dollars: "nominal" })}
                className={cn(
                  "h-9 flex-1 rounded-md px-2 text-xs font-medium",
                  !real ? "bg-accent text-accent-fg" : "text-muted",
                )}
              >
                Future $
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleReset()}
              aria-label="Reset baseline"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>
        <nav
          aria-label="OODA loop"
          className="mx-auto flex max-w-[1400px] items-center justify-center gap-1 overflow-x-auto px-4 pb-3 sm:px-6"
        >
          {LOOP.map((phase, i) => (
            <span key={phase.id} className="flex items-center gap-1">
              {i > 0 ? (
                <span className="px-1 text-xs text-subtle" aria-hidden>
                  ·
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => goPhase(phase.id)}
                className={cn(
                  "relative z-30 inline-flex h-9 items-center px-1.5 text-xs font-medium uppercase tracking-[0.16em] underline-offset-[5px]",
                  activePhase === phase.id
                    ? "text-fg underline decoration-fg"
                    : "text-fg/85 underline decoration-fg/40 hover:text-fg hover:decoration-fg",
                )}
              >
                {phase.label}
              </button>
            </span>
          ))}
        </nav>
        <div className="mx-auto flex max-w-[1400px] gap-1 px-4 pb-3 lg:hidden">
          <button
            type="button"
            onClick={() => setTab("loop")}
            className={cn(
              "h-11 flex-1 rounded-lg text-sm font-medium",
              tab === "loop" ? "bg-surface text-fg" : "text-muted",
            )}
          >
            OODA
          </button>
          <button
            type="button"
            onClick={() => setTab("act")}
            className={cn(
              "h-11 flex-1 rounded-lg text-sm font-medium",
              tab === "act" ? "bg-surface text-fg" : "text-muted",
            )}
          >
            Act
          </button>
        </div>
        <GuestOnly>
          <div className="border-t border-[#5c4a18] bg-[#241c0c]">
            <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-1.5 px-4 py-2.5 text-center sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-3 sm:px-6">
              <span className="master-caution-lamp inline-flex shrink-0 items-center rounded-sm bg-[#e8c547] px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1a1408]">
                Master Caution
              </span>
              <p className="max-w-xl text-xs leading-relaxed text-[#ead9a0]">
                Your MACH RUN information is not saved until you create an
                account.{" "}
                <Link
                  to="/login"
                  className="font-medium text-[#f6e7b0] underline decoration-[#e8c547]/80 underline-offset-[3px] hover:text-[#fff3c4]"
                >
                  Create a free account in 30 seconds
                </Link>
                .
              </p>
            </div>
          </div>
        </GuestOnly>
      </header>

      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)] lg:items-start">
        <aside
          className={cn(
            "flex flex-col gap-6 lg:sticky lg:top-[var(--mach-header-h,7rem)] lg:max-h-[calc(100vh-var(--mach-header-h,7rem))] lg:overflow-y-auto lg:pr-1",
            tab === "act" ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="flex flex-col gap-3">
            <PhaseLabel id="ooda-observe" label="Observe" />
            <Section
              title="Family"
              hint="Names, birthdays — the household as it stands"
              defaultOpen={false}
            >
              <HouseholdForm />
            </Section>
            <Section
              title="Accounts"
              hint="Your financial lowdown — current accounts and balances"
              defaultOpen={false}
            >
              <PortfolioForm />
            </Section>
            <CalculateButton onCalculate={calculate} />
          </div>
          <div className="flex flex-col gap-3">
            <PhaseLabel id="ooda-orient" label="Orient" />
            <Section
              title="Income"
              hint="Name it, amount, start, end — add another for the next paycheck"
            >
              <IncomeForm />
            </Section>
            <Section
              title="Spending"
              hint="What the household actually costs"
              defaultOpen={false}
            >
              <SpendingForm />
            </Section>
            <CalculateButton onCalculate={calculate} />
          </div>
          <div className="flex flex-col gap-3">
            <PhaseLabel id="ooda-decide" label="Decide" />
            <Section
              title="Contributions"
              hint="Change monthly amounts at any date"
            >
              <ContributionForm />
            </Section>
            <CalculateButton onCalculate={calculate} />
          </div>
        </aside>

        <div
          className={cn(
            "flex min-w-0 flex-col gap-4",
            tab === "loop" ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <PhaseLabel id="ooda-act" label="Act" />
            <button
              type="button"
              onClick={() => calculate({ stay: true })}
              className="inline-flex h-9 shrink-0 items-center rounded-lg bg-accent px-3 text-xs font-medium text-accent-fg hover:opacity-90"
            >
              Calculate
            </button>
          </div>
          {sim ? (
            <>
              {!ent.paid ? (
                <div className="flex flex-col gap-3 rounded-xl bg-elevated px-5 py-4 shadow-[0_0_0_1px_var(--color-border)] sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-relaxed text-muted">
                    This MACH Run is on Free. Unlimited opens every account,
                    every stage, the full OODA, and OODA AI.
                  </p>
                  <Link
                    to="/pricing"
                    className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
                  >
                    Upgrade to MACH Run Unlimited
                  </Link>
                </div>
              ) : null}
              <Verdict plan={displayPlan} sim={sim} />
              <KpiStrip plan={displayPlan} sim={sim} />
              <PeerBriefCard
                key={run?.id ?? "idle"}
                brief={run?.brief ?? null}
                ran
                plan={displayPlan}
                sim={sim}
              />
              <OodaAiCard
                plan={displayPlan}
                sim={sim}
                brief={run?.brief ?? null}
              />
              <WealthChart plan={displayPlan} sim={sim} />
              <CashChart plan={displayPlan} sim={sim} />
              <YearTable plan={displayPlan} sim={sim} />
            </>
          ) : (
            <div className="rounded-xl bg-surface px-5 py-8 shadow-[0_0_0_1px_var(--color-border)]">
              <p className="font-display text-xl text-fg">No MACH Run yet.</p>
              <p className="mt-2 max-w-xl text-sm text-muted">
                Complete Observe, Orient, and Decide to begin your financial
                MACH Run. Hit Calculate at the bottom of any of those sections
                to bust the MACH RUN and Act with financial purpose.
              </p>
            </div>
          )}
        </div>
      </main>
      <MachFooter />
    </div>
  );
}
