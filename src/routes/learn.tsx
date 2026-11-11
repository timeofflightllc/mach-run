import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { firstSentence } from "@/lib/articles/body";
import type { ArticleRecord } from "@/lib/articles/types";
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
  head: ({ matches }) => {
    const path = matches.at(-1)?.pathname.replace(/\/$/, "") || "/";
    if (path !== "/learn") return { meta: [], links: [] };
    return pageHead({
      title: "Learn | MACH RUN Retirement Calculator",
      description:
        "How a MACH RUN turns pay, TSP, military retired pay, VA, and a nest-egg goal into one projection.",
      path: "/learn",
    });
  },
  loader: async () => {
    const { listArticles } = await import("@/lib/articles/server");
    const [copy, articles] = await Promise.all([loadPublicSiteCopy(), listArticles()]);
    return { copy, articles };
  },
  component: Learn,
});

function Learn() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname.replace(/\/$/, "") || "/",
  });
  if (pathname !== "/learn") return <Outlet />;
  const { copy, articles } = Route.useLoaderData();
  const page = pageBySlug(copy, "learn");
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
              Free Military Retirement Pay Calculator
            </Link>
            <p className="mt-1 text-muted">
              High-3, BRS, REDUX, and Final Pay. The pre-tax retired paycheck DFAS would start, from the official basic-pay tables.
            </p>
          </li>
          <li>
            <Link
              to="/tools"
              className="font-display text-2xl text-fg underline underline-offset-4 hover:text-accent"
            >
              Tools
            </Link>
            <p className="mt-1 text-muted">
              The free calculators. The military retirement pay calculator is live.
            </p>
          </li>
          {articles.map((article) => (
            <ArticleLink key={article.slug} article={article} />
          ))}
        </ul>
        <RelatedPieces path="/learn" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}

function ArticleLink({ article }: { article: ArticleRecord }) {
  const line = firstSentence(article.body);
  return (
    <li>
      <Link
        to="/learn/$slug"
        params={{ slug: article.slug }}
        className="font-display text-2xl text-fg underline underline-offset-4 hover:text-accent"
      >
        {article.h1}
      </Link>
      {line ? <p className="mt-1 text-muted">{line}</p> : null}
    </li>
  );
}
