import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";

function headerOffset(): number {
  if (typeof document === "undefined") return 112;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--mach-header-h")
    .trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n + 8 : 112;
}

export function PinToggle({
  pinned,
  onToggle,
}: {
  pinned: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pinned}
      onClick={onToggle}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium",
        pinned
          ? "bg-accent text-accent-fg"
          : "text-muted hover:bg-elevated hover:text-fg",
      )}
    >
      <Pin className={cn("size-3.5", pinned && "fill-current")} />
      {pinned ? "Pinned" : "Pin"}
    </button>
  );
}

export function Pinnable({
  pinned,
  stackTop,
  children,
}: {
  pinned: boolean;
  stackTop: number;
  children: ReactNode;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0, left: 0 });

  useLayoutEffect(() => {
    const el = slot.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: el.offsetHeight, left: r.left });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync);
    };
  }, [pinned, stackTop]);

  return (
    <div
      ref={slot}
      className="relative"
      style={pinned && box.h ? { height: box.h } : undefined}
    >
      <div
        className={cn(pinned && "fixed z-20")}
        style={
          pinned && box.w
            ? {
                top: stackTop || headerOffset(),
                left: box.left,
                width: box.w,
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

export function useChartPins() {
  const [pinWealth, setPinWealth] = useState(false);
  const [pinCash, setPinCash] = useState(false);
  const wealthSlot = useRef<HTMLDivElement>(null);
  const [wealthH, setWealthH] = useState(0);

  useLayoutEffect(() => {
    const el = wealthSlot.current;
    if (!el) return;
    const sync = () => setWealthH(el.offsetHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pinWealth]);

  const top = headerOffset();
  const cashTop = pinWealth ? top + wealthH + 16 : top;

  return {
    pinWealth,
    pinCash,
    toggleWealth: () => setPinWealth((v) => !v),
    toggleCash: () => setPinCash((v) => !v),
    wealthSlot,
    wealthTop: top,
    cashTop,
  };
}