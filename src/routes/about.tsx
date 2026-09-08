import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLockup, MachFooter } from "@/components/meridian/mach-mark";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { SiteMenu } from "@/components/meridian/site-nav";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";

export const Route = createFileRoute("/about")({
  loader: () => loadPublicSiteCopy(),
  component: About,
});

function About() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "about");
  return (
    <main className="min-h-screen px-4 py-10 text-fg" style={{ backgroundColor: "#0a1835" }}>
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-1">
            <Link to="/" className="inline-block opacity-90 hover:opacity-100">
              <BrandLockup />
            </Link>
            <SiteMenu className="mt-1" />
          </div>
          <Link
            to="/"
            className="mt-1 inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-elevated"
          >
            Home
          </Link>
        </div>
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-subtle">
            machrun.com
          </p>
          <h1 className="mt-2 font-display text-4xl text-fg sm:text-5xl">{page.title}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        <SiteCopyBody body={page.body} />
        <figure className="mt-4 max-w-sm">
          <img
            src="/brand/cain-signature.png"
            alt="Cain"
            className="h-20 w-auto sm:h-24"
          />
        </figure>
      </div>
      <MachFooter />
    </main>
  );
}
