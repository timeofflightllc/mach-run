import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandLockup, MachFooter } from "@/components/meridian/mach-mark";
import { SiteMenu } from "@/components/meridian/site-nav";
import { PrimaryButton, TextInput } from "@/components/ui/field";
import { peekPromoCode, startBillingPortal, startCheckout } from "@/lib/billing/api";
import {
  ADVISOR_MONTHLY_USD,
  ADVISOR_TRIAL_DAYS,
  ADVISOR_UNLIMITED_MONTHLY_USD,
  ADVISOR_UNLIMITED_YEARLY_USD,
  ADVISOR_YEARLY_USD,
  MACH_MONTHLY_USD,
  MACH_YEARLY_USD,
  UNLIMITED_MONTHLY_USD,
  UNLIMITED_YEARLY_USD,
  isAdvisorPlan,
  packageLabel,
  type CheckoutPackage,
} from "@/lib/billing/limits";
import { builtinPromo, describePromo, evaluatePromo, type PromoRecord } from "@/lib/billing/promo";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";
import { parsePricingCopy } from "@/lib/site-copy/pricing-copy";

export const Route = createFileRoute("/pricing")({
  loader: () => loadPublicSiteCopy(),
  component: Pricing,
});

function billingSelectedLabel(interval: "month" | "year" | null): string | null {
  if (interval === "year") return "(Annual billing selected)";
  if (interval === "month") return "(Monthly billing selected)";
  return null;
}

function YourPlanMark({ interval }: { interval: "month" | "year" | null }) {
  const note = billingSelectedLabel(interval);
  return (
    <span className="max-w-[12rem] text-right">
      <span className="inline-block rounded-sm bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-fg">
        Your plan
      </span>
      {note ? (
        <span className="mt-1 block text-[10px] font-medium leading-snug text-fg">
          {note}
        </span>
      ) : null}
    </span>
  );
}

function Pricing() {
  const site = Route.useLoaderData();
  const copy = parsePricingCopy(pageBySlug(site, "pricing").body);
  const ent = useEntitlement();
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [interval, setInterval] = useState<"month" | "year">(
    ent.interval === "year" ? "year" : "month",
  );
  const [audience, setAudience] = useState<"individual" | "advisor">(
    isAdvisorPlan(ent.plan) ? "advisor" : "individual",
  );
  const [trialCode, setTrialCode] = useState("");
  const [livePromo, setLivePromo] = useState<PromoRecord | null | undefined>(undefined);
  const typedCode = trialCode.trim().length > 0;
  useEffect(() => {
    if (!typedCode) {
      setLivePromo(undefined);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      void peekPromoCode({ data: { code: trialCode } })
        .then((r) => {
          if (!live) return;
          setLivePromo(r.ok ? r.promo : null);
        })
        .catch(() => {
          if (live) setLivePromo(undefined);
        });
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [trialCode, typedCode]);
  const promo: PromoRecord | null =
    livePromo === undefined ? builtinPromo(trialCode) : livePromo;
  const promoState = evaluatePromo(promo, null);
  const promoDays = promoState.ok && promo?.kind === "trial_days" ? promo.trialDays : null;
  const promoPct = promoState.ok && promo?.kind === "percent_off" ? promo.percentOff : null;
  const checkingCode = typedCode && livePromo === undefined && !builtinPromo(trialCode);
  const codeInvalid = typedCode && !checkingCode && !promoState.ok;
  const hasTrial = promoDays != null;
  function codeOn(pkg: CheckoutPackage): boolean {
    return evaluatePromo(promo, pkg).ok;
  }
  const trialOnIndividual = codeOn("individual");
  const trialOnUnlimited = codeOn("unlimited");
  const trialOnAdvisorLite = codeOn("advisor_lite");
  const trialOnAdvisor = codeOn("advisor");

  const onFree = signedIn && !ent.paid;
  const onIndividual = signedIn && ent.paid && ent.plan === "individual";
  const onUnlimited = signedIn && ent.paid && ent.plan === "unlimited";
  const onAdvisorLite = signedIn && ent.plan === "advisor_lite";
  const onAdvisor = signedIn && ent.plan === "advisor";

  async function checkout(pkg: "individual" | "unlimited" | "advisor" | "advisor_lite") {
    if (codeInvalid) {
      setError("That code isn’t valid.");
      return;
    }
    setError(null);
    setBusy(`${pkg}-${interval}`);
    try {
      const { url } = await startCheckout({
        data: {
          interval,
          package: pkg,
          origin: window.location.origin,
          trialCode: trialCode.trim() || undefined,
        },
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setBusy(null);
    }
  }

  async function portal() {
    setError(null);
    setBusy("portal");
    try {
      const { url } = await startBillingPortal({
        data: { origin: window.location.origin },
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing.");
      setBusy(null);
    }
  }

  const indPrice = interval === "year" ? MACH_YEARLY_USD : MACH_MONTHLY_USD;
  const unlPrice = interval === "year" ? UNLIMITED_YEARLY_USD : UNLIMITED_MONTHLY_USD;
  const advPrice = interval === "year" ? ADVISOR_YEARLY_USD : ADVISOR_MONTHLY_USD;
  const advUnlPrice = interval === "year" ? ADVISOR_UNLIMITED_YEARLY_USD : ADVISOR_UNLIMITED_MONTHLY_USD;
  const per = interval === "year" ? "/year" : "/month";
  const codeHint = checkingCode
    ? "Checking that code…"
    : promoState.ok && promo
      ? `Valid code — ${describePromo(promo)}.`
      : codeInvalid
        ? promoState.ok
          ? "That code isn't valid."
          : promoState.message
        : "Type coupon code above.";
  const individualSignIn = trialOnIndividual
    ? promoDays
      ? `Sign in, then start ${promoDays}-day trial`
      : `Sign in, then choose Individual${promoPct ? ` · ${promoPct}% off` : ""}`
    : "Sign in, then choose Individual";
  const individualButton =
    busy === `individual-${interval}`
      ? "Redirecting…"
      : trialOnIndividual && promoDays
        ? `Start ${promoDays}-day trial · $${indPrice}${per}`
        : trialOnIndividual && promoPct
          ? `Choose Individual · ${promoPct}% off`
          : `Choose Individual · $${indPrice}${per}`;
  const unlimitedSignIn = trialOnUnlimited
    ? promoDays
      ? `Sign in, then start ${promoDays}-day trial`
      : `Sign in, then choose Individual Unlimited${promoPct ? ` · ${promoPct}% off` : ""}`
    : "Sign in, then choose Individual Unlimited";
  const unlimitedButton =
    busy === `unlimited-${interval}`
      ? "Redirecting…"
      : trialOnUnlimited && promoDays
        ? `Start ${promoDays}-day trial · $${unlPrice}${per}`
        : trialOnUnlimited && promoPct
          ? `Choose Unlimited · ${promoPct}% off`
          : `Choose Unlimited · $${unlPrice}${per}`;
  const advisorTrialLabel = `${trialOnAdvisorLite && promoDays ? promoDays : ADVISOR_TRIAL_DAYS}-day trial`;
  const advisorSubtitle = trialOnAdvisorLite && promoDays
    ? interval === "year"
      ? `${promoDays}-day trial, 2 months free`
      : `${promoDays}-day trial, then $${ADVISOR_MONTHLY_USD}/month`
    : trialOnAdvisorLite && promoPct
      ? `${promoPct}% off first invoice`
    : interval === "year"
      ? `${ADVISOR_TRIAL_DAYS}-day trial, 2 months free`
      : `${ADVISOR_TRIAL_DAYS}-day trial, then $${ADVISOR_MONTHLY_USD}/month`;
  const advisorSignIn = trialOnAdvisorLite && promoDays
    ? `Sign in, then start ${promoDays}-day trial`
    : "Sign in, then start Advisor Lite trial";
  const advisorLiteButton =
    busy === `advisor_lite-${interval}`
      ? "Redirecting…"
      : `Start ${trialOnAdvisorLite && promoDays ? promoDays : ADVISOR_TRIAL_DAYS}-day trial`;
  const advisorUnlSignIn = trialOnAdvisor && promoDays
    ? `Sign in, then start ${promoDays}-day trial`
    : "Sign in, then choose Advisor Unlimited";
  const advisorUnlButton =
    busy === `advisor-${interval}`
      ? "Redirecting…"
      : trialOnAdvisor && promoDays
        ? `Start ${promoDays}-day trial · $${advUnlPrice}${per}`
        : trialOnAdvisor && promoPct
          ? `Choose Unlimited · ${promoPct}% off`
          : `Choose Unlimited · $${advUnlPrice}${per}`;

  const currentText = !ent.signedIn
    ? null
    : !ent.paid
      ? "Your current package: Free."
      : `Your current package: ${packageLabel(ent.plan)}${
          ent.status === "trialing" ? " (trial)" : ""
        }${
          ent.billed === "individual" && ent.plan === "advisor"
            ? ` — billed as Individual ($${
                ent.interval === "year" ? MACH_YEARLY_USD : MACH_MONTHLY_USD
              }${ent.interval === "year" ? "/year" : "/month"}).`
            : ` — $${
                ent.plan === "advisor"
                  ? ent.interval === "year"
                    ? ADVISOR_UNLIMITED_YEARLY_USD
                    : ADVISOR_UNLIMITED_MONTHLY_USD
                  : ent.plan === "advisor_lite"
                    ? ent.interval === "year"
                      ? ADVISOR_YEARLY_USD
                      : ADVISOR_MONTHLY_USD
                  : ent.plan === "unlimited"
                    ? ent.interval === "year"
                      ? UNLIMITED_YEARLY_USD
                      : UNLIMITED_MONTHLY_USD
                    : ent.interval === "year"
                      ? MACH_YEARLY_USD
                      : MACH_MONTHLY_USD
              }${ent.interval === "year" ? "/year" : "/month"}.`
        }${
          ent.interval === "year"
            ? " (Annual billing selected)"
            : ent.interval === "month"
              ? " (Monthly billing selected)"
              : ""
        }`;

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-start justify-between gap-4">
          <Link to="/" className="inline-block opacity-90 hover:opacity-100">
            <BrandLockup framed />
          </Link>
          <div className="mt-1 flex shrink-0 items-center gap-1">
            <SiteMenu align="right" />
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
            >
              Home
            </Link>
          </div>
        </div>

        <header className="mt-10 max-w-[50.5rem]">
          <h1 className="font-display text-4xl leading-tight text-fg sm:text-5xl">
            {copy.heroH1.split("\n").map((line, i) => (
              <span key={`${line}-${i}`}>
                {i > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-5 font-display text-2xl leading-snug text-fg sm:text-3xl">
            {copy.heroSub}
          </p>
          {audience === "advisor" ? (
            <>
              <p className="mt-6 text-base leading-relaxed text-muted">
                {copy.advisorP1}
              </p>
              <p className="mt-3 text-base leading-relaxed text-muted">
                {copy.advisorP2}
              </p>
            </>
          ) : (
            <>
              <p className="mt-6 text-base leading-relaxed text-muted">
                {copy.personalP1}
              </p>
              <p className="mt-3 text-base leading-relaxed text-muted">
                {copy.personalP2}
              </p>
              <p className="mt-3 text-base leading-relaxed text-muted">
                {copy.personalP3}
              </p>
            </>
          )}
          <p className="mt-6 rounded-lg bg-surface px-4 py-3 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)]">
            {ent.signedIn && currentText ? (
              currentText
            ) : (
              <>
                Not signed in — pick a package after you register.{" "}
                <Link
                  to="/login"
                  className="underline underline-offset-4 hover:text-accent"
                >
                  Sign in here.
                </Link>
              </>
            )}
          </p>
        </header>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--color-border)]">
            <button
              type="button"
              aria-pressed={audience === "individual"}
              onClick={() => setAudience("individual")}
              className={cn(
                "h-11 rounded-md px-5 text-sm font-medium",
                audience === "individual" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              Personal
            </button>
            <button
              type="button"
              aria-pressed={audience === "advisor"}
              onClick={() => setAudience("advisor")}
              className={cn(
                "h-11 rounded-md px-5 text-sm font-medium",
                audience === "advisor" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              Professional
            </button>
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-md">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted">
              {copy.couponLabel}
            </span>
            <TextInput
              value={trialCode}
              onChange={(e) => {
                setTrialCode(e.target.value);
                setError(null);
              }}
              placeholder=""
              autoComplete="off"
              spellCheck={false}
              aria-invalid={codeInvalid}
            />
          </label>
          <p
            className={cn(
              "mt-2 text-sm",
              hasTrial ? "text-fg" : codeInvalid ? "text-negative" : "text-subtle",
            )}
          >
            {codeHint}
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <div className="inline-flex rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--color-border)]">
            <button
              type="button"
              aria-pressed={interval === "month"}
              onClick={() => setInterval("month")}
              className={cn(
                "h-10 rounded-md px-4 text-sm font-medium",
                interval === "month" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              aria-pressed={interval === "year"}
              onClick={() => setInterval("year")}
              className={cn(
                "h-10 rounded-md px-4 text-sm font-medium",
                interval === "year" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              Yearly
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-subtle">
          {interval === "year"
            ? copy.intervalNoteYear
            : audience === "advisor"
              ? copy.intervalNoteAdvisorMonth
              : copy.intervalNoteMonth}
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article
            className={cn(
              "flex flex-col rounded-xl bg-surface p-6 shadow-[0_0_0_1px_var(--color-border)]",
              onFree && "shadow-[0_0_0_2px_var(--color-accent)]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                Free
              </p>
              {onFree ? (
                <span className="rounded-sm bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-fg">
                  Your plan
                </span>
              ) : null}
            </div>
            <p className="mt-3 font-display text-4xl tabular-nums">$0</p>
            <p className="mt-1 text-sm text-muted">{copy.free.tag}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
              {copy.free.bullets.map((line, i) => (
                <li key={`free-${i}`}>
                  {audience === "advisor" && i === copy.free.bullets.length - 1
                    ? copy.freeAdvisorBullet
                    : line}
                </li>
              ))}
            </ul>
            {!signedIn ? (
              <a
                href="/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-surface px-4 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
              >
                Create a Free account
              </a>
            ) : onFree ? (
              <p className="mt-6 text-sm text-muted">This is your current package.</p>
            ) : (
              <p className="mt-6 text-sm text-muted">
                Limits disappear for a cup of coffee a month
              </p>
            )}
          </article>

          {audience === "individual" ? (
            <>
          <article
            className={cn(
              "flex flex-col rounded-xl bg-elevated p-6 shadow-[0_0_0_1px_var(--color-border)]",
              onIndividual && "shadow-[0_0_0_2px_var(--color-accent)]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                Individual
              </p>
              {onIndividual ? (
                <YourPlanMark interval={ent.interval} />
              ) : interval === "year" ? (
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
                  Two months free
                </span>
              ) : null}
            </div>
            <p className="mt-3 font-display text-4xl tabular-nums">
              ${indPrice}
              <span className="text-xl text-muted">{per}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {copy.individual.tag}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
              {copy.individual.bullets.map((line, i) => (
                <li key={`ind-${i}`}>{line}</li>
              ))}
            </ul>
            {!signedIn ? (
              <a
                href="/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
              >
                {individualSignIn}
              </a>
            ) : onIndividual ? (
              <PrimaryButton className="mt-6" disabled={busy !== null} onClick={() => void portal()}>
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                className="mt-6"
                disabled={busy !== null}
                onClick={() => void checkout("individual")}
              >
                {individualButton}
              </PrimaryButton>
            )}
          </article>

          <article
            className={cn(
              "flex flex-col rounded-xl bg-elevated p-6 shadow-[0_0_0_1px_var(--color-border)]",
              onUnlimited && "shadow-[0_0_0_2px_var(--color-accent)]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                Individual Unlimited
              </p>
              {onUnlimited ? (
                <YourPlanMark interval={ent.interval} />
              ) : interval === "year" ? (
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
                  Two months free
                </span>
              ) : null}
            </div>
            <p className="mt-3 font-display text-4xl tabular-nums">
              ${unlPrice}
              <span className="text-xl text-muted">{per}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {copy.unlimited.tag}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
              {copy.unlimited.bullets.map((line, i) => (
                <li key={`unl-${i}`}>{line}</li>
              ))}
            </ul>
            {!signedIn ? (
              <a
                href="/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
              >
                {unlimitedSignIn}
              </a>
            ) : onUnlimited ? (
              <PrimaryButton className="mt-6" disabled={busy !== null} onClick={() => void portal()}>
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                className="mt-6"
                disabled={busy !== null}
                onClick={() => void checkout("unlimited")}
              >
                {unlimitedButton}
              </PrimaryButton>
            )}
          </article>
            </>
          ) : (
            <>
          <article
            className={cn(
              "flex flex-col rounded-xl bg-elevated p-6 shadow-[0_0_0_1px_var(--color-border)]",
              onAdvisorLite && "shadow-[0_0_0_2px_var(--color-accent)]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                Advisor Lite
              </p>
              {onAdvisorLite ? (
                <YourPlanMark interval={ent.interval} />
              ) : (
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
                  {advisorTrialLabel}
                </span>
              )}
            </div>
            <p className="mt-3 font-display text-4xl tabular-nums">
              ${advPrice}
              <span className="text-xl text-muted">{per}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {trialOnAdvisorLite && (promoDays || promoPct)
                ? advisorSubtitle
                : interval === "year"
                  ? copy.advisorLiteTagYear
                  : copy.advisorLite.tag}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
              {copy.advisorLite.bullets.map((line, i) => (
                <li key={`advl-${i}`}>{line}</li>
              ))}
            </ul>
            {!signedIn ? (
              <a
                href="/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
              >
                {advisorSignIn}
              </a>
            ) : onAdvisorLite ? (
              <PrimaryButton className="mt-6" disabled={busy !== null} onClick={() => void portal()}>
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                className="mt-6"
                disabled={busy !== null}
                onClick={() => void checkout("advisor_lite")}
              >
                {advisorLiteButton}
              </PrimaryButton>
            )}
          </article>

          <article
            className={cn(
              "flex flex-col rounded-xl bg-elevated p-6 shadow-[0_0_0_1px_var(--color-border)]",
              onAdvisor && "shadow-[0_0_0_2px_var(--color-accent)]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                Advisor Unlimited
              </p>
              {onAdvisor ? (
                <YourPlanMark interval={ent.interval} />
              ) : interval === "year" ? (
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
                  Two months free
                </span>
              ) : null}
            </div>
            <p className="mt-3 font-display text-4xl tabular-nums">
              ${advUnlPrice}
              <span className="text-xl text-muted">{per}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {interval === "year"
                ? copy.advisorUnlimitedTagYear
                : copy.advisorUnlimited.tag}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
              {copy.advisorUnlimited.bullets.map((line, i) => (
                <li key={`advu-${i}`}>{line}</li>
              ))}
            </ul>
            {!signedIn ? (
              <a
                href="/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
              >
                {advisorUnlSignIn}
              </a>
            ) : onAdvisor ? (
              <PrimaryButton className="mt-6" disabled={busy !== null} onClick={() => void portal()}>
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                className="mt-6"
                disabled={busy !== null}
                onClick={() => void checkout("advisor")}
              >
                {advisorUnlButton}
              </PrimaryButton>
            )}
          </article>
            </>
          )}
        </div>

        {error ? <p className="mt-6 text-sm text-negative">{error}</p> : null}
        {!ent.stripeConfigured ? (
          <p className="mt-6 text-sm text-subtle">
            Individual checkout turns on when MACH RUN is published with Stripe.
          </p>
        ) : null}
        {ent.stripeConfigured && !ent.unlimitedStripeConfigured ? (
          <p className="mt-3 text-sm text-subtle">
            Individual Unlimited checkout needs STRIPE_PRICE_UNLIMITED_MONTHLY and
            STRIPE_PRICE_UNLIMITED_YEARLY in Vercel, then a redeploy.
          </p>
        ) : null}
        {ent.stripeConfigured && !ent.advisorStripeConfigured ? (
          <p className="mt-3 text-sm text-subtle">
            Advisor Lite checkout needs STRIPE_PRICE_ADVISOR_MONTHLY and
            STRIPE_PRICE_ADVISOR_YEARLY in Vercel, then a redeploy.
          </p>
        ) : null}
        {ent.stripeConfigured && !ent.advisorUnlimitedStripeConfigured ? (
          <p className="mt-3 text-sm text-subtle">
            Advisor Unlimited checkout needs STRIPE_PRICE_ADVISOR_UNLIMITED_MONTHLY and
            STRIPE_PRICE_ADVISOR_UNLIMITED_YEARLY in Vercel, then a redeploy.
          </p>
        ) : null}

        <p className="mt-10 flex justify-center">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
          >
            Back to MACH Run
          </Link>
        </p>
      </div>
      <MachFooter />
    </main>
  );
}
