import { Link } from "@tanstack/react-router";

export function MissingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">404</p>
      <h1 className="font-display text-3xl text-fg">This page is not here.</h1>
      <p className="max-w-md text-sm text-muted">Check the address, or go back to the start.</p>
      <Link to="/" className="mt-2 text-sm text-fg underline underline-offset-4">
        MACH RUN
      </Link>
    </main>
  );
}
