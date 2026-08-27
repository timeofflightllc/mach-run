import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BrandLockup } from "@/components/meridian/mach-mark";
import { PrimaryButton } from "@/components/ui/field";
import { startBillingPortal, startCheckout } from "@/lib/billing/api";
import { MACH_MONTHLY_USD, MACH_YEARLY_USD } from "@/lib/billing/limits";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/pricing")({ component: Pricing });

function Pricing() {
  const ent = useEntitlement();
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"month" | "year" | "portal" | null>(null);

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
      <div className="mx-auto w-full max-w-3xl">
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
        </header>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="flex flex-col rounded-xl bg-surface p-6 shadow-[0_0_0_1px_var(--color-border)]">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              Free
            </p>
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
            ) : (
              <p className="mt-6 text-sm text-muted">
                {ent.paid ? "Included with your MACH subscription." : "This is your current plan."}
              </p>
            )}
          </article>

          <article className="relative flex flex-col rounded-xl bg-elevated p-6 shadow-[0_0_0_1px_var(--color-border)]">
            <p className="absolute right-5 top-5 text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
              Less than a coffee
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              Unlimited
            </p>
            <p className="mt-3 font-display text-4xl tabular-nums">
              ${MACH_MONTHLY_USD}
              <span className="text-xl text-muted">/month</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              ${MACH_YEARLY_USD}/year — two months on the house
            </p>
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
                Sign in, then go unlimited
              </a>
            ) : ent.paid ? (
              <PrimaryButton
                className="mt-6"
                disabled={busy !== null}
                onClick={() => void portal()}
              >
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </PrimaryButton>
            ) : (
              <div className="mt-6 flex flex-col gap-2">
                <PrimaryButton
                  disabled={busy !== null}
                  onClick={() => void checkout("month")}
                >
                  {busy === "month"
                    ? "Redirecting…"
                    : `$${MACH_MONTHLY_USD}/month — less than a coffee`}
                </PrimaryButton>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void checkout("year")}
                  className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface hover:text-fg disabled:opacity-50"
                >
                  {busy === "year"
                    ? "Redirecting…"
                    : `Or $${MACH_YEARLY_USD}/year`}
                </button>
              </div>
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
