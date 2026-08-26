import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** F-15: a same-color wake flows into the tail; a shock-chart leaves the nose. Nothing drawn over the airframe. */
export function MachGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="7 0 141 36"
      className={cn("shrink-0 text-fg", className)}
      aria-hidden
    >
      {/* Wake / history — same color, meets the tail, does not cross the jet */}
      <path
        d="M0 31.2 L3 29.4 L5.5 29.8 L9.2 26.9 L9.2 28.4 L5.2 31.2 Z"
        fill="currentColor"
      />
      {/* Eagle */}
      <g transform="translate(8 5)">
        <path
          fill="currentColor"
          d="M1.2 21.9 L3.6 21.5 L4.1 5.0 L7.7 5.0 L16.3 17.3 L17.9 19.0 L29.3 19.0 L29.7 19.4 L33.8 19.4 L34.2 19.0 L38.3 19.0 L38.7 18.5 L48.5 17.7 L48.9 17.3 L50.9 17.3 L53.3 16.4 L59.1 16.0 L59.5 15.6 L61.9 15.6 L62.3 15.2 L66.4 15.2 L66.8 14.7 L67.2 15.2 L69.6 15.2 L75.8 18.5 L81.5 19.8 L84.3 21.1 L85.5 21.1 L89.2 22.8 L89.2 23.2 L85.1 23.6 L84.7 24.0 L59.5 24.0 L59.1 24.5 L53.8 24.5 L53.3 25.3 L51.3 26.2 L46.4 26.6 L46.0 27.0 L30.1 27.0 L29.7 26.6 L25.2 26.2 L22.8 24.9 L10.6 24.5 L7.7 23.6 L5.7 24.0 L5.3 22.3 L1.2 21.9 Z"
        />
      </g>
      {/* Local shocks wrapping aft around the jet, not over the fuselage */}
      <path
        d="M97 21 C 62 3 28 4 10 16"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.32"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <path
        d="M97 33 C 64 46 30 44 10 34"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.32"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <path
        d="M94 23 C 66 8 36 9 16 18"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.16"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <path
        d="M94 31.5 C 66 42 36 41 16 33"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.16"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      {/* Shock-chart off the nose — same color */}
      <path
        d="M97.2 27.8 L106 24.2 L112 24.8 L120 18.4 L126 19 L136 11.2 L142 12 L147 6.5 L147 24 Q128 32 97.2 28.6 Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path
        d="M97.2 27.8 L106 24.2 L112 24.8 L120 18.4 L126 19 L136 11.2 L142 12 L147 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M97.2 28.2 Q128 33 147 24"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MachWordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const large = size === "lg";
  return (
    <span
      className={cn("relative -mr-1 inline-flex items-center py-1", className)}
      aria-label="MACH RUN"
    >
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -inset-x-2 -inset-y-1 h-[calc(100%+8px)] w-[calc(100%+16px)] overflow-visible text-fg"
      >
        {/* Vapor cone wrapping MACH + the Eagle, from the nose aft */}
        <path
          d="M82 38 C 48 4 14 6 3 50 C 14 94 48 96 82 62"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.34"
          strokeWidth="0.9"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M80 42 C 50 12 18 14 7 50 C 18 86 50 88 80 58"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="0.7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Left wrap around the M */}
        <path
          d="M10 22 Q -2 50 10 78"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="0.85"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className={cn(
          "relative z-10 font-display font-medium tracking-[0.12em] text-fg",
          large ? "text-2xl" : "text-xl",
        )}
      >
        MACH RUN
      </span>
      <MachGlyph
        className={
          large
            ? "relative z-10 -ml-5 h-10 w-[13.5rem]"
            : "relative z-10 -ml-4 h-7 w-[8.75rem] sm:-ml-5 sm:h-8 sm:w-[10.5rem]"
        }
      />
    </span>
  );
}

export function BrandLockup({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const large = size === "lg";
  return (
    <span className={cn("inline-flex items-center gap-2.5 sm:gap-3", className)}>
      <img
        src="/tof-logo.png"
        alt="Time of Flight LLC"
        className={
          large
            ? "h-8 w-auto max-w-[9.5rem] object-contain object-left sm:h-9 sm:max-w-[11rem]"
            : "h-6 w-auto max-w-[7.5rem] object-contain object-left sm:h-7 sm:max-w-[9rem]"
        }
      />
      <MachWordmark size={size} />
    </span>
  );
}

export function MachFooter() {
  return (
    <footer className="mt-8 border-t border-border">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
          <BrandLockup size="lg" />
          <p className="text-xs tracking-[0.14em] text-subtle">
            The Supersonic Financial Calculator from Time Of Flight LLC
          </p>
        </div>
        <p className="font-display text-lg text-fg">
          Measure · Allocate · Compound · Harvest
        </p>
        <dl className="grid grid-cols-1 gap-4 text-sm text-muted md:grid-cols-4 md:gap-6">
          <div>
            <dt className="font-medium text-fg">Measure</dt>
            <dd className="mt-0.5">Observe your financial starting point…</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Allocate</dt>
            <dd className="mt-0.5">Orient where your dollars go…</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Compound</dt>
            <dd className="mt-0.5">Decide to let time do the heavy lifting…</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Harvest</dt>
            <dd className="mt-0.5">Act on your efforts — enjoy the fruit of your labor.</dd>
          </div>
        </dl>
        <div className="w-full space-y-2 text-xs leading-relaxed text-subtle">
          <p>
            <Link to="/pricing" className="text-muted underline-offset-4 hover:text-fg hover:underline">
              Free vs MACH paid
            </Link>
            {" — "}$4/month or $40/year unlocks unlimited accounts, contribution
            rules, income stages, and the full OODA.
          </p>
          <p>
            * MACH OODA AI analysis is for entertainment purposes only. It is
            not financial, tax, legal, or investment advice.
          </p>
          <p>
            Projections are hypothetical illustrations based on the numbers and
            rates you type in. They are not guarantees of future results. Past
            performance does not guarantee future returns. Markets, inflation,
            taxes, longevity, health costs, and policy can all go differently
            than modeled. Account rules, contribution limits, and benefit
            formulas change.
          </p>
          <p>
            Social Security, military retirement, VA compensation, and similar
            figures are estimates, not official determinations. Confirm amounts
            with the Social Security Administration, DFAS, VA, your plan
            administrator, and a qualified advisor before you act. You are
            solely responsible for your financial decisions.
          </p>
          <p>
            Observe, Orient, Decide and Act (OODA) comes from the late, great
            U.S. Air Force Col. John Boyd (Ret.). His Energy-Maneuverability theory and the OODA Loop changed
            the world. Any mention of OODA or the OODA Loop on this site refers
            to Boyd’s publicly circulated work — not to any private organization
            that later trademarked, copyrighted, or packaged his ideas.
          </p>
        </div>
      </div>
    </footer>
  );
}
