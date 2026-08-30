import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/logo-drafts")({ component: LogoDrafts });

const DRAFTS = [
  { src: "/logo-drafts/draft-1.jpg", title: "Draft 1 — square emblem" },
  { src: "/logo-drafts/draft-2.jpg", title: "Draft 2 — wide lockup" },
  { src: "/logo-drafts/draft-3.jpg", title: "Draft 3 — header style" },
];

function LogoDrafts() {
  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-subtle">MACH RUN</p>
          <h1 className="mt-1 font-display text-3xl">Logo drafts</h1>
          <p className="mt-2 text-sm text-muted">
            Chat could not show these files. This page is only in preview — not
            the live site.
          </p>
          <Link to="/" className="mt-3 inline-block text-sm text-muted underline">
            Back to MACH RUN
          </Link>
        </div>
        {DRAFTS.map((d) => (
          <figure key={d.src} className="flex flex-col gap-2">
            <figcaption className="text-sm font-medium text-fg">{d.title}</figcaption>
            <img
              src={d.src}
              alt={d.title}
              className="w-full rounded-xl shadow-[0_0_0_1px_var(--color-border)]"
            />
          </figure>
        ))}
      </div>
    </main>
  );
}
