import { createFileRoute, Link } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";
import { DEFAULT_PAGES } from "@/lib/site-copy/defaults";
import { pageHead } from "@/lib/seo";

const LEARN_LINKS = ["/method", "/faq", "/announcements"] as const;
const LEARN_TITLES = ["The Method", "FAQ", "Updates"] as const;

function learnLines(body: string): string[] {
  const fallback =
    DEFAULT_PAGES.find((page) => page.slug === "learn")?.body.split(/\n{2,}/) ?? [];
  const lines = body.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return LEARN_TITLES.map((_, i) => lines[i]?.trim() || fallback[i]?.trim() || "");
}

export const Route = createFileRoute("/learn")({
  head: () =>
    pageHead({
      title: "Learn | MACH RUN Retirement Calculator",
      description:
        "Learn is where the Method, the FAQ, Compare, Updates, and the military retirement pay calculator sit.",
      path: "/learn",
    }),
  loader: () => loadPublicSiteCopy(),
  component: Learn,
});

function Learn() {
  const page = pageBySlug(Route.useLoaderData(), "learn");
  const lines = learnLines(page.body);
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <PieceCrumbs path="/learn" />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{page.title || "Learn"}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        <ul className="space-y-5">
          {LEARN_LINKS.map((to, i) => (
            <li key={to}>
              <Link
                to={to}
                className="font-display text-2xl text-fg underline underline-offset-4 hover:text-accent"
              >
                {LEARN_TITLES[i]}
              </Link>
              {lines[i] ? <p className="mt-1 text-muted">{lines[i]}</p> : null}
            </li>
          ))}
          <li>
            <Link
              to="/compare"
              className="font-display text-2xl text-fg underline underline-offset-4 hover:text-accent"
            >
              Compare
            </Link>
            <p className="mt-1 text-muted">
              MACH RUN next to FIRECalc, a spreadsheet, and Quicken.
            </p>
          </li>
          <li>
            <Link
              to="/retired-pay"
              className="font-display text-2xl text-fg underline underline-offset-4 hover:text-accent"
            >
              Military Retirement Pay Calculator
            </Link>
            <p className="mt-1 text-muted">
              High-3, BRS, REDUX, and Final Pay. The pre-tax retired paycheck DFAS would start, from the official basic-pay tables.
            </p>
          </li>
        </ul>
        <RelatedPieces path="/learn" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}