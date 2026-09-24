import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";
import type { SiteAnnouncement } from "@/lib/site-copy/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/announcements")({
  loader: () => loadPublicSiteCopy(),
  component: Announcements,
});

const LATEST = 10;

function monthKey(at: string): string {
  const m = at.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : "unknown";
}

function monthLabel(key: string): string {
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (!m) return key;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function prettyDate(at: string): string {
  const m = at.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return at;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  );
}

function FeatureItem({ item }: { item: SiteAnnouncement }) {
  return (
    <li className="border-b border-border pb-4 last:border-0">
      <p className="text-base font-medium uppercase tracking-wider text-subtle">
        {prettyDate(item.at)}
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold text-fg">{item.title}</h2>
      <p className="mt-1 text-lg text-muted">{item.blurb}</p>
    </li>
  );
}

function EarlierByMonth({ items }: { items: SiteAnnouncement[] }) {
  const months = useMemo(() => {
    const map = new Map<string, SiteAnnouncement[]>();
    for (const item of items) {
      const key = monthKey(item.at);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [items]);
  const [picked, setPicked] = useState("");
  const shown = months.find(([key]) => key === picked)?.[1] ?? [];

  if (!months.length) return null;

  return (
    <section className="space-y-5 border-t border-border pt-8">
      <div className="flex max-w-md flex-col gap-1.5">
        <label htmlFor="feature-month" className="text-xs font-medium tracking-wide text-muted">
          Earlier ships
        </label>
        <select
          id="feature-month"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className={cn(
            "h-11 w-full min-w-0 rounded-lg border border-border bg-elevated px-3 text-sm text-fg outline-none",
            "transition-[box-shadow,border-color] duration-150",
            "focus:border-accent/40 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]",
          )}
        >
          <option value="">Pick a month</option>
          {months.map(([key]) => (
            <option key={key} value={key}>
              {monthLabel(key)}
            </option>
          ))}
        </select>
        <p className="text-xs text-subtle">
          Ten newest are above. Choose a month for everything else, newest first in that month.
        </p>
      </div>
      {picked ? (
        shown.length ? (
          <ol className="space-y-5">
            {shown.map((item) => (
              <FeatureItem key={item.id} item={item} />
            ))}
          </ol>
        ) : (
          <p className="text-muted">Nothing in that month.</p>
        )
      ) : null}
    </section>
  );
}

function Announcements() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "announcements");
  const latest = copy.announcements.slice(0, LATEST);
  const earlier = copy.announcements.slice(LATEST);

  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="page-gutter mx-auto w-full space-y-8">
        <PageMast />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{page.title}</h1>
          {page.kicker ? <p className="mt-2 text-lg text-muted">{page.kicker}</p> : null}
        </header>
        {page.body.trim() ? <SiteCopyBody body={page.body} /> : null}
        <ol className="space-y-5">
          {latest.map((item) => (
            <FeatureItem key={item.id} item={item} />
          ))}
        </ol>
        <EarlierByMonth items={earlier} />
      </div>
      <MachFooter />
    </main>
  );
}
