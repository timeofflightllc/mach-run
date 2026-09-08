import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLockup, MachFooter } from "@/components/meridian/mach-mark";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { SiteNav } from "@/components/meridian/site-nav";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";

export const Route = createFileRoute("/about")({
  loader: () => loadPublicSiteCopy(),
  component: About,
});

function About() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "about");
  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <Link to="/" className="inline-block opacity-90 hover:opacity-100">
          <BrandLockup framed />
        </Link>
        <SiteNav />
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            machrun.com
          </p>
          <h1 className="mt-2 font-display text-4xl text-fg">{page.title}</h1>
          {page.kicker ? <p className="mt-2 text-base text-muted">{page.kicker}</p> : null}
        </header>
        <SiteCopyBody body={page.body} />
      </div>
      <MachFooter />
    </main>
  );
}
