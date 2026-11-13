import { createFileRoute, Link } from "@tanstack/react-router";
import { ChartLine, FileSearch, RefreshCw, Sparkles, Table2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { AuthSlot } from "@/components/meridian/auth-slot";
import { AdvisorSignInEnroll } from "@/components/auth/advisor-sign-in-enroll";
import { advisorMfaStatusFn, notifyAdvisorMfaChanged } from "@/lib/auth/advisor-mfa-api";
import { ProfileSwitcher } from "@/components/meridian/profile-switcher";
import { MACH_RESET_BASELINE } from "@/components/meridian/account-menu";
import { StaleRunPrompt } from "@/components/meridian/confirm-remove";
import { CalculateButton } from "@/components/meridian/calculate-button";
import { AdvisoryStrip } from "@/components/meridian/advisory-note";
import { CashChart, MonteCarloBandChart, NetWorthChart, WealthChart } from "@/components/meridian/charts";
import { BoydQuote, MonteCarloStaleNotice, PlanSurvival, readPlanSurvivalMinimized, RunMonteCarloButton, SurvivalChartNote, type SurvivalView } from "@/components/meridian/plan-survival";
import { useBoydQuotes } from "@/components/meridian/use-boyd-quotes";
import { Pinnable, useChartPins } from "@/components/meridian/chart-pin";
import { ContributionForm } from "@/components/meridian/contribution-form";
import { AssumptionsForm, GoalsForm, HouseholdForm } from "@/components/meridian/household-form";
import { IncomeForm } from "@/components/meridian/income-form";
import { KpiStrip } from "@/components/meridian/kpi-strip";
import { PortfolioForm } from "@/components/meridian/portfolio-form";
import { LiabilityForm } from "@/components/meridian/liability-form";
import { PeerBriefCard } from "@/components/meridian/peer-brief";
import { OodaAiCard } from "@/components/meridian/ooda-ai";
import type { OodaSurvivalFact } from "@/lib/ooda-ai/context";
import { Section, collapseAllOodSections } from "@/components/meridian/section";
import { SiteMenu } from "@/components/meridian/site-nav";
import { SpendingForm } from "@/components/meridian/spending-form";
import { Verdict } from "@/components/meridian/verdict";
import { YearTable } from "@/components/meridian/year-table";
import { MachFooter, BrandLockup, AuthCheckFooter } from "@/components/meridian/mach-mark";
import { MachOrbit } from "@/components/meridian/mach-orbit";
import { MatrixRain } from "@/components/meridian/matrix-rain";
import { isRealUser } from "@/lib/auth/gates";
import { readActPlace, writeActPlace, type ActTab } from "@/lib/act-place";
import { readActPlaceCookie } from "@/lib/act-place-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useGuestChrome } from "@/lib/auth/guest-chrome";
import { simulate } from "@/lib/plan/engine";
import { economicHash, runSurvival, type SurvivalScore } from "@/lib/plan/monte-carlo-run";
import { DEFAULT_SWING, type SwingName } from "@/lib/plan/monte-carlo";
import { refreshEstimatedSocialSecurity } from "@/lib/plan/social-security";
import { planInputSignature } from "@/lib/plan/input-signature";
import { buildPeerBrief, type PeerBrief } from "@/lib/plan/peers";
import { earliestWorkableRetirement } from "@/lib/plan/earliest-retirement";
import { usePlannerCopy } from "@/components/meridian/use-planner-copy";
import { usePlanStore } from "@/lib/plan/store";
import { createDefaultPlan } from "@/lib/plan/defaults";
import { planHasEntries } from "@/lib/plan/demo-plan";
import { MACH_PROFILE_REMOVED, useProfileStore } from "@/lib/plan/profile-store";
import { useCloudPlan } from "@/lib/plan/use-cloud-plan";
import { noteVisitor } from "@/lib/conversions/api";
import { quizOpenPending, takeQuizOpen } from "@/lib/plan/quiz-plan";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { hasBalanceSheet, isAdvisorPlan } from "@/lib/billing/limits";
import { getEntitlement } from "@/lib/billing/api";
import type { Plan, SimResult } from "@/lib/plan/types";
import {
  clearAllStoredRuns,
  clearStoredRun,
  loadStoredRuns,
  loadStoredSurvivals,
  saveStoredRun,
  saveStoredSurvival,
  setRunScope,
} from "@/lib/plan/last-run";
import { cn } from "@/lib/utils";
import { WelcomeEmailPreviewOverlay } from "@/components/meridian/welcome-email-preview";
import { EmailVerifyBanner } from "@/components/meridian/email-verify-banner";
import { PasswordLaterBanner } from "@/components/meridian/password-later-banner";
import { GuestHero, MilitaryHousehold } from "@/components/meridian/guest-hero";
import { useHeroCopy } from "@/components/meridian/use-hero-copy";
import { homeJsonLd, pageHead } from "@/lib/seo";
import { GhostButton, PrimaryButton } from "@/components/ui/field";

/** Charts need the months. Keep the ledger the year table reads, including the account balances. */
function simForCharts(sim: SimResult): SimResult {
  return {
    ...sim,
    months: sim.months.map((month) => {
      const detail = month.detail;
      if (!detail) {
        const { detail: _drop, ...rest } = month;
        return rest;
      }
      return {
        ...month,
        detail: {
          ordinaryTaxable: detail.ordinaryTaxable,
          ssBenefit: detail.ssBenefit,
          ssTaxable: detail.ssTaxable,
          rmdTaxable: detail.rmdTaxable,
          taxRatePct: detail.taxRatePct,
          spendingLines: detail.spendingLines,
          unallocatedSpent: detail.unallocatedSpent,
          cashOnHand: detail.cashOnHand,
          cashParked: detail.cashParked,
          cashDrawn: detail.cashDrawn,
          savedLines: detail.savedLines,
          sweep: detail.sweep,
          matchLines: detail.matchLines,
          drawnLines: detail.drawnLines,
          spendableLines: detail.spendableLines,
          netWorthLines: detail.netWorthLines,
        },
      };
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

export const Route = createFileRoute("/")({
  loader: async () => {
    if (typeof document !== "undefined") return { actPlace: readActPlace() };
    try {
      return { actPlace: await readActPlaceCookie() };
    } catch {
      return { actPlace: null as ActTab | null };
    }
  },
  head: () =>
    pageHead({
      title: "MACH RUN | The Supersonic Retirement Calculator",
      description:
        "See a household retirement in one place: income, TSP, military retired pay, VA, and a nest-egg goal. Free to start. Monte Carlo included.",
      path: "/",
      jsonLd: homeJsonLd,
    }),
  component: Home,
});

type BriefChart = "spendable" | "cash" | "net";

function PocketAces({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" overflow="visible" className={className} aria-hidden="true">
      <g transform="rotate(-14 7.4 12.2)">
        <rect x="1.5" y="3.8" width="11.4" height="16" rx="1.25" fill="#fff" stroke="#334155" strokeWidth="0.75" />
        <text
          x="2.5"
          y="8.15"
          fill="#1e293b"
          fontSize="4.4"
          fontWeight="700"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          A
        </text>
        <path
          fill="#1e293b"
          transform="translate(4.15 10.15) scale(0.62)"
          d="M5 .4C2.2 3.1.9 4.8.9 6.4c0 1.45 1.25 2.2 2.45 1.85C3.1 8.7 4.05 9.1 4.7 10.4 5.35 9.1 6.3 8.7 6.05 8.25 7.25 8.6 8.5 7.85 8.5 6.4 8.5 4.8 7.2 3.1 5 .4z"
        />
      </g>
      <g transform="rotate(14 16.6 12)">
        <rect x="10.8" y="3.2" width="11.4" height="16" rx="1.25" fill="#fff" stroke="#334155" strokeWidth="0.75" />
        <text
          x="11.8"
          y="7.55"
          fill="#c0392b"
          fontSize="4.4"
          fontWeight="700"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          A
        </text>
        <path
          fill="#c0392b"
          transform="translate(13.55 9.55) scale(0.62)"
          d="M5 9.2S.6 6.3.6 3.55C.6 2.15 1.7 1.2 2.95 1.2 4 1.2 4.6 1.75 5 2.35 5.4 1.75 6 1.2 7.05 1.2 8.3 1.2 9.4 2.15 9.4 3.55 9.4 6.3 5 9.2 5 9.2z"
        />
      </g>
    </svg>
  );
}

function JetBlast({ className, selected }: { className?: string; strokeWidth?: number; selected?: boolean }) {
  return (
    <img
      src={selected ? "/brand/takeoff-on-mark.png" : "/brand/takeoff-off-mark.png"}
      alt=""
      className={cn("object-contain", className)}
    />
  );
}

const ACT_TABS: { id: ActTab; label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: "brief", label: "Takeoff", icon: JetBlast },
  { id: "analysis", label: "Analysis", icon: FileSearch },
  { id: "charts", label: "Charts", icon: ChartLine },
  { id: "ledger", label: "Ledger", icon: Table2 },
  { id: "monte", label: "Monte Carlo", icon: PocketAces },
];

const BRIEF_CHARTS: { id: BriefChart; label: string; short: string }[] = [
  { id: "spendable", label: "Spendable Wealth", short: "Spendable" },
  { id: "cash", label: "Cash Flow", short: "Cash" },
  { id: "net", label: "Net Worth", short: "Net Worth" },
];

function ActChartColumn({
  plan,
  sim,
  tall,
  only,
  survival = null,
}: {
  plan: Plan;
  sim: SimResult;
  tall?: boolean;
  only?: BriefChart;
  survival?: SurvivalScore | null;
}) {
  const pins = useChartPins();
  const ent = useEntitlement();
  const unlocked = hasBalanceSheet(ent.plan);
  const show = (id: BriefChart) => !only || only === id;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {show("spendable") ? (
        <div ref={pins.wealthSlot}>
          <Pinnable pinned={pins.pinWealth} stackTop={pins.wealthTop}>
            <WealthChart
              plan={plan}
              sim={sim}
              pinned={pins.pinWealth}
              onPin={pins.toggleWealth}
              tall={tall}
              survival={survival}
            />
          </Pinnable>
        </div>
      ) : null}
      {show("cash") ? (
        <Pinnable pinned={pins.pinCash} stackTop={pins.cashTop}>
          <CashChart
            plan={plan}
            sim={sim}
            pinned={pins.pinCash}
            onPin={pins.toggleCash}
            tall={tall}
            survival={survival}
          />
        </Pinnable>
      ) : null}
      {show("net") ? (
        <NetWorthChart plan={plan} sim={sim} locked={!unlocked} tall={tall} survival={survival} />
      ) : null}
    </div>
  );
}

function ActTabButton({
  label,
  icon: Icon,
  on,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number; selected?: boolean }>;
  on: boolean;
  onClick: () => void;
}) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  function place(el: HTMLButtonElement) {
    const r = el.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.bottom + 8 });
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      onMouseEnter={(e) => place(e.currentTarget)}
      onMouseLeave={() => setTip(null)}
      onFocus={(e) => place(e.currentTarget)}
      onBlur={() => setTip(null)}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl min-[72rem]:h-14 min-[72rem]:w-14",
        on ? "bg-canopy text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <Icon
        selected={on}
        className={
          label === "Monte Carlo"
            ? "size-8 min-[72rem]:size-9"
            : label === "Takeoff"
              ? "size-8 min-[72rem]:size-10"
              : "size-6 min-[72rem]:size-7"
        }
        strokeWidth={1.75}
      />
      {tip ? (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[80] -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg"
          style={{ left: Math.min(Math.max(tip.x, 36), window.innerWidth - 36), top: tip.y }}
        >
          {label}
        </span>
      ) : null}
    </button>
  );
}

function ExecuteMachRunButton({ onExecute, onArm }: { onExecute: () => void; onArm?: () => void }) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  function place(el: HTMLButtonElement) {
    const r = el.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.bottom + 8 });
  }
  return (
    <button
      type="button"
      data-mach-execute=""
      aria-label="Execute MACH RUN"
      onMouseDown={() => onArm?.()}
      onClick={onExecute}
      onMouseEnter={(e) => place(e.currentTarget)}
      onMouseLeave={() => setTip(null)}
      onFocus={(e) => place(e.currentTarget)}
      onBlur={() => setTip(null)}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 min-[72rem]:h-14 min-[72rem]:w-14"
    >
      <RefreshCw className="size-6 min-[72rem]:size-7" strokeWidth={1.75} />
      {tip ? (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[80] -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg"
          style={{ left: Math.min(Math.max(tip.x, 88), window.innerWidth - 88), top: tip.y }}
        >
          Execute MACH RUN
        </span>
      ) : null}
    </button>
  );
}

function OodaRail({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  function place(el: HTMLButtonElement) {
    const r = el.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.bottom + 8 });
  }
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label="OODA AI"
      onClick={onToggle}
      onMouseEnter={(e) => place(e.currentTarget)}
      onMouseLeave={() => setTip(null)}
      onFocus={(e) => place(e.currentTarget)}
      onBlur={() => setTip(null)}
      className={cn(
        "fixed z-[24] mt-5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl right-2 top-[calc(var(--mach-header-h,7rem)+0.75rem+50px)] min-[72rem]:relative min-[72rem]:right-auto min-[72rem]:top-auto min-[72rem]:h-14 min-[72rem]:w-14",
        open ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <Sparkles className="size-6 min-[72rem]:size-7" strokeWidth={1.75} />
      {tip && !open ? (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[80] -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg"
          style={{ left: Math.min(Math.max(tip.x, 48), window.innerWidth - 48), top: tip.y }}
        >
          OODA AI
        </span>
      ) : null}
    </button>
  );
}

function OodaDrawer({
  open,
  onClose,
  plan,
  sim,
  brief,
  survival,
}: {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  sim: SimResult;
  brief: PeerBrief;
  survival: OodaSurvivalFact | null;
}) {
  return (
    <div
      role="dialog"
      aria-label="OODA AI"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed z-20 h-max max-h-[calc(100dvh-var(--mach-header-h,7rem)-1.5rem)] overflow-y-auto rounded-xl border border-[#c5ccd6] bg-surface shadow-[0_18px_40px_rgba(26,35,48,0.28),0_4px_10px_rgba(26,35,48,0.12)] top-[calc(var(--mach-header-h,7rem)+0.75rem)] max-[71.99rem]:inset-x-3 max-[71.99rem]:w-auto min-[72rem]:absolute min-[72rem]:inset-x-auto min-[72rem]:top-0 min-[72rem]:right-[calc(100%+0.5rem)] min-[72rem]:w-[min(24rem,calc(100vw-6rem))]",
        open ? "" : "hidden",
      )}
    >
      <OodaAiCard plan={plan} sim={sim} brief={brief} survival={survival} />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close OODA AI"
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ×
        </span>
      </button>
    </div>
  );
}

function MonteCarloTab({
  unlocked,
  real,
  longevityAge,
  score,
  running,
  progress,
  onRun,
  plan,
  sim,
  stale,
}: {
  unlocked: boolean;
  real: boolean;
  longevityAge: number;
  score: SurvivalScore | null;
  running: boolean;
  progress: number;
  onRun: () => void;
  plan: Plan;
  sim: SimResult;
  stale: boolean;
}) {
  const quotes = useBoydQuotes();
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PhaseLabel id="ooda-monte" label="Monte Carlo" />
      {stale && score ? <MonteCarloStaleNotice onRun={onRun} /> : null}
      <div className="relative">
        {unlocked && score && score.bands.length > 0 ? (
          <MonteCarloBandChart
            bands={score.bands}
            traces={score.traces}
            real={real}
            plan={plan}
            sim={sim}
            survival={score}
            note={
              <SurvivalChartNote plan={plan} score={score} longevityAge={longevityAge} />
            }
          />
        ) : (
          <div className="relative flex h-[32rem] flex-col items-center justify-center gap-6 overflow-hidden rounded-xl bg-white px-6 text-center shadow-[0_0_0_1px_#c8d2de] sm:h-[40rem]">
            {running && unlocked ? <MatrixRain /> : null}
            <div className="relative z-10 flex w-full flex-col items-center gap-6">
            {unlocked && quotes.length > 0 ? (
              <BoydQuote quotes={quotes} pulse={running} large progress={running ? progress : 0} />
            ) : running ? (
              <p className="max-w-sm text-sm leading-relaxed text-slate-600">Checking 1,000 futures…</p>
            ) : null}
            {running && unlocked ? (
              <MachOrbit compact monte />
            ) : (
              <p className="max-w-sm text-sm leading-relaxed text-slate-600">
                Run it to see 1,000 possible futures for the money you can spend.
              </p>
            )}
            </div>
          </div>
        )}
        {unlocked ? null : (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-canopy/70 p-5">
            <p className="max-w-none px-2 text-center text-xs font-medium leading-relaxed text-white sm:text-sm">
              <span className="block">Unlock Plan Survival (Monte Carlo Simulations) with</span>
              <Link
                to="/pricing"
                className="text-[#e8c547] underline decoration-[#e8c547]/80 underline-offset-4 hover:text-[#f6e7b0]"
              >
                Individual Unlimited or Advisor
              </Link>
            </p>
          </div>
        )}
      </div>
      {unlocked ? (
        <RunMonteCarloButton
          running={running}
          progress={running ? progress : 0}
          again={!running && Boolean(score)}
          onClick={onRun}
        />
      ) : null}
    </div>
  );
}

const PAGES = [
  { id: "family", phase: "observe" },
  { id: "assets", phase: "observe" },
  { id: "liabilities", phase: "observe" },
  { id: "assumptions", phase: "observe" },
  { id: "income", phase: "orient" },
  { id: "spending", phase: "orient" },
  { id: "goals", phase: "decide" },
  { id: "contributions", phase: "decide" },
  { id: "act", phase: "act" },
] as const;

type StepId = (typeof PAGES)[number]["id"];

/** Yellow until the page has one real entry, then the site green. */
function pageStarted(plan: Plan, id: StepId, calculated: boolean): boolean {
  const a = plan.assumptions;
  const blank = createDefaultPlan().assumptions;
  switch (id) {
    case "family":
      return Boolean(
        plan.primary.name.trim() ||
          plan.primary.birthDate ||
          plan.spouse.name.trim() ||
          plan.spouse.birthDate ||
          plan.children.length,
      );
    case "goals":
      return Boolean(
        a.retirementGoalDate ||
          (a.nestEggGoal != null && a.nestEggGoal > 0) ||
          (a.goalMode === "income" && (a.incomeGoalMonthly ?? 0) > 0) ||
          a.asOfPinned ||
          a.projectionEndAge !== blank.projectionEndAge,
      );
    case "assumptions":
      return Boolean(
        a.sweepChosen ||
          a.sweepPortfolioId ||
          a.inflationPct !== blank.inflationPct ||
          a.defaultColaPct !== blank.defaultColaPct ||
          a.defaultReturnPct !== blank.defaultReturnPct ||
          a.retirementReturnPct !== blank.retirementReturnPct ||
          a.ordinaryTaxRatePct !== blank.ordinaryTaxRatePct ||
          a.ssTaxablePct !== blank.ssTaxablePct,
      );
    case "assets":
      return plan.portfolios.length > 0;
    case "liabilities":
      return (plan.liabilities?.length ?? 0) > 0 || plan.noLiabilities === true;
    case "income":
      return plan.incomes.length > 0;
    case "spending":
      return plan.spending.some((row) => !row.liabilityId);
    case "contributions":
      return plan.contributions.length > 0;
    case "act":
      return calculated;
  }
}

const PHASES = [
  { id: "observe", label: "Observe", page: "family" },
  { id: "orient", label: "Orient", page: "income" },
  { id: "decide", label: "Decide", page: "goals" },
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
        "scroll-mt-40 font-display text-lg font-semibold uppercase tracking-[0.12em] text-[#3a8a58] sm:text-xl",
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
      className="scroll-mt-40 font-display text-lg font-semibold uppercase tracking-[0.12em] text-[#3a8a58] sm:text-xl"
    >
      <span className="uppercase">Act</span>
    </p>
  );
}

function DollarViewToggle({
  real,
  onReal,
  onNominal,
}: {
  real: boolean;
  onReal: () => void;
  onNominal: () => void;
}) {
  const item =
    "h-7 rounded px-2 font-display text-sm font-semibold uppercase leading-none tracking-[0.06em]";
  return (
    <div className="inline-flex shrink-0 items-center rounded-md bg-white p-0.5 shadow-[0_0_0_1px_#d5d0c6]">
      <button
        type="button"
        aria-pressed={real}
        onClick={onReal}
        className={cn(item, real ? "bg-[#3a8a58] text-white" : "text-muted hover:text-fg")}
      >
        Today $
      </button>
      <button
        type="button"
        aria-pressed={!real}
        onClick={onNominal}
        className={cn(item, !real ? "bg-[#3a8a58] text-white" : "text-muted hover:text-fg")}
      >
        Future $
      </button>
    </div>
  );
}

const OBSERVE_TABS = [
  { id: "family", label: "Family" },
  { id: "assets", label: "Assets" },
  { id: "liabilities", label: "Liabilities" },
  { id: "assumptions", label: "Assumptions" },
] as const;

const ORIENT_TABS = [
  { id: "income", label: "Income" },
  { id: "spending", label: "Spending" },
] as const;

const DECIDE_TABS = [
  { id: "goals", label: "Goals" },
  { id: "contributions", label: "Contributions" },
] as const;

function PhaseFolderTabs({
  name,
  tabs,
  active,
  onPick,
  face = "surface",
}: {
  name: string;
  tabs: readonly { id: StepId; label: string }[];
  active: StepId;
  onPick: (id: StepId) => void;
  face?: "surface" | "white";
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
                ? face === "white"
                  ? "z-10 bg-white pb-2.5 pt-2 text-[#1a2330] shadow-[0_-1px_0_0_#d5d0c6,1px_0_0_0_#d5d0c6,-1px_0_0_0_#d5d0c6]"
                  : "z-10 bg-surface pb-2.5 pt-2 text-fg shadow-[0_-1px_0_0_var(--color-border),1px_0_0_0_var(--color-border),-1px_0_0_0_var(--color-border)]"
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

function WhiteStep({
  id,
  phase,
  title,
  tabs,
  nav,
  narrow,
  children,
}: {
  id: string;
  phase: string;
  title: string;
  tabs: ReactNode;
  nav: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <PhaseHead id={id} label={phase} tabs={tabs} />
      <section className="rounded-xl bg-white px-4 pb-6 pt-7 shadow-[0_0_0_1px_#d5d0c6] sm:px-8 sm:pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="min-w-0 font-sans text-[1.35rem] font-medium leading-tight text-[#1a2330] sm:text-[1.65rem]">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">{nav}</div>
        </div>
        {narrow ? <div className="mx-auto w-full max-w-lg">{children}</div> : children}
      </section>
    </>
  );
}

const HEADER_COLLAPSE_KEY = "mach-header-collapsed";

function OodaPhaseBar({
  compact,
  shown,
  shownPhase,
  shownIndex,
  onPick,
  plan,
  hasRun,
}: {
  compact?: boolean;
  shown: StepId;
  shownPhase: string;
  shownIndex: number;
  onPick: (page: StepId) => void;
  plan: Plan;
  hasRun: boolean;
}) {
  return (
    <>
      {PHASES.map((item) => {
        const pages = PAGES.filter((page) => page.phase === item.id);
        const here = pages.findIndex((page) => page.id === shown);
        return (
          <button
            key={item.id}
            type="button"
            aria-current={shownPhase === item.id ? "step" : undefined}
            aria-label={here >= 0 ? `${item.label}, ${here + 1} of ${pages.length}` : item.label}
            onClick={() => onPick(item.page)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center whitespace-nowrap rounded-md font-medium uppercase",
              compact
                ? "gap-0.5 px-0.5 py-1 text-[9px] tracking-[0.02em] sm:text-[10px]"
                : "gap-1 px-0.5 py-1.5 text-[10px] tracking-[0.04em] sm:px-1 sm:text-xs sm:tracking-[0.08em] md:text-sm md:tracking-[0.14em]",
              shownPhase === item.id ? "bg-accent text-accent-fg" : "text-muted",
            )}
          >
            <span>{item.label}</span>
            <span className="flex items-center gap-1 [--color-accent:#3a8a58]" aria-hidden="true">
              {pages.map((page) => {
                const index = PAGES.findIndex((entry) => entry.id === page.id);
                const on = index === shownIndex;
                const done = pageStarted(plan, page.id, hasRun);
                return (
                  <span
                    key={page.id}
                    className={cn(
                      "inline-block shrink-0 rounded-full",
                      done ? "bg-accent" : "bg-[#e8c547]",
                      compact ? (on ? "h-1.5 w-1.5" : "h-1 w-1") : on ? "h-2 w-2" : "h-1.5 w-1.5",
                    )}
                  />
                );
              })}
            </span>
          </button>
        );
      })}
    </>
  );
}

function readHeaderCollapsed() {
  try {
    return window.localStorage.getItem(HEADER_COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function Home() {
  const { actPlace } = Route.useLoaderData();
  const plan = usePlanStore((s) => s.plan);
  const boydQuotes = useBoydQuotes();
  const heroCopy = useHeroCopy();
  const boydPick = useRef(Math.floor(Math.random() * Math.max(boydQuotes.length, 1)));
  const boydLine = boydQuotes[boydPick.current % Math.max(boydQuotes.length, 1)] ?? "";
  const copy = usePlannerCopy();
  const patchAssumptions = usePlanStore((s) => s.patchAssumptions);
  const { status: saveStatus, saveNow } = useCloudPlan();
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user?.id);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [cautionAck, setCautionAck] = useState(false);
  const [headerSettled, setHeaderSettled] = useState(true);
  const headerCollapsedRef = useRef(false);
  const headerSettleTimer = useRef<number | null>(null);
  const headerHoldUntil = useRef(0);
  const collapsedHeaderRef = useRef<HTMLDivElement>(null);
  const expandedHeaderRef = useRef<HTMLDivElement>(null);
  const [headerBox, setHeaderBox] = useState<number | null>(null);
  const headerBoxReady = useRef(false);
  useEffect(() => {
    const stored = readHeaderCollapsed();
    headerCollapsedRef.current = stored;
    setHeaderCollapsed(stored);
  }, []);
  function writeHeaderCollapsed(next: boolean) {
    try {
      if (next) window.localStorage.setItem(HEADER_COLLAPSE_KEY, "1");
      else window.localStorage.removeItem(HEADER_COLLAPSE_KEY);
    } catch {
      /* private mode */
    }
  }
  function commitHeader(next: boolean) {
    if (headerCollapsedRef.current === next) return;
    headerCollapsedRef.current = next;
    writeHeaderCollapsed(next);
    if (headerSettleTimer.current != null) window.clearTimeout(headerSettleTimer.current);
    setHeaderSettled(false);
    setHeaderCollapsed(next);
    headerSettleTimer.current = window.setTimeout(() => {
      setHeaderSettled(true);
      headerSettleTimer.current = null;
    }, 520);
  }
  function toggleHeader() {
    headerHoldUntil.current = performance.now() + 900;
    commitHeader(!headerCollapsedRef.current);
  }
  const ent = useEntitlement();
  const [step, setStep] = useState<StepId>(actPlace ? "act" : "family");
  const sheet = hasBalanceSheet(ent.plan);
  const survivalOn = sheet || (ent.pending && signedIn);
  const route = PAGES;
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
  const executing = useRef(false);
  const [armTick, setArmTick] = useState(0);
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
  const [survival, setSurvival] = useState<Record<string, SurvivalView>>({});
  const survivalTask = useRef<{
    key: string;
    runId: number;
    snapshot: Plan;
    controller: AbortController;
    timer: number | null;
  } | null>(null);
  const survivalView = survival[runKey] ?? null;
  const survivalScore =
    sheet && survivalView && survivalView.status !== "idle" && survivalView.status !== "empty"
      ? survivalView.score
      : null;
  const survivalRunning = Boolean(sheet && survivalView?.status === "running");
  const survivalStale = Boolean(
    survivalView?.score && economicHash(plan, survivalView.swing) !== survivalView.score.hash,
  );
  const [survivalMinimized, setSurvivalMinimized] = useState(readPlanSurvivalMinimized);
  const [actTab, setActTab] = useState<ActTab>(actPlace ?? "brief");
  const [actBoot, setActBoot] = useState<"wait" | "ready">("wait");
  const [actPlaceSettled, setActPlaceSettled] = useState(false);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [profilesReady, setProfilesReady] = useState(false);
  const restoredAct = useRef(false);
  const [briefChart, setBriefChart] = useState<BriefChart>("spendable");
  const [oodaOpen, setOodaOpen] = useState(false);
  useLayoutEffect(() => {
    const place = readActPlace();
    if (place) {
      restoredAct.current = true;
      setActTab(place);
      setStep("act");
    }
    setActBoot("ready");
  }, []);

  useEffect(() => {
    if (actBoot !== "ready") return;
    if (step === "act") writeActPlace(actTab);
    else writeActPlace(null);
  }, [actBoot, step, actTab]);

  useEffect(() => {
    if (useProfileStore.persist.hasHydrated()) {
      setProfilesReady(true);
      return;
    }
    return useProfileStore.persist.onFinishHydration(() => setProfilesReady(true));
  }, []);

  useEffect(() => {
    if (!restoredAct.current || actPlaceSettled) return;
    if (actBoot !== "ready" || isPending || !runsLoaded) return;
    if (!signedIn) {
      writeActPlace(null);
      restoredAct.current = false;
      setActTab("brief");
      setStep("family");
      setActPlaceSettled(true);
      return;
    }
    if (!profilesReady) return;
    const key = activeProfileId || "local";
    if (!runs[key]) {
      writeActPlace(null);
      restoredAct.current = false;
      setActTab("brief");
      setStep("family");
    }
    setActPlaceSettled(true);
  }, [
    actBoot,
    actPlaceSettled,
    isPending,
    runsLoaded,
    signedIn,
    profilesReady,
    activeProfileId,
    runs,
  ]);
  const simulatorFull = sheet
    ? Boolean(survivalView && survivalView.status !== "empty" && survivalView.open)
    : !survivalMinimized;
  const survivalRef = useRef(survival);
  survivalRef.current = survival;

  useEffect(() => {
    collapseAllOodSections();
  }, []);

  useEffect(() => {
    if (!oodaOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOodaOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [oodaOpen]);

  const paidRef = useRef(ent.paid);
  paidRef.current = ent.paid;

  useEffect(() => {
    if (isPending) return;
    if (!signedIn) {
      setRunScope(null);
      setRuns({});
      survivalTask.current?.controller.abort();
      survivalTask.current = null;
      setSurvival({});
      setRunsLoaded(true);
      return;
    }
    setRunScope(user?.id ?? null);
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
          brief: buildPeerBrief(row.plan, sim, { expanded: paidRef.current, recommended }),
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
    const storedSurvival = loadStoredSurvivals();
    setSurvival((prev) => {
      const next = { ...prev };
      for (const [key, score] of Object.entries(storedSurvival)) {
        const cur = next[key];
        if (cur?.score || cur?.status === "running") continue;
        next[key] = {
          runId: loaded[key]?.id ?? 0,
          status: "ready",
          score,
          swing: score.swing,
          open: cur?.open ?? true,
          pass: 0,
          progress: 0,
        };
      }
      return next;
    });
    setRunsLoaded(true);
  }, [isPending, signedIn, user?.id]);

  useEffect(() => {
    function onReset() {
      setRuns({});
      setRunError(null);
      survivalTask.current?.controller.abort();
      survivalTask.current = null;
      setSurvival({});
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
      if (survivalTask.current?.key === id) {
        survivalTask.current.controller.abort();
        survivalTask.current = null;
      }
      setSurvival((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    window.addEventListener(MACH_PROFILE_REMOVED, onRemoved);
    return () => {
      window.removeEventListener(MACH_RESET_BASELINE, onReset);
      window.removeEventListener(MACH_PROFILE_REMOVED, onRemoved);
      survivalTask.current?.controller.abort();
    };
  }, []);

  const displayPlan = run
    ? {
        ...run.plan,
        assumptions: { ...run.plan.assumptions, dollars: plan.assumptions.dollars },
      }
    : plan;
  const real = plan.assumptions.dollars === "real";

  useEffect(() => {
    setRunError(null);
  }, [runKey]);

  const liveSig = inputSignature(plan);

  useEffect(() => {
    if (step !== "act") {
      dismissedStale.current = null;
      executing.current = false;
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
      executing.current = false;
      dismissedStale.current = null;
      setStalePrompt(false);
      return;
    }
    if (holding || executing.current) return;
    if (dismissedStale.current === liveSig) return;
    setStalePrompt(true);
  }, [step, runKey, runs, holding, liveSig, armTick]);

  function armExecute() {
    executing.current = true;
  }

  useEffect(() => {
    function onUp(event: MouseEvent) {
      const target = event.target;
      const armed = target instanceof Element && Boolean(target.closest("[data-mach-execute]"));
      window.setTimeout(() => {
        if (armed) return;
        if (!executing.current) return;
        executing.current = false;
        setArmTick((tick) => tick + 1);
      }, 0);
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  useEffect(() => {
    if (!ent.paid || !runsLoaded) return;
    setRuns((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [key, row] of Object.entries(prev)) {
        if (!row.brief || row.brief.expanded) continue;
        next[key] = { ...row, brief: { ...row.brief, expanded: true } };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [ent.paid, runsLoaded]);

  const guestChrome = useGuestChrome(user?.primaryEmail);
  const heroOn = !isRealUser(user) || guestChrome;
  const advisor = isAdvisorPlan(ent.plan);
  const [advisorProof, setAdvisorProof] = useState<
    { enrolled: boolean; proven: boolean } | "fail" | null
  >(null);
  const [advisorProofTick, setAdvisorProofTick] = useState(0);
  useEffect(() => {
    if (!advisor) return;
    let live = true;
    void advisorMfaStatusFn()
      .then((status) => {
        if (live) setAdvisorProof(status);
      })
      .catch(() => {
        if (live) setAdvisorProof("fail");
      });
    return () => {
      live = false;
    };
  }, [advisor, advisorProofTick]);
  const advisorNeedsCheck =
    advisor &&
    advisorProof != null &&
    (advisorProof === "fail" || !advisorProof.enrolled || !advisorProof.proven);
  const advisorPlanHeld = (advisor && advisorProof == null) || advisorNeedsCheck;
  const [demoLoaded, setDemoLoaded] = useState(false);
  const demoNoted = useRef(false);
  const stepsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (advisorNeedsCheck) return;
    const el = headerCollapsed ? collapsedHeaderRef.current : expandedHeaderRef.current;
    if (!el) return;
    const next = el.offsetHeight;
    if (!headerBoxReady.current) {
      headerBoxReady.current = true;
      setHeaderBox(next);
      return;
    }
    const id = window.requestAnimationFrame(() => setHeaderBox(next));
    return () => window.cancelAnimationFrame(id);
  }, [headerCollapsed, advisorNeedsCheck, signedIn, advisorPlanHeld]);
  useEffect(() => {
    if (advisorNeedsCheck) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [advisorNeedsCheck]);

  useEffect(() => {
    if (advisorNeedsCheck) return;
    const header = document.getElementById("mach-header");
    if (!header || typeof ResizeObserver === "undefined") return;
    const sync = () => {
      try {
        const caution = document.getElementById("master-caution");
        const headerPx = Math.ceil(header.getBoundingClientRect().height);
        const chrome = headerPx + Math.ceil(caution?.getBoundingClientRect().height ?? 0);
        const root = document.documentElement.style;
        const chromeValue = `${chrome}px`;
        const headerValue = `${headerPx}px`;
        if (root.getPropertyValue("--mach-header-h") !== chromeValue) {
          root.setProperty("--mach-header-h", chromeValue);
        }
        if (root.getPropertyValue("--header-h") !== headerValue) root.setProperty("--header-h", headerValue);
      } catch {
        /* ignore */
      }
    };
    const ro = new ResizeObserver(sync);
    const seen = new Set<Element>();
    const watch = (node: Element | null) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      ro.observe(node);
    };
    watch(header);
    watch(document.getElementById("master-caution"));
    const mo = new MutationObserver(() => watch(document.getElementById("master-caution")));
    if (header.parentElement) mo.observe(header.parentElement, { childList: true });
    sync();
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [advisorNeedsCheck]);

  useEffect(() => {
    if (advisorNeedsCheck) return;
    const steps = stepsRef.current;
    if (!steps) return;
    const scroller: HTMLDivElement = steps;
    const mq = window.matchMedia("(max-width: 1400px)");
    let last = scroller.scrollTop;
    let fingerDown = false;
    let idleTimer: number | null = null;

    function onPointerDown() {
      fingerDown = true;
    }
    function onPointerUp() {
      fingerDown = false;
      if (idleTimer != null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(expandIfAtTop, 180);
    }
    function expandIfAtTop() {
      idleTimer = null;
      if (fingerDown) return;
      if (!mq.matches) return;
      if (performance.now() < headerHoldUntil.current) return;
      if (scroller.scrollTop <= 1) commitHeader(false);
    }
    function onScroll() {
      const y = scroller.scrollTop;
      if (performance.now() < headerHoldUntil.current) {
        last = y;
        return;
      }
      const delta = y - last;
      last = y;
      if (!mq.matches) return;
      if (delta > 12 && y > 48) commitHeader(true);
      if (idleTimer != null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(expandIfAtTop, 180);
    }
    function onRange(event: MediaQueryListEvent) {
      if (!event.matches) commitHeader(false);
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    mq.addEventListener("change", onRange);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      mq.removeEventListener("change", onRange);
      if (idleTimer != null) window.clearTimeout(idleTimer);
    };
  }, [advisorNeedsCheck]);

  const cautionLive = heroOn && planHasEntries(plan);

  useEffect(() => {
    if (!cautionLive) setCautionAck(false);
  }, [cautionLive]);

  function scrollStepToTop() {
    headerHoldUntil.current = performance.now() + 500;
    const steps = stepsRef.current;
    if (!steps) return;
    const main = steps.querySelector("main");
    if (heroOn && main) {
      const top = main.getBoundingClientRect().top - steps.getBoundingClientRect().top + steps.scrollTop;
      steps.scrollTo(0, Math.max(0, top));
      return;
    }
    steps.scrollTo(0, 0);
  }

  useEffect(() => {
    if (!quizOpenPending()) return;
    let place: "family" | "income" | null = null;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const pageUp = Boolean(
        document.getElementById("master-caution") ||
          document.getElementById("ooda-observe") ||
          document.getElementById("ooda-orient"),
      );
      if (!place) {
        if (!pageUp) {
          if (tries > 100) window.clearInterval(timer);
          return;
        }
        place = takeQuizOpen();
        if (!place) {
          window.clearInterval(timer);
          return;
        }
        setStep(place);
        return;
      }
      const target = document.getElementById(place === "income" ? "ooda-orient" : "ooda-observe");
      const scroller = stepsRef.current;
      if (!target || !scroller || target.getClientRects().length === 0) {
        if (tries > 100) window.clearInterval(timer);
        return;
      }
      const top =
        target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      if (Math.abs(target.getBoundingClientRect().top - scroller.getBoundingClientRect().top) > 20) {
        scroller.scrollTo(0, Math.max(0, top - 8));
      }
      window.clearInterval(timer);
    }, 120);
    return () => window.clearInterval(timer);
  }, [heroOn, advisorPlanHeld]);

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

  function startPlanSurvival(
    key: string,
    runId: number,
    snapshot: Plan,
    swing: SwingName,
    open: boolean,
    quiet = false,
  ) {
    survivalTask.current?.controller.abort();
    if (survivalTask.current?.timer != null) window.clearTimeout(survivalTask.current.timer);
    survivalTask.current = null;
    if (!hasBalanceSheet(ent.plan)) {
      setSurvival((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    const controller = new AbortController();
    const signal = controller.signal;
    if (!quiet) {
      setSurvival((prev) => ({
        ...prev,
        [key]: {
          runId,
          status: "running",
          score: prev[key]?.score ?? null,
          swing,
          open,
          pass: (prev[key]?.pass ?? 0) + 1,
          progress: 0,
          live: null,
        },
      }));
    }
    const begin = () => {
      if (survivalTask.current?.controller !== controller) return;
      void runSurvival(snapshot, swing, {
        signal,
        onProgress: (done, paths, traces) => {
          if (survivalTask.current?.controller !== controller) return;
          const progress = paths > 0 ? done / paths : 0;
          setSurvival((prev) => {
            const cur = prev[key];
            if (!cur || cur.status !== "running") return prev;
            return { ...prev, [key]: { ...cur, progress, live: traces } };
          });
        },
      }).then(
        (score) => {
          if (survivalTask.current?.controller !== controller) return;
          const drop = signal.aborted || !score || score.hash !== economicHash(snapshot, swing);
          if (!drop && score) saveStoredSurvival(key, score);
          setSurvival((prev) => {
            const cur = prev[key];
            if (cur && cur.runId !== runId) return prev;
            if (drop || !score) {
              if (cur?.score) {
                return { ...prev, [key]: { ...cur, status: "ready", progress: 0 } };
              }
              const next: SurvivalView = {
                runId,
                status: "empty",
                score: null,
                swing: cur?.swing ?? swing,
                open: cur?.open ?? open,
                pass: cur?.pass ?? 0,
                progress: 0,
              };
              return { ...prev, [key]: next };
            }
            const ready: SurvivalView = {
              runId,
              status: "ready",
              score,
              swing: score.swing,
              open: cur?.open ?? open,
              pass: cur?.pass ?? 0,
              progress: 0,
            };
            return { ...prev, [key]: ready };
          });
        },
        () => {
          if (survivalTask.current?.controller !== controller) return;
          setSurvival((prev) => {
            const cur = prev[key];
            if (cur && cur.runId !== runId) return prev;
            if (cur?.score) {
              return { ...prev, [key]: { ...cur, status: "ready", progress: 0 } };
            }
            const next: SurvivalView = {
              runId,
              status: "empty",
              score: null,
              swing: cur?.swing ?? swing,
              open: cur?.open ?? open,
              pass: cur?.pass ?? 0,
              progress: 0,
            };
            return { ...prev, [key]: next };
          });
        },
      );
    };
    // The first batch of futures blocks the thread. Paint the quote first.
    const timer = window.setTimeout(begin, 0);
    survivalTask.current = { key, runId, snapshot, controller, timer };
  }

  function chooseSwing(swing: SwingName) {
    if (!hasBalanceSheet(ent.plan)) return;
    setSurvival((prev) => {
      const view = prev[runKey];
      if (!view || view.status === "empty" || view.swing === swing) return prev;
      return { ...prev, [runKey]: { ...view, swing } };
    });
  }

  function runMonteCarlo() {
    if (!hasBalanceSheet(ent.plan)) return;
    const view = survival[runKey];
    if (!view || view.status === "empty" || view.status === "running") return;
    const current = runs[runKey];
    if (!current) return;
    const snapshot = structuredClone(usePlanStore.getState().plan) as Plan;
    startPlanSurvival(runKey, current.id, snapshot, view.swing, true);
  }

  function setSurvivalOpen(open: boolean) {
    setSurvival((prev) => {
      const cur = prev[runKey];
      if (!cur || cur.status === "empty") return prev;
      return { ...prev, [runKey]: { ...cur, open } };
    });
  }

  const savedRunId = run?.id;
  const runsRef = useRef(runs);
  runsRef.current = runs;
  useEffect(() => {
    if (!sheet || savedRunId == null) return;
    const key = runKey;
    const view = survivalRef.current[key];
    if (view?.score) {
      if (view.runId === savedRunId) return;
      const executed = runsRef.current[key];
      if (
        executed &&
        view.swing === view.score.swing &&
        view.score.hash === economicHash(executed.plan, view.score.swing)
      ) {
        setSurvival((prev) => {
          const cur = prev[key];
          if (!cur?.score || cur.runId === savedRunId) return prev;
          return { ...prev, [key]: { ...cur, runId: savedRunId, status: cur.status === "running" ? "running" : "ready" } };
        });
      }
      return;
    }
    if (view && view.runId === savedRunId) return;
    if (survivalTask.current?.key === key) return;
    setSurvival((prev) => {
      const cur = prev[key];
      if (cur?.score || cur?.status === "running") return prev;
      if (cur && cur.runId === savedRunId) return prev;
      return {
        ...prev,
        [key]: {
          runId: savedRunId,
          status: "idle",
          score: null,
          swing: cur?.swing ?? DEFAULT_SWING,
          open: cur?.open ?? true,
          pass: 0,
          progress: 0,
        },
      };
    });
  }, [sheet, runKey, savedRunId]);

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

  const inputFrame =
    "mx-auto flex w-full max-w-6xl flex-col gap-3 2xl:max-w-[90rem] min-[2000px]:max-w-[110rem]";
  const shell = "flex w-full flex-col";
  const familyPane = pane("family", shell);
  const goalsPane = pane("goals", shell);
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
    if (!demoNoted.current) {
      demoNoted.current = true;
      void noteVisitor({ data: { event: "demo" } }).catch(() => undefined);
    }
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

  if (advisorNeedsCheck) {
    return (
      <div className="flex min-h-screen flex-col bg-bg text-fg">
        <div className="flex flex-1 flex-col items-center px-4 py-10">
          <Link to="/" aria-label="MACH RUN">
            <img
              src="/brand/mach-run-logo.jpg"
              alt="MACH RUN"
              width={887}
              height={271}
              className="h-11 w-auto"
            />
          </Link>
          <div
            className="mt-10 w-[28.6rem] max-w-[calc(100vw-2rem)] rounded-xl p-6 shadow-[0_12px_40px_rgba(26,35,48,0.28),0_0_0_1px_#3a4652]"
            style={{
              backgroundColor: "#2c3a48",
              color: "#d7dde4",
              ["--color-fg" as string]: "#e8edf1",
              ["--color-muted" as string]: "#b8c3cd",
              ["--color-subtle" as string]: "#9aa7b3",
              ["--color-border" as string]: "#3a4652",
              ["--color-surface" as string]: "#243040",
              ["--color-elevated" as string]: "#2c3a48",
              ["--color-accent" as string]: "#d7dde4",
              ["--color-accent-fg" as string]: "#1a2330",
            }}
          >
            {advisor && advisorProof && advisorProof !== "fail" ? (
              <AdvisorSignInEnroll
                alreadyOn={advisorProof.enrolled}
                onEnrolled={() => {
                  notifyAdvisorMfaChanged();
                  setAdvisorProofTick((n) => n + 1);
                }}
                onTurnedOff={() => {
                  notifyAdvisorMfaChanged();
                  setAdvisorProofTick((n) => n + 1);
                }}
              />
            ) : (
              <p className="text-sm text-muted">Checking this sign-in.</p>
            )}
          </div>
        </div>
        <AuthCheckFooter />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg pb-[env(safe-area-inset-bottom)] text-fg">
      <WelcomeEmailPreviewOverlay />
      <header
        id="mach-header"
        className="canopy-bar relative z-30 shrink-0 border-b border-border"
      >
        <div
          className={cn(
            "relative transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            headerSettled ? "overflow-visible" : "overflow-hidden",
          )}
          style={headerBox != null ? { height: headerBox } : undefined}
        >
          <div
            ref={collapsedHeaderRef}
            className={cn(headerCollapsed ? "relative" : "pointer-events-none absolute inset-x-0 top-0")}
            inert={!headerCollapsed}
          >
            <div
              className={cn(
                "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                headerCollapsed ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
              )}
            >
              <div className="page-gutter mx-auto flex max-w-none flex-col gap-1.5 py-1.5 sm:flex-row sm:items-center sm:gap-2">
                <div className="flex min-w-0 items-center gap-1 sm:contents">
                  <Link to="/" className="shrink-0 [&_img]:!h-7 sm:[&_img]:!h-8" aria-label="MACH RUN">
                    <BrandLockup showTagline={false} />
                  </Link>
                  <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:order-3 sm:ml-0">
                    <SiteMenu align="right" />
                    {signedIn ? (
                      <AuthSlot saved={saveStatus} />
                    ) : (
                      <>
                        <a href="/pricing" className="whitespace-nowrap px-1 text-[11px] font-medium text-muted hover:text-fg">
                          Pricing
                        </a>
                        <a href="/login" className="whitespace-nowrap px-1 text-[11px] font-medium text-muted hover:text-fg">
                          Sign In
                        </a>
                        <a href="/login?mode=up" className="whitespace-nowrap px-1 text-[11px] font-medium text-muted hover:text-fg">
                          Create Account
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <nav aria-label="OODA loop" className={cn("min-w-0 sm:order-2 sm:flex sm:flex-1 sm:justify-center", advisorPlanHeld && "hidden")}>
                  <div className="flex w-full items-center rounded-md bg-surface p-0.5 shadow-[0_0_0_1px_var(--color-border)] sm:max-w-md">
                    <OodaPhaseBar
                      compact
                      shown={shown}
                      shownPhase={shownPhase}
                      shownIndex={shownIndex}
                      onPick={goStep}
                      plan={plan}
                      hasRun={Boolean(run)}
                    />
                    <button
                      type="button"
                      onClick={toggleHeader}
                      aria-pressed
                      aria-label="Show header"
                      title="Show header"
                      className="inline-flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-fg hover:bg-elevated"
                    >
                      <span aria-hidden="true" className="text-sm leading-none">▾</span>
                    </button>
                  </div>
                </nav>
              </div>
            </div>
          </div>
          <div
            ref={expandedHeaderRef}
            className={cn(headerCollapsed ? "pointer-events-none absolute inset-x-0 top-0" : "relative")}
            inert={headerCollapsed}
          >
            <div
              className={cn(
                "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                headerCollapsed ? "pointer-events-none -translate-y-2 opacity-0" : "translate-y-0 opacity-100",
              )}
            >
              <div className="page-gutter relative z-50 mx-auto max-w-none py-2.5">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
                  <div className="flex min-w-0 items-center gap-0">
                    <BrandLockup showTagline={false} />
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
                    <SiteMenu align="right" className="hidden md:block" />
                    <ProfileSwitcher ent={ent} />
                    <AuthSlot saved={saveStatus} />
                  </div>
                  <p className="mt-[0.8px] w-[9.8rem] min-w-0 whitespace-normal text-left text-[11px] font-bold leading-tight tracking-[0.04em] text-muted sm:w-[11.5rem] sm:text-xs sm:tracking-[0.08em] md:w-auto md:whitespace-nowrap md:text-[13px] md:tracking-[0.12em]">
                    The Supersonic Retirement Calculator
                  </p>
                  <div className="flex items-center justify-end gap-1 md:hidden">
                    <SiteMenu align="right" className="z-10" />
                  </div>
                </div>
              </div>
              <nav
                aria-label="OODA loop"
                className={cn(
                  "page-gutter mx-auto flex max-w-none items-center gap-2 pb-3",
                  advisorPlanHeld && "hidden",
                )}
              >
                <div className="mx-auto flex min-w-0 max-w-3xl flex-1 rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--color-border)]">
                  <OodaPhaseBar
                    shown={shown}
                    shownPhase={shownPhase}
                    shownIndex={shownIndex}
                    onPick={goStep}
                    plan={plan}
                    hasRun={Boolean(run)}
                  />
                </div>
                <button
                  type="button"
                  onClick={toggleHeader}
                  aria-pressed={false}
                  aria-label="Hide header"
                  title="Hide header"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-surface text-[10px] font-medium uppercase tracking-[0.08em] text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated sm:w-auto sm:px-2.5"
                >
                  <span className="hidden sm:inline">Collapse</span>
                  <span aria-hidden="true" className="text-base leading-none">▴</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
        <EmailVerifyBanner />
        <PasswordLaterBanner />
      </header>
      <div
        id={heroOn ? "guest-dock" : undefined}
        ref={stepsRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg"
        style={{ overflowAnchor: "none" }}
      >
      {heroOn ? <GuestHero onShowFamily={showFamily} onDemo={showDemo} /> : null}
      {heroOn ? <MilitaryHousehold onShowFamily={showFamily} onUseDemo={showDemo} /> : null}

      {heroOn ? (
        <div
          id="master-caution"
          className="sticky top-0 z-20 border-t border-[#8a7020] bg-[#2c220e]"
        >
          <div className="grid">
            <div
              className={cn(
                "page-gutter col-start-1 row-start-1 mx-auto flex w-full max-w-none flex-col items-center gap-1.5 py-2.5 text-center max-sm:gap-1 max-sm:py-1.5",
                planHasEntries(plan) ? "" : "invisible pointer-events-none max-sm:hidden",
              )}
              aria-hidden={!planHasEntries(plan)}
            >
              <button
                type="button"
                onClick={() => setCautionAck(true)}
                disabled={cautionAck}
                className={cn(
                  "master-caution-lamp inline-flex shrink-0 items-center rounded-sm bg-[#e8c547] px-3 py-1 font-display text-sm font-semibold uppercase tracking-[0.18em] text-[#1a1408] max-sm:px-2.5 max-sm:py-0.5 max-sm:text-[11px] max-sm:tracking-[0.14em] sm:text-[12px] sm:tracking-[0.14em] xl:text-sm xl:tracking-[0.18em]",
                  cautionAck && "is-punched",
                )}
              >
                {heroCopy.cautionLabel}
              </button>
              {heroCopy.cautionBody.trim() ? (
                <p className="max-w-3xl text-[11px] leading-[1.35] text-[#fff3c4] sm:text-[13px] xl:text-lg">
                  {heroCopy.cautionBody}
                </p>
              ) : null}
              {heroCopy.cautionLink.trim() ? (
                <Link
                  to="/login"
                  search={{ mode: "up" }}
                  className="text-[11px] font-semibold text-white underline decoration-[#e8c547] underline-offset-[3px] hover:text-[#fff3c4] sm:text-[13px] xl:text-lg"
                >
                  {heroCopy.cautionLink}
                </Link>
              ) : null}
              {demoLoaded && heroCopy.clearDemo.trim() ? (
                <button
                  type="button"
                  onClick={clearDemo}
                  className="mt-1 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#e8c547] px-4 py-2 text-sm font-semibold text-[#1a1408] hover:bg-[#f3d56a] active:scale-[0.98] sm:text-[13px] xl:text-sm"
                >
                  {heroCopy.clearDemo}
                </button>
              ) : null}
            </div>
            <div
              className={cn(
                "page-gutter col-start-1 row-start-1 mx-auto flex w-full max-w-none flex-col items-center gap-1.5 py-2.5 text-center max-sm:gap-1 max-sm:py-1.5",
                planHasEntries(plan) ? "invisible pointer-events-none max-sm:hidden" : "",
              )}
              aria-hidden={planHasEntries(plan)}
            >
              <span className="inline-flex shrink-0 items-center rounded-sm bg-[#e8c547] px-3 py-1 font-display text-sm font-semibold uppercase tracking-[0.18em] text-[#1a1408] sm:text-[12px] sm:tracking-[0.14em] xl:text-sm xl:tracking-[0.18em]">
                {heroCopy.startLabel}
              </span>
              <p className="w-full max-w-6xl text-[11px] leading-[1.35] text-[#fff3c4] sm:text-[13px] xl:text-lg 2xl:max-w-[90rem] min-[2000px]:max-w-[110rem]">
                “{boydLine}”
              </p>
              <p className="w-full max-w-6xl text-[11px] leading-[1.35] text-[#fff3c4] sm:text-[13px] xl:text-lg 2xl:max-w-[90rem] min-[2000px]:max-w-[110rem]">
                - John Boyd
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {advisorPlanHeld ? null : (
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
            <WhiteStep
              id="ooda-observe"
              phase="Observe"
              title="Family"
              tabs={<PhaseFolderTabs name="Observe" tabs={OBSERVE_TABS} active="family" onPick={goStep} face="white" />}
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
              narrow
            >
              <HouseholdForm />
            </WhiteStep>
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
            <WhiteStep
              id="ooda-observe-assumptions"
              phase="Observe"
              title="Assumptions"
              tabs={<PhaseFolderTabs name="Observe" tabs={OBSERVE_TABS} active="assumptions" onPick={goStep} face="white" />}
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
              narrow
            >
              <AssumptionsForm />
            </WhiteStep>
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
            <WhiteStep
              id="ooda-observe-assets"
              phase="Observe"
              title="Assets"
              tabs={<PhaseFolderTabs name="Observe" tabs={OBSERVE_TABS} active="assets" onPick={goStep} face="white" />}
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
              narrow
            >
              <PortfolioForm />
            </WhiteStep>
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
            <WhiteStep
              id="ooda-observe-liabilities"
              phase="Observe"
              title="Liabilities"
              tabs={<PhaseFolderTabs name="Observe" tabs={OBSERVE_TABS} active="liabilities" onPick={goStep} face="white" />}
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
              narrow
            >
              <LiabilityForm />
            </WhiteStep>
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
            <WhiteStep
              id="ooda-orient"
              phase="Orient"
              title="Income"
              tabs={<PhaseFolderTabs name="Orient" tabs={ORIENT_TABS} active="income" onPick={goStep} face="white" />}
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
              narrow
            >
              <IncomeForm />
            </WhiteStep>
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
            <WhiteStep
              id="ooda-orient-spending"
              phase="Orient"
              title="Spending"
              tabs={<PhaseFolderTabs name="Orient" tabs={ORIENT_TABS} active="spending" onPick={goStep} face="white" />}
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
              narrow
            >
              <SpendingForm />
            </WhiteStep>
            </div>
            </div>
          </div>
          <div
            ref={(node) => {
              panelRefs.current.goals = node;
            }}
            className={goalsPane.className}
            style={goalsPane.style}
            aria-hidden={goalsPane.hidden}
            hidden={goalsPane.hidden}
          >
            <div className={inputFrame}>
            <div>
            <WhiteStep
              id="ooda-decide"
              phase="Decide"
              title="Goals"
              tabs={<PhaseFolderTabs name="Decide" tabs={DECIDE_TABS} active="goals" onPick={goStep} face="white" />}
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
              narrow
            >
              <GoalsForm />
            </WhiteStep>
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
            <div>
            <WhiteStep
              id="ooda-decide-contributions"
              phase="Decide"
              title="Contributions"
              tabs={<PhaseFolderTabs name="Decide" tabs={DECIDE_TABS} active="contributions" onPick={goStep} face="white" />}
              nav={<SweepNav showBack={showBack} showNext={showNext} onBack={onBack} onNext={onNext} />}
              narrow
            >
              <ContributionForm />
            </WhiteStep>
            </div>
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
              {!ent.paid && !ent.pending ? (
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
              <div className="relative">
                <div className="mb-3 flex items-center justify-between gap-2 min-[72rem]:absolute min-[72rem]:bottom-0 min-[72rem]:right-[calc(100%+0.5rem)] min-[72rem]:top-[2.5rem] min-[72rem]:z-20 min-[72rem]:mb-0 min-[72rem]:w-14 min-[72rem]:items-start">
                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-row gap-2 overflow-x-auto pr-12 min-[72rem]:sticky min-[72rem]:z-20 min-[72rem]:h-max min-[72rem]:w-14 min-[72rem]:flex-none min-[72rem]:flex-col min-[72rem]:self-start min-[72rem]:overflow-visible min-[72rem]:pr-0",
                    "min-[72rem]:top-3",
                  )}
                >
                  <div role="tablist" aria-label="Act" className="contents">
                  {ACT_TABS.map((tab) => (
                    <ActTabButton
                      key={tab.id}
                      label={tab.label}
                      icon={tab.icon}
                      on={actTab === tab.id}
                      onClick={() => setActTab(tab.id)}
                    />
                  ))}
                  </div>
                  <ExecuteMachRunButton
                    onArm={armExecute}
                    onExecute={() => void calculate({ stay: true })}
                  />
                </div>
                </div>
                <div className="max-[71.99rem]:contents min-[72rem]:absolute min-[72rem]:bottom-0 min-[72rem]:left-[calc(100%+0.5rem)] min-[72rem]:top-[2.5rem] min-[72rem]:z-20 min-[72rem]:w-14">
                  <div
                    className={cn(
                      "min-[72rem]:sticky min-[72rem]:z-20 min-[72rem]:h-max min-[72rem]:w-14",
                      "min-[72rem]:top-3",
                    )}
                  >
                    <OodaRail open={oodaOpen} onToggle={() => setOodaOpen((open) => !open)} />
                    <OodaDrawer
                      open={oodaOpen}
                      onClose={() => setOodaOpen(false)}
                      plan={displayPlan}
                      sim={run.sim}
                      brief={run.brief}
                      survival={
                        survivalScore
                          ? {
                              score: survivalScore.score,
                              swing: survivalScore.swing,
                              runOutAge: survivalScore.runOutAge,
                              stale: survivalStale,
                            }
                          : null
                      }
                    />
                  </div>
                </div>
                <div>
                  {actTab === "brief" ? (
                    <div className="@container/act flex flex-col gap-4">
                      <div className="grid grid-cols-1 items-start gap-4 @min-[56rem]/act:grid-cols-2 @min-[56rem]/act:items-stretch">
                        <div className={cn(
                          "flex min-w-0 flex-col gap-3",
                          simulatorFull && "@min-[56rem]/act:h-full",
                        )}>
                          <div className="flex items-center justify-between gap-3">
                            <ActPhase />
                            <DollarViewToggle
                              real={real}
                              onReal={() => patchAssumptions({ dollars: "real" })}
                              onNominal={() => patchAssumptions({ dollars: "nominal" })}
                            />
                          </div>
                          <div className={cn("flex flex-col gap-3", simulatorFull && "@min-[56rem]/act:flex-1")}>
                            <Verdict
                              plan={displayPlan}
                              sim={run.sim}
                              brief={run.brief}
                              className={simulatorFull ? "@min-[56rem]/act:flex-1" : undefined}
                              survivalUnlocked={survivalOn}
                              survival={survivalScore}
                            />
                            <KpiStrip
                              plan={displayPlan}
                              sim={run.sim}
                              onArmExecute={armExecute}
                              onExecute={() => void calculate({ stay: true })}
                            />
                          </div>
                        </div>
                        <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
                          <PhaseLabel id="ooda-simulator" label="The Simulator" />
                          <PlanSurvival
                            locked={!survivalOn}
                            view={survivalView}
                            onSwing={chooseSwing}
                            onRun={runMonteCarlo}
                            onClose={() => setSurvivalOpen(false)}
                            onOpen={() => setSurvivalOpen(true)}
                            onLockedMinChange={setSurvivalMinimized}
                            longevityAge={displayPlan.assumptions.projectionEndAge}
                            plan={survivalOn ? displayPlan : null}
                            stale={survivalStale}
                            onOpenMonte={() => setActTab("monte")}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 inline-flex max-w-full flex-nowrap rounded-lg bg-slate-100 p-1 sm:flex-wrap">
                          {BRIEF_CHARTS.map((choice) => {
                            const on = briefChart === choice.id;
                            return (
                              <button
                                key={choice.id}
                                type="button"
                                aria-pressed={on}
                                aria-label={choice.label}
                                onClick={() => setBriefChart(choice.id)}
                                className={cn(
                                  "h-8 whitespace-nowrap rounded-md px-3 text-xs font-medium",
                                  on ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
                                )}
                              >
                                <span className="sm:hidden">{choice.short}</span>
                                <span className="hidden sm:inline">{choice.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <ActChartColumn
                          plan={displayPlan}
                          sim={run.sim}
                          only={briefChart}
                          survival={survivalScore}
                        />
                      </div>
                    </div>
                  ) : null}
                  {actTab === "charts" ? (
                    <div className="flex min-w-0 flex-col gap-3">
                      <PhaseLabel id="ooda-radar" label="Financial Radar" />
                      <ActChartColumn
                        plan={displayPlan}
                        sim={run.sim}
                        tall
                        survival={survivalScore}
                      />
                    </div>
                  ) : null}
                  {actTab === "analysis" ? (
                    <div className="flex min-w-0 flex-col gap-3">
                      <PhaseLabel id="ooda-analysis" label="Mach Analysis" />
                      <div className="flex min-w-0 flex-col gap-4">
                      <PeerBriefCard
                        key={run.id}
                        brief={run.brief}
                        ran
                        plan={displayPlan}
                        sim={run.sim}
                        survival={survivalScore}
                        onExecute={() => {
                          void calculate({ stay: true });
                        }}
                        onStale={() => setRunStale(true)}
                      />
                      </div>
                    </div>
                  ) : null}
                  {actTab === "ledger" ? (
                    <div className="flex min-w-0 flex-col gap-3">
                      <PhaseLabel id="ooda-numbers" label="The Numbers" />
                      <YearTable plan={displayPlan} sim={run.sim} />
                    </div>
                  ) : null}
                  {actTab === "monte" ? (
                    <MonteCarloTab
                      unlocked={survivalOn}
                      real={real}
                      longevityAge={displayPlan.assumptions.projectionEndAge}
                      score={survivalScore}
                      running={survivalRunning}
                      progress={survivalRunning && survivalView ? survivalView.progress : 0}
                      onRun={runMonteCarlo}
                      plan={displayPlan}
                      sim={run.sim}
                      stale={survivalStale}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ) : restoredAct.current && !actPlaceSettled ? (
            <div className="min-h-[40svh]" />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="relative flex min-h-11 items-center justify-between gap-3">
                <ActPhase />
                <DollarViewToggle
                  real={real}
                  onReal={() => patchAssumptions({ dollars: "real" })}
                  onNominal={() => patchAssumptions({ dollars: "nominal" })}
                />
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
              {heroOn ? null : (
              <div className="rounded-xl bg-surface px-5 py-8 shadow-[0_0_0_1px_var(--color-border)]">
                <p className="text-left font-display text-3xl text-fg">{heroCopy.emptyTitle}</p>
                <p className="mt-1 text-left font-display text-lg text-fg">
                  {heroCopy.emptyLine}
                </p>
                <p className="mt-2 max-w-xl text-left text-sm text-muted">
                  {heroCopy.emptyBody}
                </p>
              </div>
              )}
            </div>
          )}
        </div>
        </div>
      </main>
      )}
      <MachFooter disclaimer />
      </div>
      {stalePrompt && !advisorPlanHeld ? (
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
