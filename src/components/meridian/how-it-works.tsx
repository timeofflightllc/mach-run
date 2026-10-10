import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function ringArrow(start: number, tip: number, len = 10, wid = 5.2) {
  const cx = 100;
  const cy = 100;
  const r = 78;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const at = (deg: number) => {
    const t = rad(deg);
    return [cx + r * Math.sin(t), cy - r * Math.cos(t)] as const;
  };
  const span = (len / r) * (180 / Math.PI);
  const baseDeg = tip - span;
  const [x0, y0] = at(start);
  const joinDeg = baseDeg + span * 0.42;
  const [jx, jy] = at(joinDeg);
  const d = `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${jx.toFixed(2)} ${jy.toFixed(2)}`;
  const t = rad(tip);
  const tx = Math.cos(t);
  const ty = Math.sin(t);
  const [bx, by] = at(baseDeg);
  const tipPt = at(tip);
  const left = [bx - ty * wid, by + tx * wid];
  const right = [bx + ty * wid, by - tx * wid];
  const nudge = 1.6;
  const points = [tipPt, left, right].map((p) => `${(p[0] + nudge).toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  return { d, points };
}

const ARROWS = [
  ringArrow(18, 78, 20, 7.5),
  ringArrow(108, 168, 20, 7.5),
  ringArrow(198, 258, 20, 7.5),
  ringArrow(288, 348, 20, 7.5),
];

const MOBILE_ARROWS = [
  ringArrow(18, 78, 26, 10),
  ringArrow(108, 168, 26, 10),
  ringArrow(198, 258, 26, 10),
  ringArrow(288, 348, 26, 10),
];

const TIPS = {
  observe: ["Family & Assumptions", "Assets & Liabilities"],
  orient: ["Income & Spending"],
  decide: ["Contributions"],
  act: ["Takeoff & Analysis", "Charts, Ledgers & Monte Carlo"],
} as const;

type TipId = keyof typeof TIPS;

const titleClass =
  "font-display text-[clamp(1.25rem,6.6cqi,2.5rem)] font-semibold uppercase leading-none tracking-[0.12em] text-[#1a2330]";

function Phase({
  title,
  tip,
  align,
  open,
  onToggle,
}: {
  title: string;
  tip: TipId;
  align: "center" | "left" | "right";
  open: TipId | null;
  onToggle: (id: TipId, anchor: DOMRect) => void;
}) {
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return (
    <div className={alignClass}>
      <p className={`hidden sm:block ${titleClass}`}>{title}</p>
      <button
        type="button"
        className={`sm:hidden ${titleClass}`}
        aria-expanded={open === tip}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(tip, event.currentTarget.getBoundingClientRect());
        }}
      >
        {title}
      </button>
      <ul className="mt-0.5 hidden space-y-0 sm:block">
        {TIPS[tip].map((item) => (
          <li key={item} className="text-[clamp(0.62rem,2.15cqi,0.95rem)] leading-tight text-[#5c6b7a]">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SideLabel({
  title,
  tip,
  align,
  open,
  onToggle,
}: {
  title: string;
  tip: TipId;
  align: "left" | "right";
  open: TipId | null;
  onToggle: (id: TipId, anchor: DOMRect) => void;
}) {
  return (
    <div className={`absolute inset-x-0 top-1/2 -translate-y-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <p className={`hidden -translate-y-1/2 sm:block ${titleClass}`}>{title}</p>
      <button
        type="button"
        className={`-translate-y-1/2 sm:hidden ${titleClass}`}
        aria-expanded={open === tip}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(tip, event.currentTarget.getBoundingClientRect());
        }}
      >
        {title}
      </button>
      <ul className="-mt-2 hidden space-y-0 sm:block">
        {TIPS[tip].map((item) => (
          <li key={item} className="text-[clamp(0.62rem,2.15cqi,0.95rem)] leading-tight text-[#5c6b7a]">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TipCard({ id, anchor }: { id: TipId; anchor: DOMRect }) {
  const below = anchor.bottom + 8;
  const openUp = below + 72 > window.innerHeight - 12;
  const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - 88, window.innerWidth - 184));
  return createPortal(
    <div
      className="fixed z-[80] w-44 rounded-md bg-white px-2.5 py-2 text-center shadow-[0_8px_24px_rgba(26,35,48,0.18)]"
      style={{ left, top: openUp ? anchor.top - 8 : below, transform: openUp ? "translateY(-100%)" : undefined }}
      role="tooltip"
    >
      {TIPS[id].map((item) => (
        <p key={item} className="text-xs leading-snug text-[#5c6b7a]">
          {item}
        </p>
      ))}
    </div>,
    document.body,
  );
}

/** The OODA ring. Sized for the laptop screen. The center column is 20% wider than the first fit. */
export function OodaLoop() {
  const [open, setOpen] = useState<TipId | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(null);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  function onToggle(id: TipId, next: DOMRect) {
    setAnchor(next);
    setOpen((current) => (current === id ? null : id));
  }

  return (
    <div className="@container grid h-full min-h-0 w-full grid-cols-[0.9fr_1.35fr_0.9fr] grid-rows-[auto_auto_auto] items-center gap-x-1 gap-y-1 overflow-hidden">
      <div className="col-span-3">
        <Phase title="Observe" tip="observe" align="center" open={open} onToggle={onToggle} />
      </div>
      <div className="relative col-start-1 row-start-2 min-w-0 self-stretch -translate-y-3 pr-1">
        <SideLabel title="Act" tip="act" align="right" open={open} onToggle={onToggle} />
      </div>
      <div className="relative col-start-2 row-start-2 flex w-full -translate-y-4 justify-center">
        <div className="relative aspect-square w-full">
          <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
            <circle cx="100" cy="100" r="62" fill="#fffdf8" stroke="#e8c547" strokeWidth="1.25" />
            <circle cx="100" cy="100" r="78" fill="none" stroke="#1a2330" strokeOpacity="0.08" strokeWidth="10" />
            <g className="sm:hidden">
              {MOBILE_ARROWS.map((arrow) => (
                <g key={arrow.d}>
                  <path d={arrow.d} fill="none" stroke="#1a2330" strokeWidth="7" strokeLinecap="round" />
                  <polygon points={arrow.points} fill="#3a8a58" />
                </g>
              ))}
            </g>
            <g className="hidden sm:block">
              {ARROWS.map((arrow) => (
                <g key={`desk-${arrow.d}`}>
                  <path d={arrow.d} fill="none" stroke="#1a2330" strokeWidth="2.4" strokeLinecap="round" />
                  <polygon points={arrow.points} fill="#3a8a58" />
                </g>
              ))}
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex w-[54%] flex-col items-center">
              <img
                src="/brand/mach-run-logo.jpg?v=23"
                alt="MACH RUN"
                width={887}
                height={271}
                draggable={false}
                className="block h-auto w-full max-w-none"
                style={{ imageRendering: "high-quality" }}
              />
              <p className="font-display text-[clamp(1.05rem,4.8cqi,1.85rem)] font-semibold leading-none tracking-wide text-[#1a2330]">
                Engine
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="relative col-start-3 row-start-2 min-w-0 self-stretch -translate-y-3 pl-1">
        <SideLabel title="Orient" tip="orient" align="left" open={open} onToggle={onToggle} />
      </div>
      <div className="col-start-2 row-start-3 -translate-y-12 text-center">
        <p className={`hidden pl-[0.12em] sm:block ${titleClass}`}>Decide</p>
        <button
          type="button"
          className={`pl-[0.12em] sm:hidden ${titleClass}`}
          aria-expanded={open === "decide"}
          onClick={(event) => {
            event.stopPropagation();
            onToggle("decide", event.currentTarget.getBoundingClientRect());
          }}
        >
          Decide
        </button>
        <p className="mt-0.5 hidden text-[clamp(0.62rem,2.15cqi,0.95rem)] leading-tight text-[#5c6b7a] sm:block">
          Contributions
        </p>
      </div>
      {mounted && open && anchor ? <TipCard id={open} anchor={anchor} /> : null}
    </div>
  );
}
