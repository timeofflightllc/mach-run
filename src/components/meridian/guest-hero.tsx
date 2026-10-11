import { useEffect, useRef, useState, type TransitionEvent } from "react";
import { OodaLoop } from "@/components/meridian/how-it-works";
import { PrimaryButton } from "@/components/ui/field";
import { demoPlan, planHasEntries } from "@/lib/plan/demo-plan";
import { usePlanStore } from "@/lib/plan/store";
import { useHeroCopy } from "@/components/meridian/use-hero-copy";

/** Line sketch of a four-ship bomb burst. Tails point back at the laptop; smoke does the rest. */
export function BombBurstSketch({ raised = false }: { raised?: boolean }) {
  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-0 hidden h-[155%] w-screen -translate-x-1/2 -translate-y-[30%] overflow-visible md:block"
      viewBox="0 0 1600 900"
      fill="none"
      aria-hidden
    >
      {raised ? (
        <>
          <SmokeTrail d="M800 640 C 760 450, 560 180, 430 30" />
          <SmokeTrail d="M800 640 C 840 450, 1040 180, 1170 30" />
          <SmokeTrail d="M800 640 C 720 560, 380 280, 150 130" />
          <SmokeTrail d="M800 640 C 880 560, 1220 280, 1450 130" />
          <g stroke="#1a2330" strokeLinecap="round" strokeLinejoin="round">
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
    <section className="overflow-x-clip border-t border-border bg-bg">
      <div className="page-gutter mx-auto flex max-w-none flex-col items-center pt-2 sm:pt-7">
        <h1 className="max-w-4xl text-center font-display text-[1.25rem] font-semibold leading-[1.15] text-[#1a2330] sm:text-4xl">
          <HeroLines text={hero.headline} />
        </h1>
        <div className="mt-1.5 max-w-3xl text-center text-[0.667rem] leading-relaxed text-muted sm:mt-4 sm:text-lg">
          <p>
            <HeroLines text={hero.text} />
          </p>
        </div>
        <p className="mt-4 max-w-none px-4 text-center text-lg font-medium italic leading-snug text-[#1a2330] sm:mt-5 sm:text-2xl">
          <span className="sm:whitespace-nowrap">
            “Households that plan arrive with three times the wealth
          </span>
          <br className="hidden sm:inline" />
          <span className="sm:whitespace-nowrap"> of households that do not.”</span>
        </p>
        <p className="mt-1 max-w-3xl text-center text-xs text-muted sm:text-sm">
          <a
            href="https://www.nber.org/papers/w17078"
            target="_blank"
            rel="noopener noreferrer"
            className="italic underline underline-offset-4 hover:text-fg"
          >
            Lusardi and Mitchell, National Bureau of Economic Research, Working Paper 17078 (2011).
          </a>
        </p>
        <div className="mt-3 flex w-full max-w-3xl flex-col items-stretch justify-center gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:gap-3">
          <PrimaryButton
            className="h-auto min-h-11 whitespace-normal border border-[#3a8a58] bg-white px-4 py-2.5 text-center leading-snug text-[#3a8a58] hover:bg-[#f3faf6] sm:max-w-xs"
            onClick={prefill}
          >
            Click here to use Pre-Filled Demo for
            <br />
            an example MACH RUN
          </PrimaryButton>
          <PrimaryButton
            className="h-auto min-h-11 whitespace-normal px-4 py-2.5 text-center leading-snug sm:whitespace-nowrap sm:text-base"
            onClick={() => {
              setConfirming(false);
              onShowFamily();
            }}
          >
            <span className="sm:hidden">
              Click here to start with your info --
              <br />
              no credit card needed.
            </span>
            <span className="hidden sm:inline">
              Click here to start with your info -- no credit card needed.
            </span>
          </PrimaryButton>
        </div>
        <p className="mt-3 w-full max-w-3xl px-6 text-center text-[calc(0.667rem-1pt)] leading-relaxed text-muted sm:mt-4 sm:px-10 sm:text-[calc(1.125rem-1pt)]">
          Spreadsheets take time you'll never get back, and FIRECalc isn't built for TSP, military,
          and veterans. MACH RUN saves that time and is built for those paychecks. Use the fighter
          pilot's OODA Loop and Monte Carlo Simulator to inform your financial path quickly and
          efficiently, <span className="font-bold">giving you time back</span>.
        </p>
        {confirming ? (
          <div className="mt-4 w-full max-w-xl rounded-lg bg-surface px-4 py-3 text-center shadow-[0_0_0_1px_var(--color-border)]">
            <p className="text-sm text-fg">
              This replaces the household already entered. That cannot be undone from here.
            </p>
            <div className="mt-3 flex flex-col items-stretch justify-center gap-2 sm:flex-row">
              <PrimaryButton className="h-auto min-h-11 px-4" onClick={fill}>
                Replace with the demo
              </PrimaryButton>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted hover:text-fg"
                onClick={() => setConfirming(false)}
              >
                Cancel
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
            <div className="mx-[3px]" style={{ marginBottom: "calc(-12.5% - 1.625rem)" }}>
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
                  <div
                    className="absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1.5"
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
                          className={
                            on
                              ? "h-2 w-2 rounded-full bg-[#1a2330] shadow-[0_0_0_1px_#fff]"
                              : "h-2 w-2 rounded-full bg-white/40 shadow-[inset_0_0_0_1.5px_#fff,0_0_0_1px_rgba(26,35,48,0.55)]"
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="h-3 rounded-b-lg bg-gradient-to-b from-[#868d94] to-[#aeb4ba]" />
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
      <div className="h-full shrink-0 bg-[#e4ebf2] p-2 sm:p-3" style={width}>
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

const MILITARY_SAMPLE = [
  {
    id: "military",
    label: "Military retired pay",
    amount: "$3,200",
    value: "$1,280,125",
    kicker: "Zero-risk annuity",
    note: "Military retired pay at age 50, paid through age 95. Discounted at 4% with a 2.5% COLA.",
  },
  {
    id: "va",
    label: "VA",
    amount: "$1,800",
    value: "$720,070",
    kicker: "Zero-risk annuity",
    note: "VA at age 50, paid through age 95. Discounted at 4% with a 2.5% COLA.",
  },
  {
    id: "tsp",
    label: "TSP withdrawal",
    amount: "$1,500",
    value: "$442,800",
    kicker: "TSP at required withdrawal",
    note: "Estimated Traditional TSP balance at age 75, assuming $1,500 a month withdrawal. Roth has other rules.",
  },
] as const;

/** Guest homepage only. Names the three military incomes and a sample blend. */
export function MilitaryHousehold() {
  const [open, setOpen] = useState<(typeof MILITARY_SAMPLE)[number]["id"] | null>(null);
  const [finePointer, setFinePointer] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const active = MILITARY_SAMPLE.find((row) => row.id === open);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFinePointer(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!open || finePointer) return;
    function close(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && gridRef.current?.contains(target)) return;
      setOpen(null);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, finePointer]);

  return (
    <section className="bg-bg">
      <div className="mx-auto w-full max-w-3xl px-2" aria-hidden="true">
        <div style={{ paddingTop: "calc(12.5% + 1.625rem)" }} />
      </div>
      <div className="page-gutter relative mx-auto flex w-full max-w-none flex-col items-center py-8 text-center sm:py-12">
        <p className="pointer-events-none absolute inset-x-4 top-1 text-center text-[0.65rem] leading-tight text-muted sm:top-2 sm:text-xs">
          This sample household is on track for more than $2,500,000 in retirement. The third screen
          is 1,000 futures of that same run.
        </p>
        <p className="font-display text-lg font-semibold uppercase tracking-[0.14em] text-[#3a8a58] sm:text-2xl">
          For military and veteran households
        </p>
        <h2 className="mt-2 max-w-3xl font-display text-2xl font-semibold leading-tight text-[#1a2330] sm:text-4xl">
          TSP, military retired pay, and VA on one strip
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          MACH RUN blends them with the rest of the household, and with nominal rates of returns,
          the Monte Carlo engine, and a few moments of your time, shows what that mix can pay in
          retirement.
        </p>
        <div className="mt-6 w-full max-w-3xl rounded-lg bg-[#1a2330] px-4 py-4 text-white">
          <div className="grid">
            <div className={active ? "invisible col-start-1 row-start-1" : "col-start-1 row-start-1"}>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[#e8c547]">
                Sample blend
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">$6,500 a month</p>
              <p className="mt-1 text-sm leading-relaxed text-white/80">
                $78,000 in the first year of this example. Your MACH RUN uses the numbers you type.
              </p>
            </div>
            {MILITARY_SAMPLE.map((row) => (
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
              </div>
            ))}
          </div>
        </div>
        <div ref={gridRef} className="mt-3 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          {MILITARY_SAMPLE.map((row) => (
            <div
              key={row.id}
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse") return;
                setOpen(row.id);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== "mouse") return;
                setOpen(null);
              }}
              onClick={() => {
                if (finePointer) return;
                setOpen((current) => (current === row.id ? null : row.id));
              }}
              className="touch-pan-y rounded-lg bg-white px-4 py-4 shadow-[0_0_0_1px_var(--color-border)]"
            >
              <p className="text-sm text-muted">{row.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-[#1a2330] underline decoration-[#3a8a58] decoration-2 underline-offset-4">{row.amount}</p>
              <p className="text-xs text-muted">a month</p>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          MACH RUN can also estimate what your military retired pay and VA are worth today — the
          lump sum a zero-risk annuity would need to pay the same checks.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {finePointer
            ? "Mouse over a payment above. Military retired pay and VA show the zero-risk annuity at age 50. TSP shows the balance at the required-withdrawal age, 75."
            : "Tap a payment above. Tap it again, or tap outside the cards, to return to the sample. Military retired pay and VA show the zero-risk annuity at age 50. TSP shows the balance at the required-withdrawal age, 75."}
        </p>
      </div>
    </section>
  );
}
