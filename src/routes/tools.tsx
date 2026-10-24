import { createFileRoute, Link } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { contentPageSchema } from "@/lib/content-page-schema";
import { pageHead } from "@/lib/seo";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";
import { DEFAULT_PAGES } from "@/lib/site-copy/defaults";

const TITLE = "Free Military Pay Tools | MACH RUN";
const DESCRIPTION =
  "Free calculators from MACH RUN. The military retirement pay calculator is live. BAH, OHA, and other pay tools are still being built.";

function toolsParts(body: string) {
  const fallback =
    DEFAULT_PAGES.find((page) => page.slug === "tools")?.body.split(/\n{2,}/) ?? [];
  const blocks = body.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  const pick = (index: number) => blocks[index]?.trim() || fallback[index]?.trim() || "";
  return {
    liveTitle: pick(0),
    liveBlurb: pick(1),
    soonTitle: pick(2),
    soonIntro: pick(3),
    soon: pick(4)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

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
  const parts = toolsParts(page.body);
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <PieceCrumbs path="/tools" />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{page.title || "Tools"}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        <ul className="space-y-5">
          <li>
            <Link
              to="/retired-pay"
              className="font-display text-2xl text-fg underline underline-offset-4 hover:text-accent"
            >
              {parts.liveTitle}
            </Link>
            {parts.liveBlurb ? <p className="mt-1 text-muted">{parts.liveBlurb}</p> : null}
          </li>
        </ul>
        {parts.soonTitle || parts.soonIntro || parts.soon.length ? (
          <section className="space-y-3" aria-label={parts.soonTitle || "Still being built"}>
            {parts.soonTitle ? <h2 className="font-display text-2xl text-fg">{parts.soonTitle}</h2> : null}
            {parts.soonIntro ? <p className="text-muted">{parts.soonIntro}</p> : null}
            {parts.soon.length ? (
              <ul className="list-disc space-y-2 pl-5 text-muted">
                {parts.soon.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
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