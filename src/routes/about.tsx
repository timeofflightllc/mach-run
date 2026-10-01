import { createFileRoute } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";

export const Route = createFileRoute("/about")({
  loader: () => loadPublicSiteCopy(),
  component: About,
});

function About() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "about");
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="page-gutter mx-auto w-full space-y-8">
        <PageMast />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{page.title}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)] lg:gap-10">
          <figure className="order-last lg:order-none lg:sticky lg:top-6">
            <img
              src="/brand/f-15qa-blue74.jpg"
              alt="F-15QA climbing through cloud, afterburners lit"
              width={960}
              height={1439}
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
      </div>
      <MachFooter />
    </main>
  );
}
