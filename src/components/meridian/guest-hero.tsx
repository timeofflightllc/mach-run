import { useEffect, useId, useRef, useState, type TransitionEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Compass, Eye, Flag, GitBranch } from "lucide-react";
import { OodaLoop } from "@/components/meridian/how-it-works";
import { PrimaryButton } from "@/components/ui/field";
import { demoPlan, planHasEntries } from "@/lib/plan/demo-plan";
import { usePlanStore } from "@/lib/plan/store";
import { useHeroCopy } from "@/components/meridian/use-hero-copy";
import type { HeroCopy } from "@/lib/site-copy/hero-copy";

/** Line sketch of a four-ship bomb burst. Tails point back at the laptop; smoke does the rest. */
export function BombBurstSketch({ raised = false }: { raised?: boolean }) {
  return (
    <svg
      className={
        raised
          ? "pointer-events-none absolute left-1/2 top-0 hidden h-[155%] max-h-[44rem] w-screen -translate-x-1/2 -translate-y-[30%] overflow-visible md:block"
          : "pointer-events-none absolute left-1/2 top-0 hidden h-[155%] w-screen -translate-x-1/2 -translate-y-[30%] overflow-visible md:block"
      }
      viewBox="0 0 1600 900"
      fill="none"
      aria-hidden
    >
      {raised ? (
        <>
          <g transform="translate(0 102)">
            <SmokeTrail d="M800 640 C 760 450, 560 180, 430 30" />
            <SmokeTrail d="M800 640 C 840 450, 1040 180, 1170 30" />
            <SmokeTrail d="M800 640 C 720 560, 380 280, 150 130" />
            <SmokeTrail d="M800 640 C 880 560, 1220 280, 1450 130" />
          </g>
          <g stroke="#1a2330" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 102)">
            <SketchJet x={401} y={-4} rotate={-131} scale={2.35} flip />
            <SketchJet x={1199} y={-4} rotate={-49} scale={2.35} />
            <SketchJet x={118} y={112} rotate={-147} scale={2.2} flip />
            <SketchJet x={1482} y={112} rotate={-33} scale={2.2} />
          </g>
        </>
      ) : (
        <>
          <SmokeTrail d="M800 640 C 720 560, 380 280, 150 130" />
          <SmokeTrail d="M800 640 C 880 560, 1220 280, 1450 130" />
          <SmokeTrail d="M800 640 C 640 590, 383 373, 304 384 L 165 403" />
          <SmokeTrail d="M800 640 C 960 590, 1216 381, 1295 392 L 1434 412" />
          <g stroke="#1a2330" strokeLinecap="round" strokeLinejoin="round">
            <SketchJet x={118} y={112} rotate={-152} scale={2.35} flip />
            <SketchJet x={1482} y={112} rotate={-28} scale={2.35} />
            <SketchJet x={48} y={424} rotate={172} scale={2.2} flip />
            <SketchJet x={1552} y={424} rotate={8} scale={2.2} />
          </g>
        </>
      )}
    </svg>
  );
}

function SmokeTrail({ d }: { d: string }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke="#9aa6b2" strokeWidth="18" opacity="0.28" />
      <path d={d} stroke="#d5dbe1" strokeWidth="10" opacity="0.85" />
      <path d={d} stroke="#7f8b98" strokeWidth="2.25" opacity="0.45" />
    </g>
  );
}

/** Nose points +x. Twin tail, one wing — a pencil side view, not a specific jet. */
function SketchJet({
  x,
  y,
  rotate,
  scale = 1,
  flip = false,
}: {
  x: number;
  y: number;
  rotate: number;
  scale?: number;
  flip?: boolean;
}) {
  const sy = flip ? -scale : scale;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale} ${sy})`}>
      {/* Slight Mach cone. Opens aft of the nose, aircraft sits in front of it. */}
      <g fill="none" stroke="#6a7b8c" strokeLinecap="round">
        <path d="M58 -1 C 22 -20, -16 -36, -48 -30" strokeWidth="1.15" opacity="0.55" />
        <path d="M58 5 C 20 22, -12 38, -42 32" strokeWidth="1.15" opacity="0.55" />
        <path d="M46 -0.5 C 18 -12, -2 -18, -22 -14" strokeWidth="0.85" opacity="0.4" />
        <path d="M46 4 C 16 14, 0 20, -18 16" strokeWidth="0.85" opacity="0.4" />
      </g>
      <path d="M-46 1.5C-16-2 22-3 48 0.5c8 1 16 2.2 22 3-8 1.2-18 2.4-28 2.6C8 7.2-22 6-46 2.4" strokeWidth="1.7" />
      <path d="M7-1.67c3-6.5 12-8.5 20 0.38" strokeWidth="1.5" />
      <path d="M16 5 L-1 22 L-12 25 L-2 6.2 Z" strokeWidth="1.55" />
      <path d="M-30-0.5 L-40-16 L-22 0.5" strokeWidth="1.55" />
      <path d="M-24 0.4 L-32-13 L-16 1.2" strokeWidth="1.35" />
      <path d="M-34 2.5 L-50 11 L-28 4" strokeWidth="1.45" />
      <path d="M13 -1.66 L0 -8.6 L-16 -9.2 L-8 -1.36 Z" strokeWidth="1.25" />
      <path d="M-48 1.6 L-58 0.2 M-50 4.2 L-57 6.5" strokeWidth="1.15" opacity="0.8" />
    </g>
  );
}

const LAPTOP_SLIDES = ["ooda", "act", "analysis", "radar", "ledger", "futures"] as const;
type LaptopSlide = (typeof LAPTOP_SLIDES)[number];
const SLIDE_COUNT = LAPTOP_SLIDES.length;
const STRIP_COUNT = SLIDE_COUNT * 2 + 1;
const LAPTOP_STRIP: LaptopSlide[] = [...LAPTOP_SLIDES, ...LAPTOP_SLIDES, LAPTOP_SLIDES[0]];

const SLIDE_HOLD_MS = 4000;

export function GuestHero({
  onShowFamily,
  onDemo,
}: {
  onShowFamily: () => void;
  onDemo: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const hero = useHeroCopy();
  const [index, setIndex] = useState(SLIDE_COUNT);
  const [motion, setMotion] = useState(true);
  const indexRef = useRef(SLIDE_COUNT);
  const sliding = useRef(false);
  const pending = useRef(0);
  const timer = useRef<number | null>(null);
  const dueAt = useRef(0);
  const holdLeft = useRef(SLIDE_HOLD_MS);
  const stepRef = useRef<(delta: number) => void>(() => {});
  const armRef = useRef<(ms?: number) => void>(() => {});
  indexRef.current = index;

  function clearTimer() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function armTimer(ms = SLIDE_HOLD_MS) {
    clearTimer();
    const wait = Math.max(0, ms);
    holdLeft.current = wait;
    dueAt.current = Date.now() + wait;
    if (document.hidden) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      stepRef.current(1);
    }, wait);
  }

  function pauseTimer() {
    if (timer.current == null) return;
    holdLeft.current = Math.max(0, dueAt.current - Date.now());
    clearTimer();
  }

  function step(delta: number) {
    if (delta === 0 || sliding.current) return;
    clearTimer();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const which = (((indexRef.current + delta) % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
      setMotion(false);
      setIndex(SLIDE_COUNT + which);
      return;
    }
    sliding.current = true;
    setMotion(true);
    setIndex((current) => current + delta);
  }

  stepRef.current = step;
  armRef.current = armTimer;

  useEffect(() => {
    if (!motion) {
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setMotion(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    sliding.current = false;
    const jump = pending.current;
    if (jump) {
      pending.current = 0;
      stepRef.current(jump);
      return;
    }
    armRef.current();
    return () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [motion]);

  useEffect(() => {
    function onVis() {
      if (document.hidden) {
        pauseTimer();
        return;
      }
      if (sliding.current || pending.current !== 0) return;
      const left = holdLeft.current;
      if (left <= 0) {
        stepRef.current(1);
        return;
      }
      armRef.current(left);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  function go(direction: "left" | "right") {
    if (sliding.current) return;
    pending.current = 0;
    step(direction === "left" ? 1 : -1);
  }

  function goTo(target: number) {
    if (sliding.current) return;
    const current = ((indexRef.current % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
    if (target === current) return;
    const forward = (target - current + SLIDE_COUNT) % SLIDE_COUNT;
    const back = (current - target + SLIDE_COUNT) % SLIDE_COUNT;
    const delta = forward <= back ? forward : -back;
    const base = delta > 0 ? current : SLIDE_COUNT + current;
    if (indexRef.current !== base) {
      pending.current = delta;
      sliding.current = true;
      clearTimer();
      setMotion(false);
      setIndex(base);
      return;
    }
    step(delta);
  }

  function onSwipeEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    if (!sliding.current) return;
    const landed = indexRef.current;
    if (landed <= 0 || landed >= SLIDE_COUNT * 2) {
      const which = ((landed % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
      setMotion(false);
      setIndex(SLIDE_COUNT + which);
      return;
    }
    sliding.current = false;
    armTimer();
  }

  function fill() {
    usePlanStore.getState().setPlan(demoPlan());
    setConfirming(false);
    onDemo();
  }

  function prefill() {
    if (planHasEntries(usePlanStore.getState().plan)) {
      setConfirming(true);
      return;
    }
    fill();
  }

  return (
    <section className="relative overflow-x-clip border-t border-border bg-bg">
      <div
        aria-hidden="true"
        className="hero-sky"
      />
      <div className="page-gutter mx-auto flex max-w-none flex-col items-center pt-[calc(0.5rem+0.25in)] sm:pt-[calc(1.75rem+0.25in)]">
        <h1 className="hero-backlight w-full max-w-6xl text-center font-display text-[1.25rem] font-semibold leading-[1.15] text-[#1a2330] sm:text-4xl">
          <HeroLines text={hero.headline} />
        </h1>
        {hero.text.trim() ? (
          <div className="relative z-10 mt-1.5 max-w-3xl text-center text-[0.667rem] leading-relaxed text-[#3d4a54] sm:mt-4 sm:text-lg">
            <p>
              <HeroLines text={hero.text} />
            </p>
          </div>
        ) : null}
        {hero.pitch.trim() ? (
          <p className="relative z-10 mt-3 max-w-3xl px-4 text-center text-base font-medium leading-snug text-[#1a2330] sm:mt-5 sm:text-lg">
            <HeroLines text={hero.pitch} />
          </p>
        ) : null}
        {hero.startButton.trim() ? (
          <Link
            to="/start"
            className="mt-3 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-base font-medium text-accent-fg hover:opacity-90 sm:mt-4"
          >
            {hero.startButton}
          </Link>
        ) : null}
        {hero.noCard.trim() ? (
          <p className="mt-2 text-center text-sm text-[#3d4a54]">{hero.noCard}</p>
        ) : null}
        <div className="mt-3 flex w-full max-w-3xl flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3">
          <div className="flex flex-col items-center gap-1">
            <PrimaryButton
              className="h-auto min-h-11 whitespace-normal border border-[#3a8a58] bg-white px-4 py-2.5 text-center leading-snug text-[#3a8a58] hover:bg-[#f3faf6]"
              onClick={() => {
                setConfirming(false);
                onShowFamily();
              }}
            >
              <span>
                <HeroLines text={hero.ownButton} />
              </span>
            </PrimaryButton>
            {hero.ownNote.trim() ? (
              <p className="max-w-[16rem] text-center text-xs leading-snug text-[#3d4a54]">
                {hero.ownNote}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-1">
            <PrimaryButton
              className="h-auto min-h-11 whitespace-normal border border-[#1a2330] bg-white px-4 py-2.5 text-center leading-snug text-[#1a2330] hover:bg-[#f3faf6]"
              onClick={prefill}
            >
              {hero.demoButton}
            </PrimaryButton>
            {hero.demoNote.trim() ? (
              <p className="max-w-[16rem] text-center text-xs leading-snug text-[#3d4a54]">
                {hero.demoNote}
              </p>
            ) : null}
          </div>
        </div>
        {confirming ? (
          <div className="mt-4 w-full max-w-xl rounded-lg bg-surface px-4 py-3 text-center shadow-[0_0_0_1px_var(--color-border)]">
            <p className="text-sm text-fg">{hero.replaceWarn}</p>
            <div className="mt-3 flex flex-col items-stretch justify-center gap-2 sm:flex-row">
              <PrimaryButton className="h-auto min-h-11 px-4" onClick={fill}>
                {hero.replaceButton}
              </PrimaryButton>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted hover:text-fg"
                onClick={() => setConfirming(false)}
              >
                {hero.cancelButton}
              </button>
            </div>
          </div>
        ) : null}
        <div className="relative mt-2 w-full sm:mt-5">
          <BombBurstSketch />
          <div className="relative z-10 mx-auto w-full max-w-3xl px-2">
            <button
              type="button"
              aria-label="Previous laptop screen"
              onClick={() => go("right")}
              className="absolute left-1 top-[62.5%] z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a2330] bg-white text-[#1a2330] shadow-sm hover:bg-[#f3faf6] sm:left-0"
            >
              <ScreenArrow direction="left" />
            </button>
            <button
              type="button"
              aria-label="Next laptop screen"
              onClick={() => go("left")}
              className="absolute right-1 top-[62.5%] z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a2330] bg-white text-[#1a2330] shadow-sm hover:bg-[#f3faf6] sm:right-0"
            >
              <ScreenArrow direction="right" />
            </button>
            {/* 12.5% of this width is 20% of a 16:10 screen. The extra drops the chin behind the page. */}
            <div className="mx-[3px]" style={{ marginBottom: "calc(-12.5% - 3.375rem)" }}>
              <div
                className="overflow-hidden rounded-t-xl border-8 border-transparent sm:border-[12px]"
                style={{
                  background:
                    "linear-gradient(#fffcf6, #fffcf6) padding-box, linear-gradient(165deg, #b8bec4 0%, #8e959c 32%, #6e767e 70%, #5e666e 100%) border-box",
                }}
              >
                <div className="relative aspect-[2230/1296] overflow-hidden">
                  <div
                    className={
                      motion
                        ? "flex h-full transition-transform duration-[1100ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
                        : "flex h-full"
                    }
                    style={{
                      width: `${STRIP_COUNT * 100}%`,
                      transform: `translateX(${-index * (100 / STRIP_COUNT)}%)`,
                    }}
                    onTransitionEnd={onSwipeEnd}
                  >
                    {LAPTOP_STRIP.map((slide, slot) => (
                      <LaptopPane key={`${slide}-${slot}`} slide={slide} />
                    ))}
                  </div>
                </div>
              </div>
              <div
                className="relative z-10 flex h-10 items-center justify-center gap-2.5 rounded-b-lg bg-gradient-to-b from-[#868d94] to-[#aeb4ba]"
                role="group"
                aria-label="Laptop screens"
              >
                {LAPTOP_SLIDES.map((slide, slot) => {
                  const on = slot === ((index % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
                  return (
                    <button
                      key={slide}
                      type="button"
                      aria-label={`Show laptop screen ${slot + 1} of ${SLIDE_COUNT}`}
                      aria-current={on ? "true" : undefined}
                      onClick={() => goTo(slot)}
                      className="flex h-8 w-8 items-center justify-center"
                    >
                      <span
                        className={
                          on
                            ? "h-[1.125rem] w-[1.125rem] rounded-full bg-[#1a2330] shadow-[0_0_0_2px_#fff]"
                            : "h-[1.125rem] w-[1.125rem] rounded-full bg-white/55 shadow-[0_0_0_1.5px_rgba(26,35,48,0.55)]"
                        }
                      />
                    </button>
                  );
                })}
              </div>
              <div className="mx-auto h-2.5 w-[68%] rounded-b-md bg-[#9aa1a8]" />
              <div className="mx-auto h-1 w-[42%] rounded-b-sm bg-[#7e868d]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroLines({ text }: { text: string }) {
  const rows = text.split("\n");
  return rows.map((row, index) => (
    <span key={index}>
      {index > 0 ? <br /> : null}
      {row}
    </span>
  ));
}

function LaptopPane({ slide }: { slide: LaptopSlide }) {
  const frame = "relative h-full shrink-0";
  const width = { width: `${100 / STRIP_COUNT}%` };
  if (slide === "ooda") {
    return (
      <div
        className="h-full shrink-0 p-2 sm:p-3"
        style={{
          ...width,
          background:
            "linear-gradient(to bottom, rgba(26, 35, 48, 0.2) 0%, rgba(26, 35, 48, 0.07) 38%, #fff 78%)",
        }}
      >
        <OodaLoop />
      </div>
    );
  }
  const shot = {
    futures: ["/brand/laptop-futures.png?v=2", "Monte Carlo chart of 1,000 spendable futures."],
    act: ["/brand/laptop-act.png?v=2", "Act screen for a household on track for $2,500,000."],
    analysis: ["/brand/laptop-analysis.png?v=2", "MACH Analysis for the sample household."],
    radar: ["/brand/laptop-radar.png?v=2", "Spendable wealth chart for the sample household."],
    ledger: ["/brand/laptop-ledger.png?v=2", "Yearly ledger for the sample household."],
  }[slide];
  return (
    <div className={`${frame} bg-[#f7f4ee]`} style={width}>
      <img src={shot[0]} alt={shot[1]} className="absolute inset-0 h-full w-full object-cover object-center" />
    </div>
  );
}

function ScreenArrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
      {direction === "left" ? (
        <path d="M12.5 4 L6.5 10 L12.5 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M7.5 4 L13.5 10 L7.5 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

type SampleId = "military" | "va" | "tsp";
type StepId = "observe" | "orient" | "decide" | "act";
type HaleId = "base" | "save" | "later";

/** One row of white stars on Old Glory blue. Decorative. */
function FlagStripe({ end = false }: { end?: boolean }) {
  const id = `mach-flag-stars-${useId().replace(/:/g, "")}`;
  return (
    <div
      aria-hidden="true"
      className={end ? "mt-4 mb-0 h-8 w-screen sm:mt-5" : "my-4 h-8 w-screen sm:my-5"}
    >
      <svg className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={id} width="36" height="32" patternUnits="userSpaceOnUse">
            <polygon
              fill="#fff"
              points="18,9 19.6,13.7 24.7,13.8 20.7,16.9 22.1,21.7 18,18.8 13.9,21.7 15.3,16.9 11.3,13.8 16.4,13.7"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="#002868" />
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

/** Guest homepage only. The journey sits around the military sample. Buttons stay the same actions. */
export function MilitaryHousehold({
  onShowFamily,
  onUseDemo,
}: {
  onShowFamily: () => void;
  onUseDemo: () => void;
}) {
  const copy = useHeroCopy();
  const [confirming, setConfirming] = useState(false);
  const [sampleHover, setSampleHover] = useState<SampleId | null>(null);
  const [samplePin, setSamplePin] = useState<SampleId | null>(null);
  const [stepHover, setStepHover] = useState<StepId | null>(null);
  const [stepPin, setStepPin] = useState<StepId | null>(null);
  const [haleHover, setHaleHover] = useState<HaleId | null>(null);
  const [halePin, setHalePin] = useState<HaleId | null>(null);
  const open = sampleHover ?? samplePin;
  const step = stepHover ?? stepPin;
  const haleView = haleHover ?? halePin ?? "base";
  const sample = [
    {
      id: "military" as const,
      label: copy.milLabel,
      amount: copy.milAmount,
      value: copy.milValue,
      kicker: copy.milKicker,
      note: copy.milNote,
      extra: copy.milExtra,
    },
    {
      id: "va" as const,
      label: copy.vaLabel,
      amount: copy.vaAmount,
      value: copy.vaValue,
      kicker: copy.vaKicker,
      note: copy.vaNote,
      extra: copy.vaExtra,
    },
    {
      id: "tsp" as const,
      label: copy.tspLabel,
      amount: copy.tspAmount,
      value: copy.tspValue,
      kicker: copy.tspKicker,
      note: copy.tspNote,
      extra: "",
    },
  ];
  const steps = [
    { id: "observe" as const, title: copy.observeTitle, body: copy.observeBody, line: copy.observeLine, icon: Eye },
    { id: "orient" as const, title: copy.orientTitle, body: copy.orientBody, line: copy.orientLine, icon: Compass },
    { id: "decide" as const, title: copy.decideTitle, body: copy.decideBody, line: copy.decideLine, icon: GitBranch },
    { id: "act" as const, title: copy.actTitle, body: copy.actBody, line: copy.actLine, icon: Flag },
  ];
  const bluf: Record<HaleId, { headline: string; body: string }> = {
    base: { headline: copy.blufBaseHeadline, body: copy.blufBaseBody },
    save: { headline: copy.blufSaveHeadline, body: copy.blufSaveBody },
    later: { headline: copy.blufLaterHeadline, body: copy.blufLaterBody },
  };
  const active = sample.find((row) => row.id === open);

  function fillDemo() {
    usePlanStore.getState().setPlan(demoPlan());
    setConfirming(false);
    onUseDemo();
  }

  function prefillDemo() {
    if (planHasEntries(usePlanStore.getState().plan)) {
      setConfirming(true);
      return;
    }
    fillDemo();
  }

  return (
    <section className="overflow-x-clip bg-bg">
      <div className="mx-auto w-full max-w-3xl px-2" aria-hidden="true">
        <div style={{ paddingTop: "calc(12.5% + 3.375rem)" }} />
      </div>
      <div className="page-gutter relative mx-auto flex w-full max-w-none flex-col items-center pt-4 pb-12 text-center sm:pt-6 sm:pb-16">
        <JourneyBlock kicker={copy.problemKicker} title={copy.problemTitle}>
          {copy.problemBody}
        </JourneyBlock>
        <JourneyBlock kicker={copy.frustrationKicker} title={copy.frustrationTitle}>
          {copy.frustrationBody}
        </JourneyBlock>
        <JourneyBlock kicker={copy.solutionKicker} title={copy.solutionTitle}>
          {copy.solutionBody}
        </JourneyBlock>
        <FlagStripe />
        {copy.militaryEyebrow.trim() ? (
          <p className="font-display text-lg font-semibold uppercase tracking-[0.14em] text-[#3a8a58] sm:text-2xl">
            {copy.militaryEyebrow}
          </p>
        ) : null}
        {copy.militaryTitle.trim() ? (
          <h2 className="mt-2 max-w-3xl font-display text-2xl font-semibold leading-tight text-[#1a2330] sm:text-4xl">
            {copy.militaryTitle}
          </h2>
        ) : null}
        {copy.militaryBody.trim() ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            <HeroLines text={copy.militaryBody} />
          </p>
        ) : null}
        <div className="mt-6 w-full max-w-4xl rounded-lg bg-[#1a2330] px-4 py-5 text-white">
          <div className="grid">
            <div className={active ? "invisible col-start-1 row-start-1" : "col-start-1 row-start-1"}>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[#e8c547]">
                {copy.sampleLabel}
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">{copy.sampleAmount}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/80">
                {copy.sampleNote}
              </p>
            </div>
            {sample.map((row) => (
              <div
                key={row.id}
                className={
                  active?.id === row.id
                    ? "col-start-1 row-start-1"
                    : "invisible col-start-1 row-start-1"
                }
              >
                <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[#e8c547]">
                  {row.kicker}
                </p>
                <p className="mt-1 font-display text-3xl font-semibold">{row.value}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/80">{row.note}</p>
                {row.extra.trim() ? (
                  <p className="mt-2 text-xs leading-snug text-white/70">{row.extra}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
          {sample.map((row) => (
            <div
              key={row.id}
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse") return;
                setSampleHover(row.id);
              }}
              onClick={() => setSamplePin(row.id)}
              className={
                "cursor-pointer touch-pan-y rounded-lg bg-white px-4 py-4 " +
                (open === row.id
                  ? "shadow-[0_0_0_2px_#3a8a58]"
                  : "shadow-[0_0_0_1px_var(--color-border)]")
              }
            >
              <p className="text-sm text-muted">{row.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-[#1a2330] underline decoration-[#3a8a58] decoration-2 underline-offset-4">{row.amount}</p>
              <p className="text-xs text-muted">{copy.sampleMonth}</p>
            </div>
          ))}
        </div>
        {copy.sampleFoot.trim() ? (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">{copy.sampleFoot}</p>
        ) : null}
        <FlagStripe />
        {copy.processKicker.trim() ? (
          <p className="mt-6 w-full max-w-3xl text-left font-display text-lg font-semibold uppercase tracking-[0.12em] text-[#3a8a58] sm:text-xl">
            {copy.processKicker}
          </p>
        ) : null}
        <div className="mt-4 grid w-full max-w-4xl grid-cols-2 gap-3 lg:grid-cols-4">
          {steps.map((item) => (
            <div
              key={item.id}
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse") return;
                setStepHover(item.id);
              }}
              onClick={() => setStepPin(item.id)}
              className={
                step === item.id
                  ? "cursor-pointer rounded-lg bg-white px-4 py-4 text-left shadow-[0_0_0_2px_#3a8a58]"
                  : "cursor-pointer rounded-lg bg-white px-4 py-4 text-left shadow-[0_0_0_1px_var(--color-border)]"
              }
            >
              <item.icon className="h-5 w-5 text-[#3a8a58]" strokeWidth={1.75} aria-hidden="true" />
              <p className="mt-3 font-display text-lg font-semibold text-[#1a2330]">{item.title}</p>
              <p className="mt-1 text-sm leading-snug text-[#3d4a54]">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid w-full max-w-4xl rounded-lg bg-white px-5 py-4 text-center shadow-[0_0_0_1px_var(--color-border)]">
          <p
            className={
              step
                ? "invisible col-start-1 row-start-1 text-base font-medium leading-snug text-[#1a2330] sm:text-lg"
                : "col-start-1 row-start-1 text-base font-medium leading-snug text-[#1a2330] sm:text-lg"
            }
          >
            {copy.processPrompt}
          </p>
          {steps.map((item) => (
            <p
              key={item.id}
              className={
                step === item.id
                  ? "col-start-1 row-start-1 text-base font-medium leading-snug text-[#1a2330] sm:text-lg"
                  : "invisible col-start-1 row-start-1 text-base font-medium leading-snug text-[#1a2330] sm:text-lg"
              }
            >
              {item.line}
            </p>
          ))}
        </div>
        <JourneyBlock kicker={copy.outcomeKicker} title={copy.outcomeTitle}>
          {copy.outcomeBody}
        </JourneyBlock>
        <div className="mt-2 w-full max-w-3xl text-left">
          {copy.haleTitle.trim() ? (
            <h3 className="font-display text-2xl font-semibold leading-tight text-[#1a2330] sm:text-3xl">
              {copy.haleTitle}
            </h3>
          ) : null}
          {copy.haleBody.trim() ? (
            <p className="mt-2 px-8 text-sm leading-relaxed text-[#1a2330] sm:px-12 sm:text-base">
              {copy.haleBody}
            </p>
          ) : null}
        </div>
        <div className="mt-4 grid w-full max-w-4xl gap-3 text-left sm:grid-cols-3">
            <ScenarioCard
              title={copy.scenarioBaseTitle}
              body={copy.scenarioBaseBody}
              active={haleView === "base" && (haleHover !== null || halePin !== null)}
              onEnter={() => setHaleHover("base")}
              onTap={() => setHalePin("base")}
            />
            <ScenarioCard
              title={copy.scenarioSaveTitle}
              body={copy.scenarioSaveBody}
              active={haleView === "save"}
              onEnter={() => setHaleHover("save")}
              onTap={() => setHalePin("save")}
            />
            <ScenarioCard
              title={copy.scenarioLaterTitle}
              body={copy.scenarioLaterBody}
              active={haleView === "later"}
              onEnter={() => setHaleHover("later")}
              onTap={() => setHalePin("later")}
            />
          </div>
          <div className="mt-3 grid w-full max-w-4xl rounded-lg bg-white px-5 py-4 text-left shadow-[0_0_0_1px_var(--color-border)]">
            {(Object.keys(bluf) as HaleId[]).map((key) => (
              <div
                key={key}
                className={
                  haleView === key ? "col-start-1 row-start-1" : "invisible col-start-1 row-start-1"
                }
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d4a54]">
                  {copy.blufLabel}
                </p>
                <p className="mt-2 text-base font-medium leading-snug text-[#1a2330] sm:text-lg">
                  {bluf[key].headline}
                </p>
                <p className="mt-2 text-sm leading-snug text-[#1a2330]">{bluf[key].body}</p>
                {copy.haleDisclaimer.trim() ? (
                  <p className="mt-3 text-xs leading-snug text-[#3d4a54]">{copy.haleDisclaimer}</p>
                ) : null}
              </div>
            ))}
          </div>
          {confirming ? (
            <div className="mt-4 w-full max-w-4xl rounded-lg bg-surface px-4 py-3 text-center shadow-[0_0_0_1px_var(--color-border)]">
              <p className="text-sm text-fg">{copy.replaceWarn}</p>
              <div className="mt-3 flex flex-col items-stretch justify-center gap-2 sm:flex-row">
                <PrimaryButton className="h-auto min-h-11 px-4" onClick={fillDemo}>
                  {copy.replaceButton}
                </PrimaryButton>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted hover:text-fg"
                  onClick={() => setConfirming(false)}
                >
                  {copy.cancelButton}
                </button>
              </div>
            </div>
          ) : null}
        {copy.citation.trim() ? (
          <p className="mt-4 max-w-3xl px-4 text-center text-lg font-medium italic leading-snug text-[#1a2330] sm:text-2xl">
            {copy.citation}
            <sup className="ml-0.5 text-[0.65em] font-semibold not-italic">1</sup>
          </p>
        ) : null}
        {copy.citationSource.trim() ? (
          <p className="mt-1 max-w-3xl px-4 text-center text-xs leading-snug text-[#3d4a54] sm:text-sm">
            <sup className="mr-0.5">1</sup>
            <a
              href="https://www.nber.org/papers/w17078"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-fg"
            >
              {copy.citationSource}
            </a>
          </p>
        ) : null}
        <JourneyBlock kicker={copy.inviteKicker} title={copy.inviteTitle}>
          {copy.inviteBody}
        </JourneyBlock>
        <div className="mt-4 flex w-full max-w-3xl flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3">
          <div className="flex flex-col items-center gap-1">
            <PrimaryButton
              className="h-auto min-h-11 whitespace-normal border border-[#3a8a58] bg-white px-4 py-2.5 text-center leading-snug text-[#3a8a58] hover:bg-[#f3faf6]"
              onClick={onShowFamily}
            >
              <HeroLines text={copy.ownButton} />
            </PrimaryButton>
            {copy.ownNote.trim() ? (
              <p className="max-w-[16rem] text-center text-xs leading-snug text-[#3d4a54]">{copy.ownNote}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-1">
            <PrimaryButton
              className="h-auto min-h-11 whitespace-normal border border-[#1a2330] bg-white px-4 py-2.5 text-center leading-snug text-[#1a2330] hover:bg-[#f3faf6]"
              onClick={prefillDemo}
            >
              {copy.demoButton}
            </PrimaryButton>
            {copy.demoNote.trim() ? (
              <p className="max-w-[16rem] text-center text-xs leading-snug text-[#3d4a54]">{copy.demoNote}</p>
            ) : null}
          </div>
        </div>
        {copy.startButton.trim() ? (
          <Link
            to="/start"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 text-center text-base font-medium text-accent-fg hover:opacity-90"
          >
            {copy.startButton}
          </Link>
        ) : null}
        {copy.noCard.trim() ? (
          <p className="mt-2 text-center text-sm text-[#3d4a54]">{copy.noCard}</p>
        ) : null}
        <FounderStory copy={copy} />
      </div>
    </section>
  );
}

function JourneyBlock({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: string;
}) {
  if (!kicker.trim() && !title.trim() && !children.trim()) return null;
  return (
    <div className="mt-6 w-full max-w-3xl text-left first:mt-0">
      {kicker.trim() ? (
        <p className="font-display text-lg font-semibold uppercase tracking-[0.12em] text-[#3a8a58] sm:text-xl">{kicker}</p>
      ) : null}
      {title.trim() ? (
        <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-[#1a2330] sm:text-3xl">{title}</h2>
      ) : null}
      {children.trim() ? (
        <p className="mt-2 text-sm leading-relaxed text-[#1a2330] sm:text-base">{children}</p>
      ) : null}
    </div>
  );
}

function ScenarioCard({
  title,
  body,
  active,
  onEnter,
  onLeave,
  onTap,
}: {
  title: string;
  body: string;
  active?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onTap?: () => void;
}) {
  return (
    <div
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        onEnter?.();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        onLeave?.();
      }}
      onClick={onTap}
      className={
        "flex h-full cursor-pointer flex-col rounded-lg px-4 py-4 text-left " +
        (active
          ? "bg-white shadow-[0_0_0_2px_#3a8a58]"
          : "bg-white shadow-[0_0_0_1px_var(--color-border)]")
      }
    >
      <p className="font-display text-base font-semibold text-[#1a2330]">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#3d4a54]">{body}</p>
    </div>
  );
}

/** Founder story. Photo, then the text, then the veteran mark. */
function FounderStory({ copy }: { copy: HeroCopy }) {
  if (!copy.founderTitle.trim() && !copy.founderBody.trim() && !copy.founderLink.trim()) return null;
  return (
    <div className="mt-8 flex w-full max-w-[66rem] flex-col items-center gap-6 text-left lg:flex-row lg:items-center lg:gap-8">
      <img
        src="/brand/founder-hero.jpg?v=1"
        alt="A pilot standing beside an F-15 with the canopy open."
        width={1600}
        height={1200}
        className="h-64 w-52 shrink-0 rounded-lg object-cover object-right lg:h-72 lg:w-64"
      />
      <div className="min-w-0 lg:flex-1">
        {copy.founderTitle.trim() ? (
          <h2 className="font-display text-2xl font-semibold leading-tight text-[#1a2330] sm:text-3xl">
            {copy.founderTitle}
          </h2>
        ) : null}
        {copy.founderBody.trim() ? (
          <p className="mt-3 text-sm leading-relaxed text-[#1a2330] sm:text-base">{copy.founderBody}</p>
        ) : null}
        {copy.founderLink.trim() ? (
          <Link
            to="/about"
            className="mt-4 inline-flex text-sm font-medium text-[#1a2330] underline underline-offset-4 hover:text-accent sm:text-base"
          >
            {copy.founderLink}
          </Link>
        ) : null}
      </div>
      <img
        src="/brand/veteran-owned.png"
        alt="U.S. Veteran Owned Business"
        width={338}
        height={292}
        className="h-36 w-auto shrink-0 lg:h-52"
      />
    </div>
  );
}
