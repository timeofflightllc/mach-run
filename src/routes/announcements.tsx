import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLockup, MachFooter } from "@/components/meridian/mach-mark";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { SiteNav } from "@/components/meridian/site-nav";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";

export const Route = createFileRoute("/announcements")({
  loader: () => loadPublicSiteCopy(),
  component: Announcements,
});

function Announcements() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "announcements");
  return (
    <main className="min-h-screen px-4 py-10 text-fg" style={{ backgroundColor: "#0a1835" }}>
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
        {page.body.trim() ? <SiteCopyBody body={page.body} /> : null}
        <ol className="space-y-5">
          {copy.announcements.map((item) => (
            <li key={item.id} className="border-b border-border pb-4 last:border-0">
              <p className="text-sm font-medium uppercase tracking-wider text-subtle">
                {item.at}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-fg">{item.title}</h2>
              <p className="mt-1 text-base text-muted">{item.blurb}</p>
            </li>
          ))}
        </ol>
      </div>
      <MachFooter />
    </main>
  );
}
