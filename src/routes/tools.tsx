import { createFileRoute, Link } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { contentPageSchema } from "@/lib/content-page-schema";
import { pageHead } from "@/lib/seo";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";

const TITLE = "Free Military Pay Tools | MACH RUN";
const DESCRIPTION =
  "Free calculators from MACH RUN. The military retirement pay calculator is live. BAH, OHA, and other pay tools are still being built.";

export const Route = createFileRoute("/tools")({
  loader: () => loadPublicSiteCopy(),
  head: () => {
    const article = contentPageSchema(TITLE, "/tools");
    return pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: "/tools",
      jsonLd: [article, toolsListSchema()].filter(
        (block): block is Record<string, unknown> => block != null,
      ),
    });
  },
  component: Tools,
});

function toolsListSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Free MACH RUN calculators",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: 1,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Free Military Retirement Pay Calculator",
        url: "https://machrun.com/retired-pay",
      },
    ],
  };
}

function Tools() {
  const page = pageBySlug(Route.useLoaderData(), "tools");
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <PieceCrumbs path="/tools" />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{page.title || "Tools"}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        <SiteCopyBody body={page.body} underlineLinks />
        <p className="text-muted">
          A calculator result is not a decision. The rule is in the{" "}
          <Link
            to="/legal"
            hash="free-calculators"
            className="text-fg underline underline-offset-4 hover:text-accent"
          >
            Terms of Service
          </Link>
          .
        </p>
        <RelatedPieces path="/tools" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}