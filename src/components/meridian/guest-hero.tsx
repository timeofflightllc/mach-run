import { useState } from "react";
import { PrimaryButton } from "@/components/ui/field";
import { demoPlan, planHasEntries } from "@/lib/plan/demo-plan";
import { usePlanStore } from "@/lib/plan/store";

/** Line sketch of a four-ship bomb burst. Tails point back at the laptop; smoke does the rest. */
function BombBurstSketch() {
  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-0 hidden h-[155%] w-screen -translate-x-1/2 -translate-y-[30%] md:block"
      viewBox="0 0 1600 900"
      fill="none"
      aria-hidden
    >
      <SmokeTrail d="M800 640 C 720 560, 380 280, 150 130" />
      <SmokeTrail d="M800 640 C 880 560, 1220 280, 1450 130" />
      <SmokeTrail d="M800 640 C 640 590, 383 373, 304 384 L 165 403" />
      <SmokeTrail d="M800 640 C 960 590, 1216 381, 1295 392 L 1434 412" />
      <g stroke="#1a2330" strokeLinecap="round" strokeLinejoin="round">
        <SketchJet x={118} y={112} rotate={-152} scale={2.35} />
        <SketchJet x={1482} y={112} rotate={-28} scale={2.35} />
        <SketchJet x={48} y={424} rotate={172} scale={2.2} />
        <SketchJet x={1552} y={424} rotate={8} scale={2.2} />
      </g>
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
}: {
  x: number;
  y: number;
  rotate: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      {/* Slight Mach cone. Opens aft of the nose, aircraft sits in front of it. */}
      <g fill="none" stroke="#6a7b8c" strokeLinecap="round">
        <path d="M58 -1 C 22 -20, -16 -36, -48 -30" strokeWidth="1.15" opacity="0.55" />
        <path d="M58 5 C 20 22, -12 38, -42 32" strokeWidth="1.15" opacity="0.55" />
        <path d="M46 -0.5 C 18 -12, -2 -18, -22 -14" strokeWidth="0.85" opacity="0.4" />
        <path d="M46 4 C 16 14, 0 20, -18 16" strokeWidth="0.85" opacity="0.4" />
      </g>
      <path d="M-46 1.5C-16-2 22-3 48 0.5c8 1 16 2.2 22 3-8 1.2-18 2.4-28 2.6C8 7.2-22 6-46 2.4" strokeWidth="1.7" />
      <path d="M-6-1c3-7 12-9 20-4.5" strokeWidth="1.5" />
      <path d="M6 3 L-14 22 L16 5.5" strokeWidth="1.55" />
      <path d="M-30-0.5 L-40-16 L-22 0.5" strokeWidth="1.55" />
      <path d="M-24 0.4 L-32-13 L-16 1.2" strokeWidth="1.35" />
      <path d="M-34 2.5 L-50 11 L-28 4" strokeWidth="1.45" />
      <path d="M2 3.2 L-8 9 L10 4.2" strokeWidth="1.3" />
      <path d="M-48 1.6 L-58 0.2 M-50 4.2 L-57 6.5" strokeWidth="1.15" opacity="0.8" />
    </g>
  );
}

export function GuestHero({ onShowFamily }: { onShowFamily: () => void }) {
  const [confirming, setConfirming] = useState(false);

  function fill() {
    usePlanStore.getState().setPlan(demoPlan());
    setConfirming(false);
    onShowFamily();
  }

  function prefill() {
    if (planHasEntries(usePlanStore.getState().plan)) {
      setConfirming(true);
      return;
    }
    fill();
  }

  return (
    <section className="relative z-0 overflow-x-clip border-t border-border bg-bg">
      <div className="page-gutter mx-auto flex max-w-none flex-col items-center pt-10 sm:pt-14">
        <h2 className="max-w-4xl text-center font-display text-3xl font-semibold leading-[1.15] text-[#1a2330] sm:text-4xl">
          The Supersonic Retirement Calculator built for those who want
          global situational awareness of their finances.
        </h2>
        <p className="mt-4 max-w-3xl text-center text-base leading-relaxed text-muted sm:text-lg">
          Take ownership of your financial picture — Measure, Allocate, Compound, Harvest — MACH.
        </p>
        <div className="mt-6 flex w-full max-w-3xl flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
          <PrimaryButton
            className="h-auto min-h-11 whitespace-normal px-4 py-2.5 text-center leading-snug sm:max-w-xs"
            onClick={prefill}
          >
            Pre-Fill MACH RUN with Demo Information
          </PrimaryButton>
          <PrimaryButton
            className="h-auto min-h-11 whitespace-normal px-4 py-2.5 text-center leading-snug sm:max-w-xs"
            onClick={() => {
              setConfirming(false);
              onShowFamily();
            }}
          >
            Try MACH RUN with your information
          </PrimaryButton>
        </div>
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
        <div className="relative mt-10 w-full">
          <BombBurstSketch />
          <div className="relative z-10 mx-auto w-full max-w-3xl px-2">
          {/* 12.5% of this width is 20% of a 16:10 screen. The extra drops the chin behind the page. */}
          <div style={{ marginBottom: "calc(-12.5% - 1.125rem)" }}>
            <div className="overflow-hidden rounded-t-xl border-8 border-[#1a2330] bg-[#fffcf6] sm:border-[12px]">
              <img
                src="/brand/mach-run-demo.png?v=3"
                alt="A MACH RUN for the Hale household, on track for $2,500,000."
                className="aspect-[16/10] w-full object-cover object-top"
              />
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
