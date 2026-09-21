import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { SiteNav } from "@/components/meridian/site-nav";

/** Nested Mach-cone chevrons. currentColor = outer; inner is titanium. */
export function MachGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-8 w-8 shrink-0 text-fg", className)}
      aria-hidden
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M2 6 L40 24 L2 42 L2 33.2 L26.5 24 L2 14.8 Z M8.5 16.2 L28 24 L8.5 31.8 L8.5 26.6 L18.5 24 L8.5 21.4 Z"
      />
      <path
        fill="#A8B4C0"
        d="M14 18.2 L31.5 24 L14 29.8 L14 26.4 L22.5 24 L14 21.6 Z"
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
        src="/brand/mach-run-logo.jpg?v=21"
        alt="MACH RUN.com"
        width={1257}
        height={428}
        className={cn(
          "block h-auto shrink-0 object-contain object-left",
          large
            ? "w-[16.75rem] max-w-[16.75rem]"
            : "w-[7.5rem] max-w-[7.5rem] sm:w-[12.5rem] sm:max-w-[12.5rem] md:w-[14.5rem] md:max-w-[14.5rem]",
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
  showTagline = false,
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
          The Supersonic Retirement Calculator
        </span>
      ) : null}
    </span>
  );
}

export function MachFooter() {
  return (
    <footer className="mt-8 border-t border-border bg-bg">
      <div className="page-gutter mx-auto flex w-full flex-col gap-5 py-8">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <BrandLockup size="lg" />
          <SiteNav className="text-base" />
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
            <Link to="/privacy" className="text-fg font-medium underline underline-offset-4 hover:text-accent">
              Privacy policy
            </Link>
            {" — "}
            Your MACH Run data is encrypted in transit (HTTPS) and encrypted at
            rest on the server. We do not sell it.
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
