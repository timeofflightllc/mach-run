import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { Section, collapseAllOodSections } from "@/components/meridian/section";
import { SiteMenu } from "@/components/meridian/site-nav";
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
import { GhostButton, PrimaryButton } from "@/components/ui/field";

function NavButton({
  kind,
  onPress,
  children,
}: {
  kind: "back" | "next";
  onPress: () => void;
  children: string;
}) {
  const armed = useRef(false);
  const Button = kind === "back" ? GhostButton : PrimaryButton;
  return (
    <Button
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        armed.current = true;
        onPress();
      }}
      onClick={(e) => {
        if (armed.current) {
          armed.current = false;
          e.preventDefault();
          return;
        }
        onPress();
      }}
    >
      {children}
    </Button>
  );
}

function SweepNav({
  showBack,
  showNext,
  onBack,
  onNext,
}: {
  showBack: boolean;
  showNext: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      {showBack ? (
        <NavButton kind="back" onPress={onBack}>
          Back
        </NavButton>
      ) : null}
      {showNext ? (
        <NavButton kind="next" onPress={onNext}>
          Next
        </NavButton>
      ) : null}
    </>
  );
}

/** View toggle only. It does not change the run, so it must not force a re-execute. */
function inputSignature(plan: Plan): string {
  const assumptions = { ...plan.assumptions };
  delete assumptions.dollars;
  return JSON.stringify({ ...plan, assumptions });
}

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

const PAGES = [
  { id: "family", phase: "observe" },
  { id: "assets", phase: "observe" },
  { id: "liabilities", phase: "observe" },
  { id: "income", phase: "orient" },
  { id: "spending", phase: "orient" },
  { id: "contributions", phase: "decide" },
  { id: "act", phase: "act" },
] as const;

type StepId = (typeof PAGES)[number]["id"];

const PHASES = [
  { id: "observe", label: "Observe", page: "family" },
  { id: "orient", label: "Orient", page: "income" },
  { id: "decide", label: "Decide", page: "contributions" },
  { id: "act", label: "Act", page: "act" },
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

function ActPhase() {
  return (
    <p
      id="ooda-act"
      className="scroll-mt-40 font-display text-lg font-semibold tracking-[0.18em] text-muted sm:text-xl"
    >
      <span className="uppercase">Act</span>
    </p>
  );
}

function Home() {
  const plan = usePlanStore((s) => s.plan);
  const patchAssumptions = usePlanStore((s) => s.patchAssumptions);
  const { status: saveStatus, saveNow } = useCloudPlan();
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user?.id);
  const ent = useEntitlement();
  const [step, setStep] = useState<StepId>("family");
  const sheet = hasBalanceSheet(ent.plan);
  const route = PAGES.filter((page) => page.id !== "liabilities" || sheet);
  const holdTimer = useRef<number | null>(null);
  const holdGen = useRef(0);
  const [holding, setHolding] = useState(false);
  useEffect(() => {
    return () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
    };
  }, []);
  const shown = step;
  const shownIndex = route.findIndex((item) => item.id === shown);
  const shownPhase = PAGES.find((page) => page.id === shown)?.phase ?? "observe";
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
    collapseAllOodSections();
  }, []);

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

  const displayPlan = run
    ? {
        ...run.plan,
        assumptions: { ...run.plan.assumptions, dollars: plan.assumptions.dollars },
      }
    : plan;
  const sim = run?.sim;
  const real = plan.assumptions.dollars === "real";

  useEffect(() => {
    if (step === "liabilities" && !sheet) setStep("assets");
  }, [step, sheet]);

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

  function onNext() {
    const next = route[shownIndex + 1]?.id;
    if (!next) return;
    const live = usePlanStore.getState().plan;
    const key = useProfileStore.getState().activeId || "local";
    const current = runs[key];
    if (current && inputSignature(current.plan) !== inputSignature(live)) {
      holdGen.current += 1;
      if (holdTimer.current) {
        window.clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      setHolding(false);
      setRuns((prev) => {
        if (!(key in prev)) return prev;
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      clearStoredRun(key);
    }
    goStep(next);
    window.scrollTo(0, 0);
  }

  function goStep(next: StepId) {
    if (!route.some((page) => page.id === next) || next === step) return;
    setStep(next);
  }

  function pane(id: StepId, idle: string): { className: string; hidden: boolean } {
    const visible = step === id;
    return {
      className: visible ? idle : "hidden",
      hidden: !visible,
    };
  }

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
      const nextRun = {
        id: runId,
        plan: snapshot,
        sim: { ...nextSim, months: [] },
        brief,
      };
      holdGen.current += 1;
      const gen = holdGen.current;
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      setHolding(true);
      if (!opts?.stay) goStep("act");
      let expanded: PeerBrief | null = null;
      void getEntitlement()
        .then((liveEnt) => {
          if (!liveEnt?.paid) return;
          expanded = buildPeerBrief(snapshot, nextSim, { expanded: true });
          setRuns((prev) => {
            const cur = prev[key];
            if (!cur || cur.id !== runId || cur.brief.expanded) return prev;
            return { ...prev, [key]: { ...cur, brief: expanded as PeerBrief } };
          });
        })
        .catch(() => {
          /* keep hook entitlement */
        });
      holdTimer.current = window.setTimeout(() => {
        if (holdGen.current !== gen) return;
        setRuns((prev) => ({
          ...prev,
          [key]: expanded ? { ...nextRun, brief: expanded } : nextRun,
        }));
        saveStoredRun(key, { id: runId, plan: snapshot });
        setHolding(false);
      }, 3000);
      void saveNow(snapshot);
      try {
        const { pingActivity } = await import("@/lib/ops/activity-api");
        const { shapeFromPlan } = await import("@/lib/ops/activity");
        const profiles = useProfileStore.getState().profiles.length || 1;
        pingActivity("calculate", shapeFromPlan(snapshot, profiles));
      } catch {
        /* activity is optional */
      }
    } catch (err) {
      holdGen.current += 1;
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      setHolding(false);
      console.error("MACH Run calculate failed", err);
      setRunError(
        err instanceof Error ? err.message : "Calculate failed. Check the numbers and try again.",
      );
    }
  }

  const familyPane = pane("family", "flex flex-col gap-3");
  const assetsPane = pane("assets", "flex flex-col gap-3");
  const liabilitiesPane = pane("liabilities", "flex flex-col gap-3");
  const incomePane = pane("income", "flex flex-col gap-3");
  const spendingPane = pane("spending", "flex flex-col gap-3");
  const contributionsPane = pane("contributions", "flex flex-col gap-3");
  const actPane = pane("act", "flex min-w-0 flex-col gap-4");

  const showBack = shownIndex > 0;
  const showNext = shownIndex >= 0 && shownIndex < route.length - 1;
  const onBack = () => {
    const prev = route[shownIndex - 1]?.id;
    if (prev) goStep(prev);
  };

  return (
    <div className="min-h-screen bg-bg text-fg">
      <WelcomeEmailPreviewOverlay />
      <header
        id="mach-header"
        className="canopy-bar sticky top-0 z-30 border-b border-border"
      >
        <div className="page-gutter relative z-50 mx-auto max-w-none py-2.5">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
            <div className="flex min-w-0 items-center gap-0">
              <BrandLockup showTagline={false} />
            </div>
            <div className="flex min-w-0 items-center justify-end gap-0.5 sm:gap-1.5">
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
              <SiteMenu align="right" className="hidden md:block" />
              <ProfileSwitcher ent={ent} />
              <AuthSlot saved={saveStatus} />
            </div>
            <p className="w-[7.5rem] min-w-0 whitespace-normal text-left text-[11px] font-bold leading-snug tracking-[0.04em] text-muted sm:w-[12.5rem] sm:text-xs sm:tracking-[0.08em] md:w-auto md:whitespace-nowrap md:text-[13px] md:tracking-[0.12em]">
              The Supersonic Retirement Calculator
            </p>
            <div className="flex items-center justify-end gap-1 md:hidden">
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
              <SiteMenu align="right" />
            </div>
          </div>
        </div>
        <nav aria-label="OODA loop" className="page-gutter mx-auto max-w-none pb-3">
          <div className="mx-auto flex max-w-3xl rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--color-border)]">
            {PHASES.map((item) => {
              const pages = route.filter((page) => page.phase === item.id);
              const here = pages.findIndex((page) => page.id === shown);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={shownPhase === item.id ? "step" : undefined}
                  aria-label={
                    here >= 0
                      ? `${item.label}, ${here + 1} of ${pages.length}`
                      : item.label
                  }
                  onClick={() => goStep(item.page)}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-md px-0.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.04em] sm:px-1 sm:text-xs sm:tracking-[0.08em] md:text-sm md:tracking-[0.14em]",
                    shownPhase === item.id ? "bg-accent text-accent-fg" : "text-muted",
                  )}
                >
                  <span>{item.label}</span>
                  <span className="flex items-center gap-1" aria-hidden="true">
                    {pages.map((page) => {
                      const index = route.findIndex((entry) => entry.id === page.id);
                      const on = index === shownIndex;
                      const done = index < shownIndex;
                      return (
                        <span
                          key={page.id}
                          className={cn(
                            "rounded-full bg-current",
                            on
                              ? "h-1.5 w-1.5 opacity-100"
                              : done
                                ? "h-1 w-1 opacity-80"
                                : "h-1 w-1 opacity-35",
                          )}
                        />
                      );
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
        <GuestOnly>
          <div
            className="border-t py-2.5 text-center"
            style={{
              background: "var(--color-section-lift)",
              borderColor: "var(--color-section-lift-border)",
            }}
          >
            <p className="page-gutter mx-auto max-w-none text-sm font-bold leading-relaxed text-fg">
              Get started — Family first, then Accounts, Income, Spending, and
              Contributions. On Act, Execute. That’s a MACH RUN.
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

      <main className="page-gutter mx-auto flex max-w-none flex-col gap-5 py-5">
        <div>
          <div
            className={familyPane.className}
            aria-hidden={familyPane.hidden}
            hidden={familyPane.hidden}
          >
            <PhaseLabel id="ooda-observe" label="Observe" />
            <Section
              title="Family"
              hint="Who is in the household, and when you want to retire."
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <HouseholdForm />
            </Section>
          </div>
          <div
            className={assetsPane.className}
            aria-hidden={assetsPane.hidden}
            hidden={assetsPane.hidden}
          >
            <PhaseLabel id="ooda-observe-assets" label="Observe" />
            <Section
              title="Accounts - Assets"
              hint="The accounts you have today, and what each one is worth."
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <PortfolioForm />
            </Section>
          </div>
          <div
            className={liabilitiesPane.className}
            aria-hidden={liabilitiesPane.hidden}
            hidden={liabilitiesPane.hidden}
          >
            <PhaseLabel id="ooda-observe-liabilities" label="Observe" />
            <Section
              title="Accounts - Liabilities"
              hint="What you owe, apart from a mortgage already on a house."
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <LiabilityForm />
            </Section>
          </div>
          <div
            className={incomePane.className}
            aria-hidden={incomePane.hidden}
            hidden={incomePane.hidden}
          >
            <PhaseLabel id="ooda-orient" label="Orient" />
            <Section
              title="Income"
              hint="Each paycheck, what kind it is, and how long it lasts."
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <IncomeForm />
            </Section>
          </div>
          <div
            className={spendingPane.className}
            aria-hidden={spendingPane.hidden}
            hidden={spendingPane.hidden}
          >
            <PhaseLabel id="ooda-orient-spending" label="Orient" />
            <Section
              title="Spending"
              hint="What the household spends in a normal month."
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <SpendingForm />
            </Section>
          </div>
          <div
            className={contributionsPane.className}
            aria-hidden={contributionsPane.hidden}
            hidden={contributionsPane.hidden}
          >
            <PhaseLabel id="ooda-decide" label="Decide" />
            <Section
              title="Contributions"
              hint="How much goes into which account, and when it stops."
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <ContributionForm />
            </Section>
          </div>
          <div
            className={actPane.className}
            aria-hidden={actPane.hidden}
            hidden={actPane.hidden}
          >
          {runError ? (
            <p className="text-sm text-[#e8c547]">{runError}</p>
          ) : null}
          {holding ? (
            <div className="flex min-h-[70svh] flex-col items-center justify-center rounded-xl bg-surface px-5 py-10 text-center shadow-[0_0_0_1px_var(--color-border)]">
              <img
                src="/brand/mach-run-logo.jpg?v=21"
                alt=""
                width={1257}
                height={428}
                className="mach-run-pulse w-[16rem] max-w-full"
              />
              <p className="mt-6 font-display text-2xl text-fg" aria-label="MACH RUN in progress.">
                MACH RUN in progress<span className="mach-run-dots" aria-hidden="true" />
              </p>
              <p className="mt-2 text-sm text-muted">Kicking the tires and lighting the fires.</p>
            </div>
          ) : sim ? (
            <div className="flex flex-col gap-4">
              {!ent.paid ? (
                <div
                  className="flex flex-col gap-3 rounded-xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    background: "var(--color-section)",
                    boxShadow: "0 0 0 1px var(--color-section-border)",
                  }}
                >
                  <p className="text-sm leading-relaxed text-fg">
                    This MachRun is on Free. Upgrade to open more features
                    including accounts, incomes, the full OODA Analysis and
                    OODA AI.
                  </p>
                  <Link
                    to="/pricing"
                    className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
                  >
                    Upgrade to MACH RUN Unlimited
                  </Link>
                </div>
              ) : null}
              <div className="@container">
                <div className="grid grid-cols-1 gap-4 @min-[64rem]:grid-cols-[minmax(0,1.15fr)_minmax(24rem,1fr)] @min-[64rem]:items-start">
                  <div className="flex min-w-0 flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 @min-[36rem]:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-3">
                        <ActPhase />
                        <Verdict
                          plan={displayPlan}
                          sim={sim}
                          brief={run?.brief ?? null}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex min-h-11 items-center justify-center">
                          <CalculateButton
                            label="Execute the MACH RUN"
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
                <ActPhase />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="pointer-events-auto">
                    <CalculateButton
                      label="Execute the MACH RUN"
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
                  Finish Observe, Orient, and Decide, then come to Act and execute the MACH RUN.
                </p>
              </div>
            </div>
          )}
          {holding ? null : (
            <CalculateButton
              label="Execute the MACH RUN"
              onCalculate={() => calculate({ stay: true })}
            />
          )}
        </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          {shownIndex > 0 ? (
            <NavButton kind="back" onPress={() => goStep(route[shownIndex - 1].id)}>
              Back
            </NavButton>
          ) : (
            <span />
          )}
          {shownIndex >= 0 && shownIndex < route.length - 1 ? (
            <NavButton kind="next" onPress={onNext}>
              Next
            </NavButton>
          ) : null}
        </div>
      </main>
      {shown === "act" ? <MachFooter variant="full" /> : <MachFooter />}
    </div>
  );
}
