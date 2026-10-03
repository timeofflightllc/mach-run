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
      <p className="text-center text-[11px] font-bold leading-snug tracking-[0.12em] text-muted sm:text-xs md:min-w-0 md:flex-1 md:px-2 md:text-[13px] lg:text-lg lg:tracking-[0.08em]">
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

function FooterMark() {
  return (
    <img
      src="/brand/mach-mark.png"
      alt=""
      width={373}
      height={354}
      className="mx-auto mt-3 h-12 w-12 rounded-lg object-cover"
    />
  );
}

function CopyrightLine() {
  return (
    <>
      <p className="mt-1 border-t border-border pt-4 text-center text-[11px] leading-snug text-muted">
        Copyright © MACHRUN.com
      </p>
      <FooterMark />
    </>
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
        MACH RUN is a household calculator. What you read and what the charts draw is
        illustration, not a recommendation, and not financial, tax, legal, or investment advice.
        Each result is a what-if built only from the amounts, dates, and rates you enter. It is
        not a forecast of what your accounts will be worth, and it is not a path to follow on
        its own.
      </p>
      <p>
        A useful picture includes the whole household. Earned pay, a spouse's pay, military
        retired pay, VA disability compensation, Social Security, a TSP or IRA, Roth and taxable
        savings, and home equity all change the answer when they belong to you. Omit one and the
        run is missing part of the story.
      </p>
      <p>
        Change a date, a savings rate, or a spending number and watch the years move. That is
        what this calculator is for. It does not produce a financial plan, and it does not tell
        you what to do with your money. Those choices remain yours.
      </p>
      <p>
        Before you buy, sell, roll money over, claim a benefit, or move a large sum, talk with
        someone who is required to put your interest ahead of their own. MACH RUN does not give
        that advice. It does not offer or sell investments, insurance, or annuities.
      </p>
      <p>
        The formulas are kept current, but a statement, a benefits letter, or a product page can
        still show a different number. Those sources use their own rules, and an entry here can
        be incomplete. Nothing on this site is warranted as complete, exact, or suited to a
        particular decision. The longer notice is on the Legal page.
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
      <footer className="relative z-10 mt-8 w-screen max-w-[100vw] border-t border-border bg-bg [margin-left:calc(50%-50vw)] before:pointer-events-none before:absolute before:inset-x-0 before:-top-[calc(2rem+2px)] before:h-[calc(2rem+2px)] before:bg-bg before:content-['']">
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
            <FooterMark />
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="relative z-10 mt-8 border-t border-border bg-bg before:pointer-events-none before:absolute before:inset-x-0 before:-top-[calc(2rem+2px)] before:h-[calc(2rem+2px)] before:bg-bg before:content-['']">
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
