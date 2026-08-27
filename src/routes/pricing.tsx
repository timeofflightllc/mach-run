import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BrandLockup } from "@/components/meridian/mach-mark";
import { PrimaryButton } from "@/components/ui/field";
import { startBillingPortal, startCheckout } from "@/lib/billing/api";
import { MACH_MONTHLY_USD, MACH_YEARLY_USD } from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({ component: Pricing });

function currentLabel(ent: {
  signedIn: boolean;
  paid: boolean;
  interval: "month" | "year" | null;
}): string {
  if (!ent.signedIn) return "Not signed in — pick a package after you register.";
  if (!ent.paid) return "Your current package: Free.";
  if (ent.interval === "year") return `Your current package: Unlimited — $${MACH_YEARLY_USD}/year.`;
  return `Your current package: Unlimited — $${MACH_MONTHLY_USD}/month.`;
}

function Pricing() {
  const ent = useEntitlement();
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"month" | "year" | "portal" | null>(null);

  const onFree = signedIn && !ent.paid;
  const onMonth = signedIn && ent.paid && ent.interval !== "year";
  const onYear = signedIn && ent.paid && ent.interval === "year";

  async function checkout(interval: "month" | "year") {
    setError(null);
    setBusy(interval);
    try {
      const { url } = await startCheckout({
        data: { interval, origin: window.location.origin },
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

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg">
      <div className="mx-auto w-full max-w-5xl">
        <Link to="/" className="inline-block opacity-90 hover:opacity-100">
          <BrandLockup />
        </Link>

        <header className="mt-10 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            The Supersonic Financial Calculator
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-fg sm:text-5xl">
            Less than a cup of coffee.
            <br />
            A lot more than a spreadsheet.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Make a free account so your household is waiting the next time you
            open MACH. Two accounts, two contribution rules, two income stages —
            and a MACH OODA that fades after two paragraphs. Enough to see if
            the engine is telling the truth. When you have a 401(k), a Roth, a
            brokerage, and money moving on a schedule, unlock the rest of the
            OODA for ${MACH_MONTHLY_USD}/month. That is less than a cup of
            coffee. Or ${MACH_YEARLY_USD}/year if you would rather pay once and
            forget it.
          </p>
          <p className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)]">
            {currentLabel(ent)}
          </p>
        </header>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
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
            <p className="mt-1 text-sm text-muted">Register. Save. Run it.</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
              <li>Google, X, or email sign-in</li>
              <li>Your MACH Run saved across devices</li>
              <li>2 investment accounts</li>
              <li>2 contribution rules</li>
              <li>2 income stages</li>
              <li>Full OODA, cut off after two paragraphs</li>
            </ul>
            {!signedIn ? (
              <a
                href="/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-surface px-4 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
              >
                Create a free account
              </a>
            ) : onFree ? (
              <p className="mt-6 text-sm text-muted">This is your current package.</p>
            ) : (
              <p className="mt-6 text-sm text-muted">Included with Unlimited.</p>
            )}
          </article>

          <article
            className={cn(
              "flex flex-col rounded-xl bg-elevated p-6 shadow-[0_0_0_1px_var(--color-border)]",
              onMonth && "shadow-[0_0_0_2px_var(--color-accent)]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                Unlimited
              </p>
              {onMonth ? (
                <span className="rounded-sm bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-fg">
                  Your plan
                </span>
              ) : null}
            </div>
            <p className="mt-3 font-display text-4xl tabular-nums">
              ${MACH_MONTHLY_USD}
              <span className="text-xl text-muted">/month</span>
            </p>
            <p className="mt-1 text-sm text-muted">Less than a cup of coffee.</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
              <li>Unlimited accounts</li>
              <li>Unlimited contribution rules</li>
              <li>Unlimited income stages</li>
              <li>Full MACH OODA Financial Analysis</li>
              <li>Everything in Free</li>
            </ul>
            {!signedIn ? (
              <a
                href="/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
              >
                Sign in, then go monthly
              </a>
            ) : onMonth ? (
              <PrimaryButton
                className="mt-6"
                disabled={busy !== null}
                onClick={() => void portal()}
              >
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                className="mt-6"
                disabled={busy !== null}
                onClick={() => void checkout("month")}
              >
                {busy === "month" ? "Redirecting…" : `Choose $${MACH_MONTHLY_USD}/month`}
              </PrimaryButton>
            )}
          </article>

          <article
            className={cn(
              "flex flex-col rounded-xl bg-elevated p-6 shadow-[0_0_0_1px_var(--color-border)]",
              onYear && "shadow-[0_0_0_2px_var(--color-accent)]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                Unlimited
              </p>
              {onYear ? (
                <span className="rounded-sm bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-fg">
                  Your plan
                </span>
              ) : (
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
                  Two months free
                </span>
              )}
            </div>
            <p className="mt-3 font-display text-4xl tabular-nums">
              ${MACH_YEARLY_USD}
              <span className="text-xl text-muted">/year</span>
            </p>
            <p className="mt-1 text-sm text-muted">Pay once. Forget it.</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
              <li>Unlimited accounts</li>
              <li>Unlimited contribution rules</li>
              <li>Unlimited income stages</li>
              <li>Full MACH OODA Financial Analysis</li>
              <li>Same Unlimited engine, billed yearly</li>
            </ul>
            {!signedIn ? (
              <a
                href="/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
              >
                Sign in, then go yearly
              </a>
            ) : onYear ? (
              <PrimaryButton
                className="mt-6"
                disabled={busy !== null}
                onClick={() => void portal()}
              >
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                className="mt-6"
                disabled={busy !== null}
                onClick={() => void checkout("year")}
              >
                {busy === "year" ? "Redirecting…" : `Choose $${MACH_YEARLY_USD}/year`}
              </PrimaryButton>
            )}
          </article>
        </div>

        {error ? <p className="mt-6 text-sm text-negative">{error}</p> : null}
        {!ent.stripeConfigured ? (
          <p className="mt-6 text-sm text-subtle">
            Card checkout turns on when MACH is published with Stripe. You can
            still register and save for free.
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
