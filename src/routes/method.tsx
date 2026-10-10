import { createFileRoute } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";

import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/method")({
  head: () =>
    pageHead({
      title: "How the Retirement Calculator Works | MACH RUN",
      description:
        "How a MACH RUN turns family, accounts, paychecks, spending, and contributions into a monthly retirement projection.",
      path: "/method",
    }),
  loader: () => loadPublicSiteCopy(),
  component: Method,
});

function Method() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "method");
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <PieceCrumbs path="/method" />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{page.title}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        <SiteCopyBody
          body={page.body}
          aside={
            <figure className="float-right mb-3 ml-4 w-72 sm:ml-6 sm:w-[26rem] md:w-[30rem]">
              <img
                src="/brand/fa-18-vapor-cone.jpg?v=1"
                alt="An F/A-18 in a vapor cone against a clear blue sky"
                width={1024}
                height={683}
                className="w-full rounded-lg"
              />
            </figure>
          }
        />
        <RelatedPieces path="/method" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}
