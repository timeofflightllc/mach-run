import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLockup } from "@/components/meridian/mach-mark";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <Link to="/" className="inline-block opacity-90 hover:opacity-100">
          <BrandLockup framed />
        </Link>
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            machrun.com
          </p>
          <h1 className="mt-2 font-display text-4xl text-fg">Privacy policy</h1>
          <p className="mt-2 text-sm text-muted">Last updated: September 3, 2026</p>
        </header>

        <div className="space-y-6 text-sm leading-relaxed text-muted">
          <p>
            MACH Run is a household calculator. You type in names, dates,
            balances, income, and spending so the engine can project a MACH
            Run. That is personal financial information. We treat it that way.
          </p>

          <section className="space-y-2">
            <h2 className="font-medium text-fg">What we collect</h2>
            <p>
              If you create an account: name, email address, password (stored
              hashed — we cannot read the password), and optional profile
              image if you sign in with Google, X, or Apple.
            </p>
            <p>
              If you use MACH Run: the plan you type — family names and birth
              dates, account balances, income stages, contributions, spending,
              retirement dates, and the MACH OODA analysis generated from
              those numbers. If you subscribe: Stripe customer and
              subscription identifiers, not your full card number. Stripe
              processes the card.
            </p>
            <p>
              If you ask OODA AI a question: that question and a compact
              snapshot of this MACH Run are sent to xAI so the model can
              answer. We do not use those questions to train a public
              marketing list.
            </p>
            <p>
              Standard technical logs (IP address, browser, pages loaded) to
              keep the site running and to debug failures.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-fg">How we use it</h2>
            <p>
              To run the calculator, save your MACH Run across devices, sign
              you in, take payment for Unlimited, answer OODA AI questions you
              ask, and keep the service secure. We do not use your household
              numbers to advertise other people’s products to you.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-fg">What we will not do</h2>
            <p>
              We will not spam you. We will not sell, rent, trade, or
              otherwise knowingly give your personal information, financial
              inputs, passwords, or email address to marketers, data brokers,
              or anyone else for their own use.
            </p>
            <p>
              We may share information only when: you ask us to (for example
              Stripe checkout); a processor must have it to run MACH Run
              (hosting, database, authentication, payments, OODA AI); or the
              law requires it. Processors are not allowed to use your data for
              their own marketing.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-fg">Who sees the numbers</h2>
            <p>
              Your MACH Run is tied to your login. Other MACH RUN users cannot see
              it. Saved plans are encrypted at rest in our database. That protects
              a stolen disk or backup file. It does not mean MACHRUN.COM operators
              are blind — we hold the server key, so we can open a plan if we must
              operate, secure, or repair the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-fg">Cookies and sign-in</h2>
            <p>
              We use a session cookie (or a short-lived token in the live
              preview) so you stay signed in. We do not run advertising
              pixels or sell browsing history.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-fg">Keeping it</h2>
            <p>
              We keep your account and saved MACH Run while the account is
              open. You can ask us to delete the account and stored plan. Backups
              may lag for a short period. Billing records may be kept as
              required by tax and payment rules.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-fg">Security</h2>
            <p>
              Passwords are hashed. Traffic is encrypted in transit (HTTPS).
              Saved MACH Runs are encrypted at rest. Optional .machrun backup
              files use a password only you know — we do not keep that password.
              No method is perfect. Do not reuse a bank password here. MACH
              Run is a planning tool, not a bank, broker, or custodian.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-fg">Children</h2>
            <p>
              MACH Run is for adults. You may enter a child’s name and birth
              date as a dependent for VA or similar benefits. We do not
              knowingly create accounts for children under 13.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-fg">Your choices</h2>
            <p>
              You can edit or clear inputs in the calculator, update email and
              password on Account profile, manage billing with Stripe, and
              sign out. For deletion of an account and stored plan, contact us
              from the email on that account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-fg">Not advice</h2>
            <p>
              MACH Run, the MACH OODA Financial Analysis, and OODA AI are for
              entertainment and illustration. They are not financial, tax,
              legal, or investment advice.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-fg">Changes</h2>
            <p>
              If this policy changes in a material way, we will update this
              page and the date above.
            </p>
          </section>
        </div>

        <p className="text-sm text-subtle">
          <Link to="/" className="underline-offset-4 hover:text-fg hover:underline">
            Back to the engine
          </Link>
          {" · "}
          <Link to="/pricing" className="underline-offset-4 hover:text-fg hover:underline">
            Pricing
          </Link>
        </p>
      </div>
    </main>
  );
}
