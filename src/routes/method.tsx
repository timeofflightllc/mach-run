import { createFileRoute } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";

export const Route = createFileRoute("/method")({
  loader: () => loadPublicSiteCopy(),
  component: Method,
});

function Method() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "method");
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="page-gutter mx-auto w-full space-y-8">
        <PageMast />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{page.title}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        <figure className="overflow-hidden rounded-lg">
          <img
            src="/brand/fa-18-vapor-cone.jpg?v=1"
            alt="An F/A-18 in a vapor cone against a clear blue sky"
            width={1024}
            height={683}
            className="aspect-[3/2] w-full object-cover object-[center_40%]"
          />
        </figure>
        <SiteCopyBody body={page.body} />
      </div>
      <MachFooter />
    </main>
  );
}
