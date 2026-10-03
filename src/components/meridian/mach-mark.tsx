import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { SiteMenu, SiteNav } from "@/components/meridian/site-nav";
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
}: {
  className?: string;
  size?: "md" | "lg";
  framed?: boolean;
}) {
  const large = size === "lg";
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)} aria-label="MACH RUN">
      <img
        src="/brand/mach-run-logo.jpg?v=23"
        alt="MACH RUN"
        width={887}
        height={271}
        className={cn(
          "block w-auto shrink-0 object-contain object-left",
          large ? "h-16 sm:h-20" : "h-12 sm:h-14 md:h-16",
        )}
      />
    </span>
  );
}

export function BrandLockup({
  className,
  size = "md",
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
      <MachWordmark size={size} />
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

/** Top bar on every page except the calculator. */
export function PageMast() {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="inline-block shrink-0 opacity-90 hover:opacity-100">
          <BrandLockup framed />
        </Link>
        <div className="flex shrink-0 items-center gap-1 md:hidden">
          <SiteMenu align="right" />
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
          >
            Home
          </Link>
        </div>
      </div>
      <p className="text-center text-[11px] font-bold leading-snug tracking-[0.12em] text-muted sm:text-xs md:min-w-0 md:flex-1 md:px-2 md:text-[13px]">
        The Supersonic Retirement Calculator
      </p>
      <div className="hidden shrink-0 items-center gap-1 md:flex">
        <SiteMenu align="right" />
        <Link
          to="/"
          className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
        >
          Home
        </Link>
      </div>
    </div>
  );
}

function CopyrightLine() {
  return (
    <p className="mt-1 border-t border-border pt-4 text-center text-[11px] leading-snug text-muted">
      Copyright © MACHRUN.com
    </p>
  );
}

function MachSteps({ copy }: { copy: FooterCopy }) {
  const steps = [
    [copy.measureTitle, copy.measureBody],
    [copy.allocateTitle, copy.allocateBody],
    [copy.compoundTitle, copy.compoundBody],
    [copy.harvestTitle, copy.harvestBody],
  ] as const;
  return (
    <dl className="grid grid-cols-1 gap-4 text-sm text-muted sm:grid-cols-2 md:grid-cols-4 md:gap-6">
      {steps.map(([title, body]) => (
        <div key={title}>
          <dt className="font-medium text-fg">{title}</dt>
          <dd className="mt-0.5">{body}</dd>
        </div>
      ))}
    </dl>
  );
}

function PlannerDisclaimer() {
  return (
    <div className="w-full space-y-2 text-left text-[12.5px] leading-relaxed text-muted">
      <p className="font-semibold text-fg">DISCLAIMER</p>
      <p>
        The content, calculators, and tools on MACH RUN are for informational and educational
        purposes only. They are not financial, tax, legal, or investment advice. They apply general
        financial concepts to the numbers you provide, and the results are hypothetical. They are a
        planning sketch, not a projection you should rely on by themselves. A retirement picture
        should include the full household, not a single account. Retired pay, VA disability
        compensation, Social Security, a TSP or an IRA, a spouse's paycheck, home equity, and
        savings all belong in the same calculation. If any of those are left out, the result is
        incomplete. MACH RUN lets you estimate future income needs and see how a change in inputs
        affects the result. It is a tool you may use on your own behalf to think through a plan. It
        is not a complete financial plan, and it should not be acted on as one. You alone own the
        decisions. Before you invest, move money, or make a significant financial decision, consult
        a professional who has a fiduciary duty to you. MACH RUN is not a financial advisor, and it
        does not sell financial products. MACH RUN works to keep its information and calculations
        accurate and current. The figures shown here are based on the inputs you enter and may
        differ from those on a financial institution's or product provider's site. All content,
        tools, calculations, estimates, and scenarios are provided without warranty. For further
        information, please click Legal below.
      </p>
    </div>
  );
}

export function MachFooter({
  variant = "short",
  disclaimer = false,
}: {
  variant?: "full" | "short";
  disclaimer?: boolean;
}) {
  const [copy, setCopy] = useState<FooterCopy>(DEFAULT_FOOTER_COPY);
  useEffect(() => {
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
  }, []);

  if (variant === "short") {
    return (
      <footer className="relative z-10 mt-8 w-screen max-w-[100vw] border-t border-border bg-bg [margin-left:calc(50%-50vw)]">
        <div className="short-footer-gutter mx-auto flex w-full flex-col gap-3 py-6">
          <div className="flex items-center justify-between gap-x-6">
            <Link to="/" className="inline-flex shrink-0 items-center" aria-label="MACH RUN">
              <img
                src="/brand/mach-run-logo.jpg?v=23"
                alt=""
                width={887}
                height={271}
                className="h-9 w-auto sm:h-11"
              />
            </Link>
            <SiteNav tone="page" className="min-w-0 max-w-[72%] justify-end" />
          </div>
          <MachSteps copy={copy} />
          <div className="mt-1 w-full border-t border-border pt-4">
            {disclaimer ? (
              <div className="mb-4">
                <PlannerDisclaimer />
              </div>
            ) : null}
            <p className="w-full text-center text-[12.5px] leading-snug text-muted">
              <Link to="/privacy" className="font-medium text-fg underline underline-offset-4 hover:text-accent">Privacy</Link>
              <span className="px-4">|</span>
              <Link to="/legal" className="font-medium text-fg underline underline-offset-4 hover:text-accent">Legal</Link>
            </p>
            <p className="mt-2 w-full text-center text-[11px] leading-snug text-muted">Copyright © MACHRUN.com</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="relative z-10 mt-8 border-t border-border bg-bg">
      <div className="page-gutter mx-auto flex w-full flex-col gap-5 py-8">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <BrandLockup size="lg" framed />
          <SiteNav className="text-base" />
        </div>
        <MachSteps copy={copy} />
        <div className="w-full space-y-2 text-xs leading-relaxed text-subtle">
          <p>
            <Link
              to="/legal"
              hash="terms"
              className="text-fg font-medium underline underline-offset-4 hover:text-accent"
            >
              Terms of Service
            </Link>
            {" | "}
            <Link to="/privacy" className="text-fg font-medium underline underline-offset-4 hover:text-accent">
              Privacy Policy
            </Link>
            {" — "}
            {copy.privacyBlurb}
          </p>
          <p>{copy.oodaAiLine}</p>
          <p>{copy.projections}</p>
          <p>{copy.benefits}</p>
          <p>{copy.boyd}</p>
          <CopyrightLine />
        </div>
      </div>
    </footer>
  );
}
