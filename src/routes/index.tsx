import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthSlot } from "@/components/meridian/auth-slot";
import { ProfileSwitcher } from "@/components/meridian/profile-switcher";
import { MACH_RESET_BASELINE } from "@/components/meridian/account-menu";
import { CalculateButton } from "@/components/meridian/calculate-button";
import { CashChart, NetWorthChart, WealthChart } from "@/components/meridian/charts";
import { Pinnable, useChartPins } from "@/components/meridian/chart-pin";
import { ContributionForm } from "@/components/meridian/contribution-form";
import { HouseholdForm } from "@/components/meridian/household-form";
import { IncomeForm } from "@/components/meridian/income-form";
import { KpiStrip } from "@/components/meridian/kpi-strip";
import { PortfolioForm } from "@/components/meridian/portfolio-form";
import { LiabilityForm } from "@/components/meridian/liability-form";
import { PeerBriefCard } from "@/components/meridian/peer-brief";
import { OodaAiCard } from "@/components/meridian/ooda-ai";
import { Section, SectionFoldToggle } from "@/components/meridian/section";
import { SpendingForm } from "@/components/meridian/spending-form";
import { Verdict } from "@/components/meridian/verdict";
import { YearTable } from "@/components/meridian/year-table";
import { MachFooter, BrandLockup } from "@/components/meridian/mach-mark";
import { GuestOnly } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { simulate } from "@/lib/plan/engine";
import { buildPeerBrief, type PeerBrief } from "@/lib/plan/peers";
import { usePlanStore } from "@/lib/plan/store";
import { MACH_PROFILE_REMOVED, useProfileStore } from "@/lib/plan/profile-store";
import { useCloudPlan } from "@/lib/plan/use-cloud-plan";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { hasBalanceSheet } from "@/lib/billing/limits";
import { getEntitlement } from "@/lib/billing/api";
import type { Plan, SimResult } from "@/lib/plan/types";
import {
  clearAllStoredRuns,
  clearStoredRun,
  loadStoredRuns,
  saveStoredRun,
} from "@/lib/plan/last-run";
import { cn } from "@/lib/utils";
import { WelcomeEmailPreviewOverlay } from "@/components/meridian/welcome-email-preview";
import { EmailVerifyBanner } from "@/components/meridian/email-verify-banner";

export const Route = createFileRoute("/")({ component: Home });

function ActChartColumn({ plan, sim }: { plan: Plan; sim: SimResult }) {
  const pins = useChartPins();
  const ent = useEntitlement();
  const unlocked = hasBalanceSheet(ent.plan);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div ref={pins.wealthSlot}>
        <Pinnable pinned={pins.pinWealth} stackTop={pins.wealthTop}>
          <WealthChart
            plan={plan}
            sim={sim}
            pinned={pins.pinWealth}
            onPin={pins.toggleWealth}
          />
        </Pinnable>
      </div>
      <Pinnable pinned={pins.pinCash} stackTop={pins.cashTop}>
        <CashChart
          plan={plan}
          sim={sim}
          pinned={pins.pinCash}
          onPin={pins.toggleCash}
        />
      </Pinnable>
      <NetWorthChart
        plan={plan}
        sim={sim}
        locked={!unlocked}
      />
    </div>
  );
}

const LOOP = [
  { id: "ooda-observe", label: "Observe" },
  { id: "ooda-orient", label: "Orient" },
  { id: "ooda-decide", label: "Decide" },
  { id: "ooda-act", label: "Act" },
] as const;

function PhaseLabel({
  id,
  label,
  className,
}: {
  id: string;
  label: string;
  className?: string;
}) {
  return (
    <p
      id={id}
      className={cn(
        "scroll-mt-40 font-display text-lg font-semibold uppercase tracking-[0.18em] text-muted sm:text-xl",
        className,
      )}
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
  const { status: saveStatus, saveNow } = useCloudPlan();
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user?.id);
  const ent = useEntitlement();
  const [tab, setTab] = useState<"act" | "loop">("loop");
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [pendingPhase, setPendingPhase] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const activeProfileId = useProfileStore((s) => s.activeId);
  const runKey = activeProfileId || "local";
  const [runs, setRuns] = useState<
    Record<
      string,
      {
        id: number;
        plan: Plan;
        sim: SimResult;
        brief: PeerBrief;
      }
    >
  >({});
  const run = runs[runKey] ?? null;

  useEffect(() => {
    if (isPending) return;
    if (!signedIn) {
      setRuns({});
      return;
    }
    const stored = loadStoredRuns();
    const next: Record<
      string,
      { id: number; plan: Plan; sim: SimResult; brief: PeerBrief }
    > = {};
    for (const [key, row] of Object.entries(stored)) {
      try {
        const sim = simulate(row.plan);
        next[key] = {
          id: row.id,
          plan: row.plan,
          sim: { ...sim, months: [] },
          brief: buildPeerBrief(row.plan, sim, { expanded: false }),
        };
      } catch {
        /* skip a bad snapshot */
      }
    }
    setRuns(next);
  }, [isPending, signedIn]);

  useEffect(() => {
    function onReset() {
      setRuns({});
      setRunError(null);
      clearAllStoredRuns();
    }
    window.addEventListener(MACH_RESET_BASELINE, onReset);
    function onRemoved(ev: Event) {
      const id = (ev as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      setRuns((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      clearStoredRun(id);
    }
    window.addEventListener(MACH_PROFILE_REMOVED, onRemoved);
    return () => {
      window.removeEventListener(MACH_RESET_BASELINE, onReset);
      window.removeEventListener(MACH_PROFILE_REMOVED, onRemoved);
    };
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
    setRunError(null);
  }, [runKey]);

  useEffect(() => {
    if (!ent.paid) return;
    setRuns((prev) => {
      const cur = prev[runKey];
      if (!cur?.brief || cur.brief.expanded) return prev;
      return { ...prev, [runKey]: { ...cur, brief: { ...cur.brief, expanded: true } } };
    });
  }, [ent.paid, runKey]);

  async function calculate(opts?: { stay?: boolean }) {
    try {
      setRunError(null);
      const live = usePlanStore.getState().plan;
      const key = useProfileStore.getState().activeId || "local";
      useProfileStore.getState().snapshotCurrent(live);
      const snapshot = structuredClone(live) as Plan;
      const nextSim = simulate(snapshot);
      const brief = buildPeerBrief(snapshot, nextSim, { expanded: Boolean(ent.paid) });
      const runId = Date.now();
      setRuns((prev) => ({
        ...prev,
        [key]: {
          id: runId,
          plan: snapshot,
          sim: { ...nextSim, months: [] },
          brief,
        },
      }));
      saveStoredRun(key, { id: runId, plan: snapshot });
      setTab("act");
      if (!opts?.stay) setPendingPhase("ooda-act");
      void saveNow(snapshot);
      try {
        const { pingActivity } = await import("@/lib/ops/activity-api");
        const { shapeFromPlan } = await import("@/lib/ops/activity");
        const profiles = useProfileStore.getState().profiles.length || 1;
        pingActivity("calculate", shapeFromPlan(snapshot, profiles));
      } catch {
        /* activity is optional */
      }
      void getEntitlement()
        .then((liveEnt) => {
          if (!liveEnt?.paid) return;
          const expanded = buildPeerBrief(snapshot, nextSim, { expanded: true });
          setRuns((prev) => {
            const cur = prev[key];
            if (!cur?.brief || cur.brief.expanded) return prev;
            return { ...prev, [key]: { ...cur, brief: expanded } };
          });
        })
        .catch(() => {
          /* keep hook entitlement */
        });
    } catch (err) {
      console.error("MACH Run calculate failed", err);
      setRunError(
        err instanceof Error ? err.message : "Calculate failed. Check the numbers and try again.",
      );
    }
  }

  function goPhase(id: string) {
    setActivePhase(id);
    setTab(id === "ooda-act" ? "act" : "loop");
    setPendingPhase(id);
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <WelcomeEmailPreviewOverlay />
      <header
        id="mach-header"
        className="sticky top-0 z-30 border-b border-border"
        style={{ backgroundColor: "#0a1835" }}
      >
        <div className="page-gutter relative z-50 mx-auto max-w-none py-2.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <div className="min-w-0">
              <BrandLockup showTagline={false} />
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1.5">
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
              <ProfileSwitcher ent={ent} />
              <AuthSlot saved={saveStatus} />
            </div>
            <p className="min-w-0 text-left text-[11px] font-bold leading-snug tracking-[0.12em] text-muted sm:text-xs md:text-[13px]">
              The Supersonic Retirement Calculator
            </p>
            <div className="flex justify-end md:hidden">
              <div className="inline-flex rounded-md bg-surface p-0.5 shadow-[0_0_0_1px_var(--color-border)]">
                <button
                  type="button"
                  aria-pressed={real}
                  onClick={() => patchAssumptions({ dollars: "real" })}
                  className={cn(
                    "h-6 rounded px-1.5 text-[10px] font-medium leading-none",
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
                    "h-6 rounded px-1.5 text-[10px] font-medium leading-none",
                    !real ? "bg-accent text-accent-fg" : "text-muted",
                  )}
                >
                  Future $
                </button>
              </div>
            </div>
          </div>
        </div>
        <nav
          aria-label="OODA loop"
          className="page-gutter mx-auto flex max-w-none items-center justify-center gap-1 overflow-x-auto pb-3"
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
        <GuestOnly>
          <div
            className="border-t py-2.5 text-center"
            style={{
              background: "var(--color-section-lift)",
              borderColor: "var(--color-section-lift-border)",
            }}
          >
            <p className="page-gutter mx-auto max-w-none text-sm font-bold leading-relaxed text-[#c5e0cc]">
              Get started — open Family, then Accounts. Continue down the
              inputs and complete your first OODA Loop with Calculate.
              <br />
              That’s a MACH RUN.
            </p>
          </div>
          <div className="border-t border-[#5c4a18] bg-[#241c0c]">
            <div className="page-gutter mx-auto flex max-w-none flex-col items-center gap-1.5 py-2.5 text-center sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-3">
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
        <EmailVerifyBanner />
      </header>

      <main className="page-gutter mx-auto grid max-w-none grid-cols-1 gap-5 py-5 lg:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)] lg:items-start">
        <aside
          className={cn(
            "flex flex-col gap-6 lg:sticky lg:top-[var(--mach-header-h,7rem)] lg:max-h-[calc(100vh-var(--mach-header-h,7rem))] lg:overflow-y-auto lg:pr-1",
            tab === "act" ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <PhaseLabel id="ooda-observe" label="Observe" />
              <SectionFoldToggle />
            </div>
            <Section
              title="Family"
              hint="Names and birthdays, retirement goal date and nest egg amount, and what to do with leftover dollars after income minus spending (a.k.a. “sweep”)."
              defaultOpen={false}
            >
              <HouseholdForm />
            </Section>
            <Section
              title="Accounts - Assets"
              hint="Your financial lowdown — add your accounts, update balances, define account types, set as spendable and decide to include in net worth."
              defaultOpen={false}
            >
              <PortfolioForm />
            </Section>
            {hasBalanceSheet(ent.plan) ? (
              <Section
                title="Accounts - Liabilities"
                hint="Car, student, HELOC, personal, credit card. Remaining principal comes off net worth. House mortgages stay on the real estate account."
                defaultOpen={false}
              >
                <LiabilityForm />
              </Section>
            ) : null}
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
              hint="Set specific monthly expected spending here. Do not include spending from investments or contributions to accounts you have listed above — those will be set below in Contributions."
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
              hint="Set your monthly contributions to the accounts created above. Different rules apply for different types of accounts, so ensure the “kind” of account is correctly set above."
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
          {runError ? (
            <p className="text-sm text-[#e8c547]">{runError}</p>
          ) : null}
          {sim ? (
            <div className="flex flex-col gap-4">
              {!ent.paid ? (
                <div
                  className="flex flex-col gap-3 rounded-xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    background: "var(--color-section)",
                    boxShadow: "0 0 0 1px var(--color-section-border)",
                  }}
                >
                  <p className="text-sm leading-relaxed text-[#c5e0cc]">
                    This MACH Run is on Free. Upgrade to open more features
                    including accounts, incomes, the full OODA Analysis and
                    OODA AI.
                  </p>
                  <Link
                    to="/pricing"
                    className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-medium"
                    style={{
                      background: "var(--color-section-lift)",
                      color: "#d7f0de",
                      boxShadow: "0 0 0 1px var(--color-section-lift-border)",
                    }}
                  >
                    Upgrade to MACH Run Unlimited
                  </Link>
                </div>
              ) : null}
              <div className="@container">
                <div className="grid grid-cols-1 gap-4 @min-[64rem]:grid-cols-[minmax(0,1.15fr)_minmax(24rem,1fr)] @min-[64rem]:items-start">
                  <div className="flex min-w-0 flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 @min-[36rem]:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-3">
                        <PhaseLabel id="ooda-act" label="Act" />
                        <Verdict
                          plan={displayPlan}
                          sim={sim}
                          brief={run?.brief ?? null}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex min-h-11 items-center justify-center">
                          <CalculateButton
                            onCalculate={() => calculate({ stay: true })}
                            className="h-9 w-auto min-w-[6.8rem] px-5 text-sm"
                          />
                        </div>
                        <KpiStrip plan={displayPlan} sim={sim} />
                      </div>
                    </div>
                    <PeerBriefCard
                      key={run?.id ?? "idle"}
                      brief={run?.brief ?? null}
                      ran
                      plan={displayPlan}
                      sim={sim}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-4">
                    <PhaseLabel id="ooda-radar" label="Financial Radar" />
                    <ActChartColumn plan={displayPlan} sim={sim} />
                    <OodaAiCard
                      plan={displayPlan}
                      sim={sim}
                      brief={run?.brief ?? null}
                    />
                  </div>
                </div>
              </div>
              <YearTable plan={displayPlan} sim={sim} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="relative flex min-h-11 items-center">
                <PhaseLabel id="ooda-act" label="Act" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="pointer-events-auto">
                    <CalculateButton
                      onCalculate={() => calculate({ stay: true })}
                      className="h-9 w-auto min-w-[6.8rem] px-5 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-surface px-5 py-8 shadow-[0_0_0_1px_var(--color-border)]">
                <p className="text-left font-display text-3xl text-fg">No MACH RUN yet.</p>
                <p className="mt-1 text-left font-display text-lg text-fg">
                  You need to kick the tires and light the fires!
                </p>
                <p className="mt-2 max-w-xl text-left text-sm text-muted">
                  Complete Observe, Orient, and Decide to the left to begin your
                  financial MACH RUN. Hit Calculate above to go supersonic and
                  Act with financial purpose.
                </p>
              </div>
            </div>
          )}
          <CalculateButton onCalculate={() => calculate({ stay: true })} />
        </div>
      </main>
      <MachFooter />
    </div>
  );
}
