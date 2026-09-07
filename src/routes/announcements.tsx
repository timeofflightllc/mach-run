import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLockup, MachFooter } from "@/components/meridian/mach-mark";
import { SiteNav } from "@/components/meridian/site-nav";
import { ANNOUNCEMENTS } from "@/lib/announcements";

export const Route = createFileRoute("/announcements")({
  component: Announcements,
});

function Announcements() {
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
          <h1 className="mt-2 font-display text-4xl text-fg">Feature announcements</h1>
          <p className="mt-2 text-sm text-muted">
            Last twenty-five ships, newest first. Short notes only.
          </p>
        </header>
        <ol className="space-y-5">
          {ANNOUNCEMENTS.map((item) => (
            <li
              key={`${item.at}-${item.title}`}
              className="border-b border-border pb-4 last:border-0"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-subtle">
                {item.at}
              </p>
              <h2 className="mt-1 font-display text-lg font-bold text-fg">
                {item.title}
              </h2>
              <p className="mt-1 text-sm text-muted">{item.blurb}</p>
            </li>
          ))}
        </ol>
      </div>
      <MachFooter />
    </main>
  );
}
