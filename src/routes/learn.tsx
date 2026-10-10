import { createFileRoute, Link } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/learn")({
  head: () =>
    pageHead({
      title: "Learn | MACH RUN Retirement Calculator",
      description:
        "The Method, the FAQ, and Updates. How a MACH RUN uses the household numbers you type.",
      path: "/learn",
    }),
  component: Learn,
});

const CLUSTER = [
  {
    to: "/method" as const,
    title: "The Method",
    text: "How a MACH RUN turns family, accounts, paychecks, spending, and contributions into a monthly retirement projection.",
  },
  {
    to: "/faq" as const,
    title: "FAQ",
    text: "Answers on Social Security, VA, military retired pay, accounts, and what Calculate does with the numbers you type.",
  },
  {
    to: "/announcements" as const,
    title: "Updates",
    text: "What shipped recently on the MACH RUN retirement calculator.",
  },
];

function Learn() {
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <PieceCrumbs path="/learn" />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">Learn</h1>
          <p className="mt-2 text-lg text-muted">
            The pages that explain a MACH RUN. Fill Observe, Orient, and Decide. Hit Calculate.
          </p>
        </header>
        <ul className="space-y-5">
          {CLUSTER.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="font-display text-2xl text-fg underline underline-offset-4 hover:text-accent"
              >
                {item.title}
              </Link>
              <p className="mt-1 text-muted">{item.text}</p>
            </li>
          ))}
        </ul>
        <RelatedPieces path="/learn" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}
