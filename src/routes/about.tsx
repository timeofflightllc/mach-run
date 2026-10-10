import { createFileRoute } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";

import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () =>
    pageHead({
      title: "About the retirement calculator | MACH RUN",
      description:
        "MACH RUN was built by a retired Air Force fighter pilot. One place for income, contributions, and a nest-egg goal.",
      path: "/about",
    }),
  loader: () => loadPublicSiteCopy(),
  component: About,
});

function About() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "about");
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <PieceCrumbs path="/about" />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{page.title}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)] lg:gap-10">
          <figure className="order-last flex flex-col gap-4 lg:order-none lg:sticky lg:top-6">
            <img
              src="/brand/about-wingman.jpg?v=1"
              alt="A pilot in flight gear kneeling with a small child on the flight line."
              width={2278}
              height={2592}
              className="w-full rounded-lg"
            />
            <img
              src="/brand/about-flightline.jpg?v=1"
              alt="A pilot standing in front of an F-15 with the canopy open."
              width={1755}
              height={1790}
              className="w-full rounded-lg"
            />
          </figure>
          <div className="min-w-0 space-y-8">
            <SiteCopyBody body={page.body} />
            <figure className="max-w-sm">
              <img
                src="/brand/cain-signature.png?v=4"
                alt="Cain"
                className="h-20 w-auto sm:h-24"
              />
            </figure>
          </div>
        </div>
        <RelatedPieces path="/about" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}
