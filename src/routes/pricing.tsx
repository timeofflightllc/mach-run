import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BrandLockup } from "@/components/meridian/mach-mark";
import { PrimaryButton } from "@/components/ui/field";
import { startBillingPortal, startCheckout } from "@/lib/billing/api";
import {
  ADVISOR_MONTHLY_USD,
  ADVISOR_TRIAL_DAYS,
  ADVISOR_YEARLY_USD,
  MACH_MONTHLY_USD,
  MACH_YEARLY_USD,
  packageLabel,
} from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({ component: Pricing });

function Pricing() {
  const ent = useEntitlement();
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [interval, setInterval] = useState<"month" | "year">(
    ent.interval === "year" ? "year" : "month",
  );

  const onFree = signedIn && !ent.paid;
  const onIndividual = signedIn && ent.paid && ent.plan === "individual";
  const onAdvisor = signedIn && ent.plan === "advisor";

  async function checkout(pkg: "individual" | "advisor") {
    setError(null);
    setBusy(`${pkg}-${interval}`);
    try {
      const { url } = await startCheckout({
        data: { interval, package: pkg, origin: window.location.origin },
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
  const advPrice = interval === "year" ? ADVISOR_YEARLY_USD : ADVISOR_MONTHLY_USD;
  const per = interval === "year" ? "/year" : "/month";

  const currentText = !ent.signedIn
    ? null
    : !ent.paid
      ? "Your current package: Free."
      : `Your current package: ${packageLabel(ent.plan)}${
          ent.status === "trialing" ? " (trial)" : ""
        } — ${
          ent.interval === "year"
            ? `$${ent.plan === "advisor" ? ADVISOR_YEARLY_USD : MACH_YEARLY_USD}/year`
            : `$${ent.plan === "advisor" ? ADVISOR_MONTHLY_USD : MACH_MONTHLY_USD}/month`
        }.`;

  return (
    <main className="min-h-screen px-4 py-10 text-fg" style={{ backgroundColor: "#0a1835" }}>
      <div className="mx-auto w-full max-w-5xl">
        <Link to="/" className="inline-block opacity-90 hover:opacity-100">
          <BrandLockup />
        </Link>

        <header className="mt-10 max-w-2xl">
          <h1 className="font-display text-4xl leading-tight text-fg sm:text-5xl">
            Pick a package.
            <br />
            Monthly or yearly — your call.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Free is one household with limits. Individual is the full engine for
            you. Advisor is for CFPs: unlimited named MACH RUN profiles, a
            dropdown to switch clients, and a file you can export or import.
          </p>
          <p className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)]">
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
              aria-pressed={interval === "month"}
              onClick={() => setInterval("month")}
              className={cn(
                "h-11 rounded-md px-5 text-sm font-medium",
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
                "h-11 rounded-md px-5 text-sm font-medium",
                interval === "year" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              Yearly
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-subtle">
          {interval === "year"
            ? "Yearly: two months on us for Individual and Advisor."
            : `Advisor includes a ${ADVISOR_TRIAL_DAYS}-day free trial (card on file).`}
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
            <p className="mt-1 text-sm text-muted">One household. Limits apply.</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
              <li>Save one MACH RUN</li>
              <li>2 accounts · 2 contributions · 2 incomes</li>
              <li>OODA cut off after two paragraphs</li>
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
              <p className="mt-6 text-sm text-muted">Included in paid packages.</p>
            )}
          </article>

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
                <span className="rounded-sm bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-fg">
                  Your plan
                </span>
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
              {interval === "year" ? "Pay once. Forget it." : "Less than a cup of coffee."}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
              <li>One household, unlimited accounts</li>
              <li>Unlimited contributions and incomes</li>
              <li>Full MACH OODA Financial Analysis</li>
              <li>OODA AI on this MACH RUN</li>
            </ul>
            {!signedIn ? (
              <a
                href="/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
              >
                Sign in, then choose Individual
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
                {busy === `individual-${interval}`
                  ? "Redirecting…"
                  : `Choose Individual · $${indPrice}${per}`}
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
                Advisor
              </p>
              {onAdvisor ? (
                <span className="rounded-sm bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-fg">
                  Your plan
                </span>
              ) : (
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
                  {ADVISOR_TRIAL_DAYS}-day trial
                </span>
              )}
            </div>
            <p className="mt-3 font-display text-4xl tabular-nums">
              ${advPrice}
              <span className="text-xl text-muted">{per}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {interval === "year"
                ? "Two months on us."
                : `${ADVISOR_TRIAL_DAYS} days free, then ${ADVISOR_MONTHLY_USD}/month.`}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
              <li>Unlimited named profiles (client IDs)</li>
              <li>Dropdown to switch which MACH RUN you are in</li>
              <li>Export / import a MACH RUN file</li>
              <li>Everything in Individual</li>
            </ul>
            {!signedIn ? (
              <a
                href="/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
              >
                Sign in, then start Advisor trial
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
                {busy === `advisor-${interval}`
                  ? "Redirecting…"
                  : `Start ${ADVISOR_TRIAL_DAYS}-day trial`}
              </PrimaryButton>
            )}
          </article>
        </div>

        {error ? <p className="mt-6 text-sm text-negative">{error}</p> : null}
        {!ent.stripeConfigured ? (
          <p className="mt-6 text-sm text-subtle">
            Individual checkout turns on when MACH RUN is published with Stripe.
          </p>
        ) : null}
        {ent.stripeConfigured && !ent.advisorStripeConfigured ? (
          <p className="mt-3 text-sm text-subtle">
            Advisor checkout needs STRIPE_PRICE_ADVISOR_MONTHLY and
            STRIPE_PRICE_ADVISOR_YEARLY in Vercel, then a redeploy.
          </p>
        ) : null}

        <p className="mt-10 text-sm text-subtle">
          <Link to="/" className="underline-offset-4 hover:text-fg hover:underline">
            Back to the engine
          </Link>
        </p>
      </div>
    </main>
  );
}
