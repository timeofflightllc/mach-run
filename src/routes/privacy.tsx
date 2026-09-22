import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLockup, MachFooter } from "@/components/meridian/mach-mark";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { SiteMenu } from "@/components/meridian/site-nav";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";

export const Route = createFileRoute("/privacy")({
  loader: () => loadPublicSiteCopy(),
  component: Privacy,
});

function Privacy() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "privacy");
  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <Link to="/" className="inline-block opacity-90 hover:opacity-100">
            <BrandLockup framed />
          </Link>
          <div className="mt-1 flex shrink-0 items-center gap-1">
            <SiteMenu align="right" />
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
            >
              Home
            </Link>
          </div>
        </div>
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{page.title}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        <SiteCopyBody body={page.body} />
      </div>
      <MachFooter />
    </main>
  );
}
