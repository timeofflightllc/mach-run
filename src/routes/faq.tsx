import { createFileRoute } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { FaqList, faqPageSchema } from "@/components/meridian/faq-list";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";
import { DEFAULT_PAGES } from "@/lib/site-copy/defaults";
import { contentPageSchema } from "@/lib/content-page-schema";
import { pageHead } from "@/lib/seo";

const FAQ_TITLE = "FAQ | MACH RUN Retirement Calculator";

export const Route = createFileRoute("/faq")({
  head: ({ loaderData }) => {
    const copy = loaderData ?? { pages: DEFAULT_PAGES, announcements: [] };
    const page = pageBySlug(copy, "faq");
    const article = contentPageSchema(FAQ_TITLE, "/faq");
    const faq = faqPageSchema(page.body);
    return pageHead({
      title: FAQ_TITLE,
      description:
        "Answers on Social Security, VA, military retired pay, accounts, and what Calculate does with the numbers you type.",
      path: "/faq",
      jsonLd: [article, faq].filter((block): block is Record<string, unknown> => block != null),
    });
  },
  loader: () => loadPublicSiteCopy(),
  component: Faq,
});

function Faq() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "faq");
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <PieceCrumbs path="/faq" />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{page.title}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        <FaqList body={page.body} />
        <RelatedPieces path="/faq" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}
