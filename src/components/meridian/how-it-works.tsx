function ringArrow(start: number, tip: number) {
  const cx = 100;
  const cy = 100;
  const r = 78;
  const pt = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    return [cx + r * Math.sin(t), cy - r * Math.cos(t)] as const;
  };
  const [x0, y0] = pt(start);
  const [x1, y1] = pt(tip - 10);
  const d = `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  const t = (tip * Math.PI) / 180;
  const x = cx + r * Math.sin(t);
  const y = cy - r * Math.cos(t);
  const tx = Math.cos(t);
  const ty = Math.sin(t);
  const len = 10;
  const wid = 5.2;
  const tipPt = [x + tx * 0.6, y + ty * 0.6];
  const base = [x - tx * len, y - ty * len];
  const left = [base[0] - ty * wid, base[1] + tx * wid];
  const right = [base[0] + ty * wid, base[1] - tx * wid];
  const points = [tipPt, left, right].map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  return { d, points };
}

const ARROWS = [
  ringArrow(18, 78),
  ringArrow(108, 168),
  ringArrow(198, 258),
  ringArrow(288, 348),
];

function Phase({
  title,
  items,
  align,
}: {
  title: string;
  items: string[];
  align: "center" | "left" | "right";
}) {
  return (
    <div className={align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}>
      <p className="font-display text-[clamp(1.05rem,4.8cqi,1.9rem)] font-semibold uppercase leading-none tracking-[0.12em] text-[#1a2330]">
        {title}
      </p>
      <ul className="mt-0.5 space-y-0">
        {items.map((item) => (
          <li
            key={item}
            className="text-[clamp(0.62rem,2.15cqi,0.95rem)] leading-tight text-[#5c6b7a]"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The OODA ring. Sized for the laptop screen. The center column is 20% wider than the first fit. */
export function OodaLoop() {
  return (
    <div className="@container grid h-full min-h-0 w-full grid-cols-[1fr_1.16fr_1fr] grid-rows-[auto_auto_auto_minmax(0,1fr)] items-center gap-x-1 gap-y-1 overflow-hidden">
      <div className="col-span-3">
        <Phase
          title="Observe"
          items={["Family & Assumptions", "Assets & Liabilities"]}
          align="center"
        />
      </div>
      <div className="relative col-start-1 row-start-2 min-w-0 self-stretch pr-1">
        <div className="absolute inset-x-0 top-1/2 -translate-y-3 text-right">
          <p className="-translate-y-1/2 font-display text-[clamp(1.05rem,4.8cqi,1.9rem)] font-semibold uppercase leading-none tracking-[0.12em] text-[#1a2330]">
            Act
          </p>
          <ul className="space-y-0">
            {["Takeoff & Analysis", "Charts, Ledgers & Monte Carlo"].map((item) => (
              <li key={item} className="whitespace-nowrap text-[clamp(0.62rem,2.15cqi,0.95rem)] leading-tight text-[#5c6b7a]">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="relative col-start-2 row-start-2 flex w-full -translate-y-3 justify-center">
        <div className="relative aspect-square w-[92%]">
          <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
            <circle cx="100" cy="100" r="62" fill="#fffdf8" stroke="#e8c547" strokeWidth="1.25" />
            <circle cx="100" cy="100" r="78" fill="none" stroke="#1a2330" strokeOpacity="0.08" strokeWidth="10" />
            {ARROWS.map((arrow) => (
              <g key={arrow.d}>
                <path d={arrow.d} fill="none" stroke="#1a2330" strokeWidth="2.4" strokeLinecap="round" />
                <polygon points={arrow.points} fill="#3a8a58" />
              </g>
            ))}
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
      <div className="relative col-start-3 row-start-2 min-w-0 self-stretch pl-1">
        <div className="absolute inset-x-0 top-1/2 -translate-y-3 text-left">
          <p className="-translate-y-1/2 font-display text-[clamp(1.05rem,4.8cqi,1.9rem)] font-semibold uppercase leading-none tracking-[0.12em] text-[#1a2330]">
            Orient
          </p>
          <ul className="space-y-0">
            <li className="text-[clamp(0.62rem,2.15cqi,0.95rem)] leading-tight text-[#5c6b7a]">
              Income & Spending
            </li>
          </ul>
        </div>
      </div>
      <div className="col-start-2 row-start-3 -translate-y-4">
        <div className="flex w-full flex-col items-center text-center">
          <p className="pl-[0.12em] font-display text-[clamp(1.05rem,4.8cqi,1.9rem)] font-semibold uppercase leading-none tracking-[0.12em] text-[#1a2330]">
            Decide
          </p>
          <p className="mt-0.5 text-[clamp(0.62rem,2.15cqi,0.95rem)] leading-tight text-[#5c6b7a]">
            Contributions
          </p>
        </div>
      </div>
    </div>
  );
}
