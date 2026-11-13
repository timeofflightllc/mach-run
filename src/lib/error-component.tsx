import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { reportSiteError } from "@/lib/notify/report-site-error";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  useEffect(() => {
    reportSiteError({
      kind: "route",
      message: error?.message || "A page failed to load.",
      stack: error instanceof Error ? error.stack : "",
    });
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <img src="/brand/mach-run-logo.jpg" alt="MACH RUN" className="mb-2 h-16 w-auto" />
      <h1 className="font-display text-3xl text-fg">This page did not load.</h1>
      <p className="max-w-md text-sm text-muted">
        Reload it. If it happens again, the note is already on its way.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 bg-fg px-4 py-2 text-sm font-medium text-bg"
      >
        Reload
      </button>
      <Link to="/" className="text-sm text-fg underline underline-offset-4">
        MACH RUN
      </Link>
    </main>
  );
}
