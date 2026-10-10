import { createFileRoute } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";

import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      title: "Privacy policy for the calculator | MACH RUN",
      description:
        "How MACH RUN handles the household numbers you type. Encrypted in transit and at rest. We do not sell them.",
      path: "/privacy",
    }),
  loader: () => loadPublicSiteCopy(),
  component: Privacy,
});

function Privacy() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "privacy");
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <PieceCrumbs path="/privacy" />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{page.title}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        <SiteCopyBody body={page.body} />
        <RelatedPieces path="/privacy" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}
