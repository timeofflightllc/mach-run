import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLockup, MachFooter } from "@/components/meridian/mach-mark";
import { SiteNav } from "@/components/meridian/site-nav";

export const Route = createFileRoute("/about")({ component: About });

function About() {
  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <Link to="/" className="inline-block opacity-90 hover:opacity-100">
          <BrandLockup framed />
        </Link>
        <SiteNav />
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            machrun.com
          </p>
          <h1 className="mt-2 font-display text-4xl text-fg">About</h1>
        </header>
        <div className="space-y-5 text-sm leading-relaxed text-muted">
          <p>
            MACH RUN is The Supersonic Retirement Calculator. You type the
            household as it stands — family, accounts, paychecks, spending,
            contributions — then hit Calculate. The engine runs an OODA Loop:
            Observe, Orient, Decide, Act.
          </p>
          <p>
            It was built by a retired U.S. Air Force fighter pilot who wanted
            one place to see income sources, investment contributions (all
            types), and a nest-egg goal on the same strip. The name is Measure,
            Allocate, Compound, Harvest — MACH. The method is Boyd’s OODA loop,
            used here as a way to look at money — but was first used in teaching
            younger fighter pilots how to excel at dogfighting.
          </p>
          <p>
            Free gets you in the cockpit with limits. Paid plans unlock the
            full ledger, Net Worth, encrypted backups, and OODA AI. None of it
            is financial, tax, legal, or investment advice. It is a planning
            sketch from the numbers you type.
          </p>
          <p>
            Questions, a bug, or a feature you want on the jet —{" "}
            <Link to="/contact" className="text-fg underline-offset-4 hover:underline">
              Contact
            </Link>
            . What shipped recently lives on{" "}
            <Link
              to="/announcements"
              className="text-fg underline-offset-4 hover:underline"
            >
              Features
            </Link>
            .
          </p>
        </div>
      </div>
      <MachFooter />
    </main>
  );
}
