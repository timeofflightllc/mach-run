import { useEffect, useRef, useState } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { analytics } from "@heycatch/sdk";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/lib/auth/provider";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { loadSessionSnapshot } from "@/lib/auth/session-snapshot-api";
import { SessionSnapshotProvider } from "@/lib/auth/session-snapshot-context";
import type { SessionSnapshot } from "@/lib/auth/session-snapshot";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { IdleLockGate } from "@/components/meridian/idle-lock";
import appCss from "../styles.css?url";

analytics.init({
  projectKey: "hck_pk_2Y58GjA3r428b2BKcI78Y0sR-KRY4GpW",
  install: {
    framework: "vite-react",
    frameworkVersion: "8",
    agent: "other",
  },
});

const APP_NAME = "The Supersonic Retirement Calculator";

export const Route = createRootRoute({
  // Painted once per document. A later refetch must not flip a name back to
  // Sign In while the browser session check is still pending.
  staleTime: Number.POSITIVE_INFINITY,
  loader: async () => {
    try {
      const sessionUser = await loadSessionSnapshot();
      return { sessionUser: sessionUser ?? null };
    } catch {
      return { sessionUser: null as SessionSnapshot | null };
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "The Supersonic Retirement Calculator. Measure, Allocate, Compound, Harvest.",
      },
      { name: "theme-color", content: "#1A2330" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://machrun.com/" },
      { property: "og:title", content: "MACH RUN" },
      {
        property: "og:description",
        content:
          "The Supersonic Retirement Calculator. Measure, Allocate, Compound, Harvest.",
      },
      { property: "og:image", content: "https://machrun.com/og-v25.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "MACH RUN — The Supersonic Retirement Calculator" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MACH RUN" },
      {
        name: "twitter:description",
        content:
          "The Supersonic Retirement Calculator. Measure, Allocate, Compound, Harvest.",
      },
      { name: "twitter:image", content: "https://machrun.com/og-v25.jpg" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preload", href: appCss, as: "style" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Bebas+Neue&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=optional",
      },
    ],
  }),
  component: RootShell,
});

function HeyCatchPerson() {
  const { user, isPending } = useCurrentUserState();
  const { plan, pending } = useEntitlement();
  const seen = useRef("");
  useEffect(() => {
    if (isPending || pending) return;
    if (!user || user.isDevFallback) return;
    const mark = `${user.id}|${plan}`;
    if (seen.current === mark) return;
    seen.current = mark;
    analytics.setIdentity(user.id, {
      ...(user.displayName ? { name: user.displayName } : {}),
      plan,
    });
  }, [user, isPending, plan, pending]);
  return null;
}

function RootShell() {
  const { sessionUser } = Route.useLoaderData();
  const [snapshot] = useState(sessionUser);
  return (
    <html
      lang="en"
      className="antialiased"
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <SessionSnapshotProvider value={snapshot}>
          <AuthProvider>
            <HeyCatchPerson />
            <IdleLockGate />
            <Outlet />
          </AuthProvider>
        </SessionSnapshotProvider>
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}
