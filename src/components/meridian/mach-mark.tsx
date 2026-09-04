import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** F-15: a same-color wake flows into the tail; a shock-chart leaves the nose. Nothing drawn over the airframe. */
export function MachGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="7 0 141 36"
      width="168"
      height="32"
      className={cn("h-8 w-[10.5rem] shrink-0 text-fg", className)}
      style={{ pointerEvents: "none", maxHeight: 32 }}
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
  framed = false,
}: {
  className?: string;
  size?: "md" | "lg";
  framed?: boolean;
}) {
  const large = size === "lg";
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)} aria-label="MACH RUN.com">
      <img
        src="/brand/mach-run-logo.jpg?v=20"
        alt="MACH RUN.com"
        width={1522}
        height={536}
        className={cn(
          "block h-auto shrink-0 object-contain object-left",
          large
            ? "w-[15.75rem] max-w-[15.75rem]"
            : "w-[10.9rem] max-w-[10.9rem] sm:w-[12.6rem] sm:max-w-[12.6rem]",
          framed && "shadow-[0_0_0_1px_#c5cdd6]",
        )}
      />
    </span>
  );
}

export function BrandLockup({
  className,
  size = "md",
  framed = false,
  showTagline = true,
}: {
  className?: string;
  size?: "md" | "lg";
  framed?: boolean;
  showTagline?: boolean;
}) {
  const large = size === "lg";
  return (
    <span className={cn("inline-flex shrink-0 flex-col items-stretch", className)}>
      <MachWordmark size={size} framed={framed} />
      {showTagline ? (
        <span
          className={cn(
            "mt-1.5 w-full text-center font-bold leading-snug tracking-[0.12em] text-muted",
            large ? "text-[13px] sm:text-sm" : "text-xs sm:text-[13px]",
          )}
        >
          The Supersonic Financial Calculator
        </span>
      ) : null}
    </span>
  );
}

export function MachFooter() {
  return (
    <footer className="mt-8 border-t border-border">
      <div className="page-gutter mx-auto flex w-full flex-col gap-5 py-8">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
          <BrandLockup size="lg" framed />
        </div>
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
              Free vs MACH RUN paid
            </Link>
            {" — "}$4/month or $40/year unlocks unlimited accounts, contribution
            rules, income stages, Net Worth, and the full OODA.
          </p>
          <p>
            <Link to="/privacy" className="text-muted underline-offset-4 hover:text-fg hover:underline">
              Privacy
            </Link>
            {" — "}
            Your MACH Run data is encrypted in transit (HTTPS) and encrypted at
            rest on the server.
          </p>
          <p>
            * MACH OODA AI analysis and OODA AI questions are for
            entertainment purposes only. They are not financial, tax, legal, or
            investment advice.
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
            Observe, Orient, Decide, Act (OODA) comes from the late, great
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
