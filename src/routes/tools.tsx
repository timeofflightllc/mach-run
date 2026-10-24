import { createFileRoute, Link } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { contentPageSchema } from "@/lib/content-page-schema";
import { pageHead } from "@/lib/seo";

const TITLE = "Free Military Pay Tools | MACH RUN";
const DESCRIPTION =
  "Free calculators from MACH RUN. The military retirement pay calculator is live. BAH, OHA, and other pay tools are still being built.";

export const Route = createFileRoute("/tools")({
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
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <PieceCrumbs path="/tools" />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">Tools</h1>
          <p className="mt-2 text-lg text-muted">
            Free calculators. One is live. The rest are still being built.
          </p>
        </header>
        <ul className="space-y-5">
          <li>
            <Link
              to="/retired-pay"
              className="font-display text-2xl text-fg underline underline-offset-4 hover:text-accent"
            >
              Free Military Retirement Pay Calculator
            </Link>
            <p className="mt-1 text-muted">
              Live. High-3, BRS, REDUX, and Final Pay. The pre-tax retired paycheck DFAS would start, from the official basic-pay tables.
            </p>
          </li>
        </ul>
        <section className="space-y-3" aria-label="Still being built">
          <h2 className="font-display text-2xl text-fg">Still being built</h2>
          <p className="text-muted">These are not live. There is no page to open yet.</p>
          <ul className="list-disc space-y-2 pl-5 text-muted">
            <li>BAH calculator</li>
            <li>OHA calculator</li>
            <li>Other military pay calculators</li>
          </ul>
        </section>
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
