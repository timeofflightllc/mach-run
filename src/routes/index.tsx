import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AuthSlot } from "@/components/meridian/auth-slot";
import { ProfileSwitcher } from "@/components/meridian/profile-switcher";
import { MACH_RESET_BASELINE } from "@/components/meridian/account-menu";
import { StaleRunPrompt } from "@/components/meridian/confirm-remove";
import { CalculateButton } from "@/components/meridian/calculate-button";
import { AdvisoryStrip } from "@/components/meridian/advisory-note";
import { CashChart, NetWorthChart, WealthChart } from "@/components/meridian/charts";
import { Pinnable, useChartPins } from "@/components/meridian/chart-pin";
import { ContributionForm } from "@/components/meridian/contribution-form";
import { AssumptionsForm, HouseholdForm } from "@/components/meridian/household-form";
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
import { MachOrbit } from "@/components/meridian/mach-orbit";
import { isRealUser } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useGuestChrome } from "@/lib/auth/guest-chrome";
import { simulate } from "@/lib/plan/engine";
import { refreshEstimatedSocialSecurity } from "@/lib/plan/social-security";
import { planInputSignature } from "@/lib/plan/input-signature";
import { buildPeerBrief, type PeerBrief } from "@/lib/plan/peers";
import { earliestWorkableRetirement } from "@/lib/plan/earliest-retirement";
import { usePlannerCopy } from "@/components/meridian/use-planner-copy";
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
import { GuestHero } from "@/components/meridian/guest-hero";
import { GhostButton, PrimaryButton } from "@/components/ui/field";

/** Charts need the months. Drop the ledger detail so the run stays light. */
function simForCharts(sim: SimResult): SimResult {
  return {
    ...sim,
    months: sim.months.map((month) => {
      const { detail: _detail, ...rest } = month;
      return rest;
    }),
  };
}

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
  return planInputSignature(plan);
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
  { id: "assumptions", phase: "observe" },
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

const OBSERVE_TABS = [
  { id: "family", label: "Family" },
  { id: "assumptions", label: "Assumptions" },
  { id: "assets", label: "Assets" },
  { id: "liabilities", label: "Liabilities" },
] as const;

const ORIENT_TABS = [
  { id: "income", label: "Income" },
  { id: "spending", label: "Spending" },
] as const;

function PhaseFolderTabs({
  name,
  tabs,
  active,
  onPick,
}: {
  name: string;
  tabs: readonly { id: StepId; label: string }[];
  active: StepId;
  onPick: (id: StepId) => void;
}) {
  return (
    <div
      className="ml-auto flex min-w-0 flex-1 flex-nowrap items-end justify-end gap-1 sm:mr-8 sm:flex-none sm:gap-1.5"
      role="tablist"
      aria-label={name}
    >
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick(tab.id)}
            className={cn(
              "whitespace-nowrap rounded-t-lg rounded-b-none px-1.5 font-display text-[12px] font-medium leading-none tracking-normal min-[400px]:text-[13px] min-[520px]:px-2 min-[520px]:font-sans min-[520px]:text-xs sm:px-3.5 sm:text-sm",
              on
                ? "z-10 bg-surface pb-2.5 pt-2 text-fg shadow-[0_-1px_0_0_var(--color-border),1px_0_0_0_var(--color-border),-1px_0_0_0_var(--color-border)]"
                : "z-0 mb-1.5 bg-section-lift pb-2 pt-1.5 text-muted shadow-[0_0_0_1px_var(--color-section-lift-border)]",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function PhaseHead({
  id,
  label,
  tabs,
}: {
  id: string;
  label: string;
  tabs: ReactNode;
}) {
  return (
    <div className="relative z-10 -mb-0.5 flex items-end justify-between gap-1.5 sm:gap-3">
      <PhaseLabel id={id} label={label} className="mb-2 shrink-0 leading-none" />
      {tabs}
    </div>
  );
}

function Home() {
  const plan = usePlanStore((s) => s.plan);
  const copy = usePlannerCopy();
  const patchAssumptions = usePlanStore((s) => s.patchAssumptions);
  const { status: saveStatus, saveNow } = useCloudPlan();
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user?.id);
  const ent = useEntitlement();
  const [step, setStep] = useState<StepId>("family");
  const sheet = hasBalanceSheet(ent.plan);
  const route = PAGES.filter((page) => page.id !== "liabilities" || sheet);
  const [motion, setMotion] = useState<{
    from: StepId;
    to: StepId;
    dir: 1 | -1;
    on: boolean;
  } | null>(null);
  const motionRef = useRef(motion);
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const panelRefs = useRef<Partial<Record<StepId, HTMLDivElement | null>>>({});
  const slideKey = motion ? `${motion.from}>${motion.to}` : "";
  const holdTimer = useRef<number | null>(null);
  const holdGen = useRef(0);
  const dismissedStale = useRef<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [stalePrompt, setStalePrompt] = useState(false);
  useEffect(() => {
    return () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!motion || motion.on) return;
    const from = motion.from;
    const to = motion.to;
    const fromEl = panelRefs.current[from];
    const toEl = panelRefs.current[to];
    const h = Math.max(fromEl?.offsetHeight ?? 0, toEl?.offsetHeight ?? 0);
    if (h) setFrameHeight(h);
    let timeout = 0;
    let inner = 0;
    let cancelled = false;
    const raf = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        if (cancelled) return;
        setMotion((current) => {
          if (!current || current.from !== from || current.to !== to || current.on) return current;
          const next = { ...current, on: true };
          motionRef.current = next;
          return next;
        });
        timeout = window.setTimeout(() => {
          if (cancelled) return;
          motionRef.current = null;
          setMotion(null);
          setFrameHeight(null);
        }, 250);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.cancelAnimationFrame(inner);
      window.clearTimeout(timeout);
    };
    // slideKey is the only trigger. motion.on flipping must not cancel the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideKey]);
  const shown = step;
  const shownIndex = route.findIndex((item) => item.id === shown);
  const shownPhase = PAGES.find((page) => page.id === shown)?.phase ?? "observe";
  const [runError, setRunError] = useState<string | null>(null);
  const [runStale, setRunStale] = useState(false);
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
    const loaded: Record<
      string,
      { id: number; plan: Plan; sim: SimResult; brief: PeerBrief }
    > = {};
    for (const [key, row] of Object.entries(stored)) {
      try {
        const sim = simulate(row.plan);
        const recommended = earliestWorkableRetirement(row.plan);
        loaded[key] = {
          id: row.id,
          plan: row.plan,
          sim: simForCharts(sim),
          brief: buildPeerBrief(row.plan, sim, { expanded: false, recommended }),
        };
      } catch {
        /* skip a bad snapshot */
      }
    }
    setRuns((prev) => {
      const next = { ...loaded };
      for (const [key, row] of Object.entries(prev)) {
        const fromDisk = next[key];
        if (!fromDisk || row.id >= fromDisk.id) next[key] = row;
      }
      return next;
    });
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
  const real = plan.assumptions.dollars === "real";

  useEffect(() => {
    if (step === "liabilities" && !sheet) setStep("assets");
  }, [step, sheet]);

  useEffect(() => {
    setRunError(null);
  }, [runKey]);

  const liveSig = inputSignature(plan);

  useEffect(() => {
    if (step !== "act") {
      dismissedStale.current = null;
      setStalePrompt(false);
      return;
    }
    if (holding) return;
    const current = runs[runKey];
    if (!current) {
      setStalePrompt(false);
      return;
    }
    if (inputSignature(current.plan) === liveSig) {
      dismissedStale.current = null;
      setStalePrompt(false);
      return;
    }
    if (dismissedStale.current === liveSig) return;
    setStalePrompt(true);
  }, [step, runKey, runs, holding, liveSig]);

  useEffect(() => {
    if (!ent.paid) return;
    setRuns((prev) => {
      const cur = prev[runKey];
      if (!cur?.brief || cur.brief.expanded) return prev;
      return { ...prev, [runKey]: { ...cur, brief: { ...cur.brief, expanded: true } } };
    });
  }, [ent.paid, runKey]);

  const guestChrome = useGuestChrome(user?.primaryEmail);
  const heroOn = !isRealUser(user) || guestChrome;
  const [demoLoaded, setDemoLoaded] = useState(false);
  const stepsRef = useRef<HTMLDivElement>(null);
  const engagedRef = useRef(false);
  const [stepsH, setStepsH] = useState<number | null>(null);

  function stepsHeight() {
    const header = document.getElementById("mach-header");
    const caution = document.getElementById("master-caution");
    if (!header || !caution) return 0;
    return Math.max(
      120,
      window.innerHeight - header.getBoundingClientRect().height - caution.getBoundingClientRect().height,
    );
  }

  function engageSteps() {
    const steps = stepsRef.current;
    const h = stepsHeight();
    engagedRef.current = true;
    if (steps) {
      steps.style.height = `${h}px`;
      steps.style.overflowY = "auto";
      steps.style.overscrollBehavior = "contain";
      steps.style.overflowAnchor = "none";
    }
    setStepsH(h);
  }

  function releaseSteps() {
    if (!engagedRef.current && stepsH == null) return;
    engagedRef.current = false;
    const steps = stepsRef.current;
    if (steps) {
      steps.style.height = "";
      steps.style.overflowY = "";
      steps.style.overscrollBehavior = "";
    }
    setStepsH(null);
  }

  useEffect(() => {
    if (!heroOn) {
      engagedRef.current = false;
      setStepsH(null);
      return;
    }

    function pair() {
      const header = document.getElementById("mach-header");
      const caution = document.getElementById("master-caution");
      const steps = stepsRef.current;
      if (!header || !caution || !steps) return null;
      return { header, caution, steps };
    }

    function pixels(event: WheelEvent) {
      if (event.deltaMode === 1) return event.deltaY * 16;
      if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
      return event.deltaY;
    }

    function nested(target: EventTarget | null, steps: HTMLElement) {
      let node = target instanceof Element ? target : null;
      while (node && node !== steps) {
        if (node instanceof HTMLElement) {
          const oy = getComputedStyle(node).overflowY;
          if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 1) return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    const onWheel = (event: WheelEvent) => {
      const found = pair();
      if (!found) return;
      const { header, caution, steps } = found;
      const dy = pixels(event);
      if (dy === 0) return;
      const line = header.getBoundingClientRect().bottom;
      const top = caution.getBoundingClientRect().top;
      const inner = nested(event.target, steps);
      if (inner) {
        const up = dy < 0;
        const atTop = inner.scrollTop <= 0;
        const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 1;
        if ((up && !atTop) || (!up && !atBottom)) return;
      }
      const atLine = top <= line + 1;
      const wouldCross = dy > 0 && top - dy <= line + 1;
      if (!engagedRef.current && dy < 0) return;
      if (!engagedRef.current && !atLine && !wouldCross) return;
      if (dy < 0 && steps.scrollTop <= 0) {
        releaseSteps();
        return;
      }
      event.preventDefault();
      if (!engagedRef.current) engageSteps();
      steps.scrollTop += dy;
    };

    let touchY = 0;
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const found = pair();
      if (!found) return;
      const y = event.touches[0]?.clientY ?? touchY;
      const dy = touchY - y;
      touchY = y;
      if (Math.abs(dy) < 1) return;
      const { header, caution, steps } = found;
      const line = header.getBoundingClientRect().bottom;
      const top = caution.getBoundingClientRect().top;
      const atLine = top <= line + 1;
      const wouldCross = dy > 0 && top - dy <= line + 1;
      if (!engagedRef.current && dy < 0) return;
      if (!engagedRef.current && !atLine && !wouldCross) return;
      if (dy < 0 && steps.scrollTop <= 0) {
        releaseSteps();
        return;
      }
      event.preventDefault();
      if (!engagedRef.current) engageSteps();
      steps.scrollTop += dy;
    };

    const onKey = (event: KeyboardEvent) => {
      if (!engagedRef.current) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      const steps = stepsRef.current;
      if (!steps) return;
      const up = event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home";
      const down = event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ";
      if (!up && !down) return;
      if (up && steps.scrollTop <= 0) {
        releaseSteps();
        return;
      }
      event.preventDefault();
      if (event.key === "Home") steps.scrollTop = 0;
      else if (event.key === "ArrowUp") steps.scrollTop -= 48;
      else if (event.key === "ArrowDown") steps.scrollTop += 48;
      else if (event.key === "PageUp") steps.scrollTop -= steps.clientHeight * 0.85;
      else steps.scrollTop += steps.clientHeight * 0.85;
    };

    const onScroll = () => {
      if (!engagedRef.current) return;
      const found = pair();
      if (!found) return;
      const top = found.caution.getBoundingClientRect().top;
      const line = found.header.getBoundingClientRect().bottom;
      if (top > line + 24) releaseSteps();
    };

    const onResize = () => {
      if (!engagedRef.current) return;
      setStepsH(stepsHeight());
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      engagedRef.current = false;
    };
  }, [heroOn]);

  function scrollStepToTop() {
    if (!heroOn) {
      window.scrollTo(0, 0);
      return;
    }
    const header = document.getElementById("mach-header");
    const caution = document.getElementById("master-caution");
    if (header && caution) {
      const y =
        window.scrollY + caution.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
      window.scrollTo(0, Math.max(0, y));
    }
    engageSteps();
    window.requestAnimationFrame(() => {
      if (stepsRef.current) stepsRef.current.scrollTop = 0;
    });
  }

  function onNext() {
    const next = route[shownIndex + 1]?.id;
    if (!next) return;
    goStep(next);
  }

  function goStep(next: StepId, opts?: { scroll?: "top" | "keep" }) {
    if (!route.some((page) => page.id === next)) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const current = motionRef.current;
    const from = current?.to ?? step;
    if (next === from) return;
    const scroll = opts?.scroll ?? "top";
    if (reduce || current) {
      motionRef.current = null;
      setMotion(null);
      setFrameHeight(null);
      setStep(next);
      if (scroll === "top") scrollStepToTop();
      return;
    }
    const nextIndex = route.findIndex((page) => page.id === next);
    const fromIndex = route.findIndex((page) => page.id === from);
    if (nextIndex < 0) return;
    const fromEl = panelRefs.current[from];
    setFrameHeight(fromEl?.offsetHeight ?? null);
    const nextMotion = {
      from,
      to: next,
      dir: (nextIndex > fromIndex ? 1 : -1) as 1 | -1,
      on: false,
    };
    motionRef.current = nextMotion;
    setStep(next);
    setMotion(nextMotion);
    if (scroll === "top") scrollStepToTop();
  }

  function pane(id: StepId, idle: string): {
    className: string;
    style?: { transform: string; transition: string };
    hidden: boolean;
  } {
    if (!motion || (id !== motion.from && id !== motion.to)) {
      const visible = step === id;
      return {
        className: visible ? idle : "hidden",
        hidden: !visible,
      };
    }
    const leaving = id === motion.from;
    const fromX = motion.on ? (motion.dir === 1 ? "-100%" : "100%") : "0%";
    const toX = motion.on ? "0%" : motion.dir === 1 ? "100%" : "-100%";
    return {
      className: cn(
        idle,
        "absolute inset-x-0 top-0 w-full",
        leaving ? "pointer-events-none z-0" : "z-20",
      ),
      style: {
        transform: `translateX(${leaving ? fromX : toX})`,
        transition: motion.on ? "transform 250ms ease" : "none",
      },
      hidden: false,
    };
  }

  async function calculate(opts?: { stay?: boolean }) {
    try {
      setRunError(null);
      const live = refreshEstimatedSocialSecurity(usePlanStore.getState().plan);
      if (live !== usePlanStore.getState().plan) usePlanStore.getState().setPlan(live);
      useProfileStore.getState().snapshotCurrent(live);
      const key = useProfileStore.getState().activeId || "local";
      const snapshot = structuredClone(live) as Plan;
      const nextSim = simulate(snapshot);
      const recommended = earliestWorkableRetirement(snapshot);
      const brief = buildPeerBrief(snapshot, nextSim, {
        expanded: Boolean(ent.paid),
        recommended,
      });
      const runId = Date.now();
      const nextRun = {
        id: runId,
        plan: snapshot,
        sim: simForCharts(nextSim),
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
          expanded = buildPeerBrief(snapshot, nextSim, { expanded: true, recommended });
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
        setRunStale(false);
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

  function applyRecommendedDate(date: string) {
    const current = usePlanStore.getState().plan;
    usePlanStore.getState().setPlan({
      ...current,
      assumptions: { ...current.assumptions, retirementGoalDate: date },
      contributions: current.contributions.map((rule) =>
        rule.endAtRetirement ? { ...rule, endDate: date, endWithStageId: undefined } : rule,
      ),
    });
    void calculate({ stay: true });
  }

  const inputFrame =
    "mx-auto flex w-full max-w-6xl flex-col gap-3 2xl:max-w-[90rem] min-[2000px]:max-w-[110rem]";
  const shell = "flex w-full flex-col";
  const familyPane = pane("family", shell);
  const assumptionsPane = pane("assumptions", shell);
  const assetsPane = pane("assets", shell);
  const liabilitiesPane = pane("liabilities", shell);
  const incomePane = pane("income", shell);
  const spendingPane = pane("spending", shell);
  const contributionsPane = pane("contributions", shell);
  const actPane = pane("act", "flex min-w-0 w-full flex-col gap-4");

  const showBack = shownIndex > 0;
  const showNext = shownIndex >= 0 && shownIndex < route.length - 1;
  function showFamily() {
    motionRef.current = null;
    setMotion(null);
    setFrameHeight(null);
    setStep("family");
    window.setTimeout(() => scrollStepToTop(), 60);
  }

  function showDemo() {
    motionRef.current = null;
    setMotion(null);
    setFrameHeight(null);
    setStep("family");
    setDemoLoaded(true);
    window.setTimeout(() => scrollStepToTop(), 60);
  }

  function clearDemo() {
    usePlanStore.getState().reset();
    setDemoLoaded(false);
  }

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
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
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
            <p className="mt-[0.8px] w-[9.8rem] min-w-0 whitespace-normal text-left text-[11px] font-bold leading-snug tracking-[0.04em] text-muted sm:w-[11.5rem] sm:text-xs sm:tracking-[0.08em] md:w-auto md:whitespace-nowrap md:text-[13px] md:tracking-[0.12em]">
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
        <EmailVerifyBanner />
      </header>
      {heroOn ? <GuestHero onShowFamily={showFamily} onDemo={showDemo} /> : null}
      <div id={heroOn ? "guest-dock" : undefined}>
      {heroOn ? (
        <div id="master-caution" className="relative z-20 border-t border-[#8a7020] bg-[#2c220e]">
          <div className="page-gutter mx-auto flex max-w-none flex-col items-center gap-2 py-4 text-center">
            <span className="master-caution-lamp inline-flex shrink-0 items-center rounded-sm bg-[#e8c547] px-3 py-1 font-display text-sm font-semibold uppercase tracking-[0.18em] text-[#1a1408]">
              Master Caution
            </span>
            <p className="max-w-3xl text-base leading-snug text-[#fff3c4] sm:text-lg">
              Your MACH RUN information is not saved until you create an
              account.
            </p>
            <Link
              to="/login"
              search={{ mode: "up" }}
              className="text-base font-semibold text-white underline decoration-[#e8c547] underline-offset-[3px] hover:text-[#fff3c4] sm:text-lg"
            >
              Create a free account in 30 seconds.
            </Link>
            {demoLoaded ? (
              <button
                type="button"
                onClick={clearDemo}
                className="mt-1 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#e8c547] px-4 py-2 text-sm font-semibold text-[#1a1408] hover:bg-[#f3d56a] active:scale-[0.98]"
              >
                Clear demonstration information from MACH RUN
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        ref={stepsRef}
        className={stepsH != null ? "overflow-y-auto overscroll-contain bg-bg" : undefined}
        style={stepsH != null ? { height: stepsH, overflowAnchor: "none" } : undefined}
      >

      <main className="relative z-10 bg-bg page-gutter mx-auto flex max-w-none flex-col gap-5 py-5">
        <div
          className="relative"
          style={frameHeight != null ? { height: frameHeight, overflow: "hidden" } : undefined}
        >
          <div
            ref={(node) => {
              panelRefs.current.family = node;
            }}
            className={familyPane.className}
            style={familyPane.style}
            aria-hidden={familyPane.hidden}
            hidden={familyPane.hidden}
          >
            <div className={inputFrame}>
            <div>
            <PhaseHead
              id="ooda-observe"
              label="Observe"
              tabs={<PhaseFolderTabs name="Observe" tabs={OBSERVE_TABS} active="family" onPick={goStep} />}
            />
            <Section
              title="Family"
              hint={copy.familyHint}
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <HouseholdForm />
            </Section>
            </div>
            </div>
          </div>
          <div
            ref={(node) => {
              panelRefs.current.assumptions = node;
            }}
            className={assumptionsPane.className}
            style={assumptionsPane.style}
            aria-hidden={assumptionsPane.hidden}
            hidden={assumptionsPane.hidden}
          >
            <div className={inputFrame}>
            <div>
            <PhaseHead
              id="ooda-observe-assumptions"
              label="Observe"
              tabs={<PhaseFolderTabs name="Observe" tabs={OBSERVE_TABS} active="assumptions" onPick={goStep} />}
            />
            <Section
              title="Assumptions"
              hint={copy.assumptionsHint}
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <AssumptionsForm />
            </Section>
            </div>
            </div>
          </div>
          <div
            ref={(node) => {
              panelRefs.current.assets = node;
            }}
            className={assetsPane.className}
            style={assetsPane.style}
            aria-hidden={assetsPane.hidden}
            hidden={assetsPane.hidden}
          >
            <div className={inputFrame}>
            <div>
            <PhaseHead
              id="ooda-observe-assets"
              label="Observe"
              tabs={<PhaseFolderTabs name="Observe" tabs={OBSERVE_TABS} active="assets" onPick={goStep} />}
            />
            <Section
              title="Accounts - Assets"
              hint={copy.assetsHint}
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <PortfolioForm />
            </Section>
            </div>
            </div>
          </div>
          <div
            ref={(node) => {
              panelRefs.current.liabilities = node;
            }}
            className={liabilitiesPane.className}
            style={liabilitiesPane.style}
            aria-hidden={liabilitiesPane.hidden}
            hidden={liabilitiesPane.hidden}
          >
            <div className={inputFrame}>
            <div>
            <PhaseHead
              id="ooda-observe-liabilities"
              label="Observe"
              tabs={<PhaseFolderTabs name="Observe" tabs={OBSERVE_TABS} active="liabilities" onPick={goStep} />}
            />
            <Section
              title="Accounts - Liabilities"
              hint={copy.liabilitiesHint}
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <LiabilityForm />
            </Section>
            </div>
            </div>
          </div>
          <div
            ref={(node) => {
              panelRefs.current.income = node;
            }}
            className={incomePane.className}
            style={incomePane.style}
            aria-hidden={incomePane.hidden}
            hidden={incomePane.hidden}
          >
            <div className={inputFrame}>
            <div>
            <PhaseHead
              id="ooda-orient"
              label="Orient"
              tabs={<PhaseFolderTabs name="Orient" tabs={ORIENT_TABS} active="income" onPick={goStep} />}
            />
            <Section
              title="Income"
              hint={copy.incomeHint}
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <IncomeForm />
            </Section>
            </div>
            </div>
          </div>
          <div
            ref={(node) => {
              panelRefs.current.spending = node;
            }}
            className={spendingPane.className}
            style={spendingPane.style}
            aria-hidden={spendingPane.hidden}
            hidden={spendingPane.hidden}
          >
            <div className={inputFrame}>
            <div>
            <PhaseHead
              id="ooda-orient-spending"
              label="Orient"
              tabs={<PhaseFolderTabs name="Orient" tabs={ORIENT_TABS} active="spending" onPick={goStep} />}
            />
            <Section
              title="Spending"
              hint={copy.spendingHint}
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <SpendingForm />
            </Section>
            </div>
            </div>
          </div>
          <div
            ref={(node) => {
              panelRefs.current.contributions = node;
            }}
            className={contributionsPane.className}
            style={contributionsPane.style}
            aria-hidden={contributionsPane.hidden}
            hidden={contributionsPane.hidden}
          >
            <div className={inputFrame}>
            <PhaseLabel id="ooda-decide" label="Decide" />
            <Section
              title="Contributions"
              hint={copy.contributionsHint}
              pinned
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
            >
              <ContributionForm />
            </Section>
            </div>
          </div>
          <div
            ref={(node) => {
              panelRefs.current.act = node;
            }}
            className={actPane.className}
            style={actPane.style}
            aria-hidden={actPane.hidden}
            hidden={actPane.hidden}
          >
          {runError ? (
            <p className="text-sm text-[#e8c547]">{runError}</p>
          ) : null}
          <AdvisoryStrip
            onOpen={(next, cardId) => {
              const current = motionRef.current?.to ?? step;
              if (next !== current) goStep(next);
              window.setTimeout(() => {
                document.getElementById(cardId)?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }, next === current ? 0 : 400);
            }}
          />
          {holding ? (
            <div className="flex min-h-[70svh] flex-col items-center justify-center rounded-xl bg-surface px-5 py-10 text-center shadow-[0_0_0_1px_var(--color-border)]">
              <MachOrbit />
              <p className="mt-6 font-display text-2xl text-fg" aria-label="MACH RUN in progress.">
                MACH RUN in progress<span className="mach-run-dots" aria-hidden="true" />
              </p>
              <p className="mt-2 text-sm text-muted">Kicking the tires and lighting the fires.</p>
            </div>
          ) : run ? (
            <div className="flex flex-col gap-4">
              {runStale ? (
                <p className="rounded-lg bg-[#e8c547] px-4 py-3 text-sm font-medium leading-relaxed text-[#1a1408]">
                  This MACH RUN is not current. Changes were saved, but the run has not been executed.
                </p>
              ) : null}
              {!ent.paid ? (
                <div
                  className="flex flex-col gap-3 rounded-xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    background: "var(--color-section)",
                    boxShadow: "0 0 0 1px var(--color-section-border)",
                  }}
                >
                  <p className="text-sm leading-relaxed text-fg">
                    This MACH RUN is on Free. Upgrade to open more features
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
                    <div className="grid grid-cols-1 items-start gap-4 @min-[36rem]:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-3">
                        <ActPhase />
                        <Verdict
                          plan={displayPlan}
                          sim={run.sim}
                          brief={run.brief}
                          onUseRecommended={applyRecommendedDate}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-3">
                        <p
                          aria-hidden="true"
                          className="invisible hidden font-display text-lg font-semibold tracking-[0.18em] sm:text-xl @min-[36rem]:block"
                        >
                          Act
                        </p>
                        <KpiStrip plan={displayPlan} sim={run.sim} />
                        <div className="flex items-center justify-center">
                          <CalculateButton
                            label="Execute the MACH RUN"
                            onCalculate={() => calculate({ stay: true })}
                            className="h-9 w-auto min-w-[6.8rem] px-5 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <PeerBriefCard
                      key={run.id}
                      brief={run.brief}
                      ran
                      plan={displayPlan}
                      sim={run.sim}
                      onUseRecommended={applyRecommendedDate}
                      onExecute={() => {
                        void calculate({ stay: true });
                      }}
                      onStale={() => setRunStale(true)}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex min-w-0 flex-col gap-3">
                      <PhaseLabel id="ooda-radar" label="Financial Radar" />
                      <ActChartColumn plan={displayPlan} sim={run.sim} />
                    </div>
                    <OodaAiCard
                      plan={displayPlan}
                      sim={run.sim}
                      brief={run.brief}
                    />
                  </div>
                </div>
              </div>
              <YearTable plan={displayPlan} sim={run.sim} />
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
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-8">
          {shownIndex > 0 ? (
            <NavButton kind="back" onPress={onBack}>
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
      <MachFooter disclaimer />
      </div>
      </div>
      {stalePrompt ? (
        <StaleRunPrompt
          onIgnore={() => {
            dismissedStale.current = inputSignature(usePlanStore.getState().plan);
            setStalePrompt(false);
          }}
          onExecute={() => {
            setStalePrompt(false);
            void calculate({ stay: true });
          }}
        />
      ) : null}
    </div>
  );
}
