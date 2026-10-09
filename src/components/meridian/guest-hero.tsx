import { useEffect, useRef, useState, type TransitionEvent } from "react";
import { OodaLoop } from "@/components/meridian/how-it-works";
import { PrimaryButton } from "@/components/ui/field";
import { demoPlan, planHasEntries } from "@/lib/plan/demo-plan";
import { usePlanStore } from "@/lib/plan/store";

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

export function GuestHero({
  onShowFamily,
  onDemo,
}: {
  onShowFamily: () => void;
  onDemo: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [index, setIndex] = useState(2);
  const [motion, setMotion] = useState(true);
  const indexRef = useRef(2);
  const sliding = useRef(false);
  indexRef.current = index;

  useEffect(() => {
    if (motion) {
      sliding.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setMotion(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [motion]);

  function go(direction: "left" | "right") {
    if (sliding.current) return;
    const delta = direction === "left" ? 1 : -1;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const landed = indexRef.current + delta;
      const which = ((landed % 2) + 2) % 2;
      setMotion(false);
      setIndex(which === 0 ? 2 : 1);
      return;
    }
    sliding.current = true;
    setMotion(true);
    setIndex((current) => current + delta);
  }

  function onSwipeEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    if (!sliding.current) return;
    const landed = indexRef.current;
    if (landed === 0 || landed === 3) {
      setMotion(false);
      setIndex(landed === 0 ? 2 : 1);
      return;
    }
    sliding.current = false;
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
        <h2 className="max-w-4xl text-center font-display text-[1.25rem] font-semibold leading-[1.15] text-[#1a2330] sm:text-4xl">
          The Supersonic Retirement Calculator built for global situational
          awareness of your finances. Trusted by individuals and professionals
          -- free to start!
        </h2>
        <div className="mt-1.5 max-w-3xl text-center text-[0.667rem] leading-relaxed text-muted sm:mt-4 sm:text-lg">
          <p>
            See your whole household's retirement in one place - income, investments, and your
            nest-egg goal, with unlimited what-if runs. Free to start. $4 a month unlocks incredible
            features.
          </p>
        </div>
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
        <p className="mt-3 max-w-3xl text-center text-[0.667rem] leading-relaxed text-muted sm:mt-4 sm:text-lg">
          Use the fighter pilot's OODA Loop and Monte Carlo Simulator to inform your financial
          path.
        </p>
        <button
          type="button"
          onClick={() => {
            if (indexRef.current % 2 === 0) go("left");
          }}
          className="mt-3 font-display text-4xl font-semibold tracking-wide text-[#1a2330] underline decoration-[#3a8a58] decoration-2 underline-offset-[6px] hover:text-[#3a8a58] sm:text-5xl"
        >
          How It Works
        </button>
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
              className="absolute left-1 top-[40%] z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a2330] bg-white text-[#1a2330] shadow-sm hover:bg-[#f3faf6] sm:left-0"
            >
              <ScreenArrow direction="left" />
            </button>
            <button
              type="button"
              aria-label="Next laptop screen"
              onClick={() => go("left")}
              className="absolute right-1 top-[40%] z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a2330] bg-white text-[#1a2330] shadow-sm hover:bg-[#f3faf6] sm:right-0"
            >
              <ScreenArrow direction="right" />
            </button>
            {/* 12.5% of this width is 20% of a 16:10 screen. The extra drops the chin behind the page. */}
            <div style={{ marginBottom: "calc(-12.5% - 1.125rem)" }}>
              <div className="overflow-hidden rounded-t-xl border-8 border-[#1a2330] bg-[#fffcf6] sm:border-[12px]">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <div
                    className={
                      motion
                        ? "flex h-full w-[400%] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                        : "flex h-full w-[400%]"
                    }
                    style={{ transform: `translateX(${-index * 25}%)` }}
                    onTransitionEnd={onSwipeEnd}
                  >
                    <LaptopPane which={0} />
                    <LaptopPane which={1} />
                    <LaptopPane which={0} />
                    <LaptopPane which={1} />
                  </div>
                </div>
              </div>
              <div className="h-3 rounded-b-lg bg-[#1a2330]" />
              <div className="mx-auto h-1.5 w-28 rounded-b-md bg-[#243044]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LaptopPane({ which }: { which: 0 | 1 }) {
  if (which === 0) {
    return (
      <div className="relative h-full w-1/4 shrink-0">
        <img
          src="/brand/mach-run-demo.png?v=3"
          alt="A MACH RUN for the Hale household, on track for $2,500,000."
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      </div>
    );
  }
  return (
    <div className="h-full w-1/4 shrink-0 bg-[#e4ebf2] p-2 sm:p-3">
      <OodaLoop />
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
