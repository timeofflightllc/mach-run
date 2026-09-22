import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { SiteNav } from "@/components/meridian/site-nav";
import { loadPublicSiteCopy } from "@/lib/site-copy/api";
import {
  DEFAULT_FOOTER_COPY,
  footerFromSiteCopy,
} from "@/lib/site-copy/footer-copy";
import type { FooterCopy } from "@/lib/site-copy/types";

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

export function MachFooter({ variant = "short" }: { variant?: "full" | "short" }) {
  const [copy, setCopy] = useState<FooterCopy>(DEFAULT_FOOTER_COPY);
  useEffect(() => {
    if (variant !== "full") return;
    let live = true;
    void loadPublicSiteCopy()
      .then((site) => {
        if (live) setCopy(footerFromSiteCopy(site));
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      live = false;
    };
  }, [variant]);

  const links = (
    <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <Link to="/privacy" className="text-muted underline-offset-4 hover:text-fg hover:underline">
        Privacy
      </Link>
      <Link
        to="/legal"
        hash="terms"
        className="text-muted underline-offset-4 hover:text-fg hover:underline"
      >
        Terms
      </Link>
      <Link to="/contact" className="text-muted underline-offset-4 hover:text-fg hover:underline">
        Contact
      </Link>
    </nav>
  );

  if (variant === "short") {
    return (
      <footer className="mt-8 border-t border-border bg-bg">
        <div className="page-gutter mx-auto flex w-full flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="text-sm font-medium text-fg">
            MACH RUN
          </Link>
          {links}
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-8 border-t border-border bg-bg">
      <div className="page-gutter mx-auto flex w-full flex-col gap-5 py-8">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <BrandLockup size="lg" framed />
          <SiteNav className="text-base" />
        </div>
        <dl className="grid grid-cols-1 gap-4 text-sm text-muted md:grid-cols-4 md:gap-6">
          <div>
            <dt className="font-medium text-fg">{copy.measureTitle}</dt>
            <dd className="mt-0.5">{copy.measureBody}</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">{copy.allocateTitle}</dt>
            <dd className="mt-0.5">{copy.allocateBody}</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">{copy.compoundTitle}</dt>
            <dd className="mt-0.5">{copy.compoundBody}</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">{copy.harvestTitle}</dt>
            <dd className="mt-0.5">{copy.harvestBody}</dd>
          </div>
        </dl>
        <div className="w-full space-y-2 text-xs leading-relaxed text-subtle">
          <p>
            <Link to="/faq" className="text-muted underline-offset-4 hover:text-fg hover:underline">
              FAQ
            </Link>
            {" — "}
            {copy.faqBlurb}
          </p>
          <p>
            <Link to="/pricing" className="text-muted underline-offset-4 hover:text-fg hover:underline">
              Free vs MACH RUN paid
            </Link>
            {" — "}
            {copy.paidBlurb}
          </p>
          <p>
            <Link to="/privacy" className="text-fg font-medium underline underline-offset-4 hover:text-accent">
              Privacy policy
            </Link>
            {" — "}
            {copy.privacyBlurb}
          </p>
          <p>{copy.oodaAiLine}</p>
          <p>{copy.projections}</p>
          <p>{copy.benefits}</p>
          <p>{copy.boyd}</p>
          <p>
            <Link
              to="/legal"
              hash="terms"
              className="text-muted underline-offset-4 hover:text-fg hover:underline"
            >
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
