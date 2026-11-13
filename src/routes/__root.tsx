import { useEffect, useRef, useState } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { analytics } from "@heycatch/sdk";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/lib/auth/provider";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useEntitlement } from "@/lib/billing/use-entitlement";
import { heycatchName } from "@/lib/heycatch-name";
import { loadSessionSnapshot } from "@/lib/auth/session-snapshot-api";
import { SessionSnapshotProvider } from "@/lib/auth/session-snapshot-context";
import type { SessionSnapshot } from "@/lib/auth/session-snapshot";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { IdleLockGate } from "@/components/meridian/idle-lock";
import { loadPublicSiteCopy } from "@/lib/site-copy/api";
import { recordCampaignClickFn } from "@/lib/referrals/api";
import { attachVisitor, noteVisitor } from "@/lib/conversions/api";
import { footerFromSiteCopy } from "@/lib/site-copy/footer-copy";
import appCss from "../styles.css?url";

analytics.init({
  projectKey: "hck_pk_2Y58GjA3r428b2BKcI78Y0sR-KRY4GpW",
  install: {
    framework: "vite-react",
    frameworkVersion: "8",
    agent: "other",
  },
});

export const Route = createRootRoute({
  // Painted once per document. A later refetch must not flip a name back to
  // Sign In while the browser session check is still pending.
  staleTime: Number.POSITIVE_INFINITY,
  loader: async ({ location }) => {
    const search = `${location.searchStr ?? ""}${location.href ?? ""}`;
    if (search.includes("ref=")) {
      try {
        await recordCampaignClickFn();
      } catch {
        /* a missed click must not blank the page */
      }
    }
    const [sessionUser, site] = await Promise.all([
      loadSessionSnapshot().catch(() => null),
      loadPublicSiteCopy(),
    ]);
    return {
      sessionUser: (sessionUser ?? null) as SessionSnapshot | null,
      footer: footerFromSiteCopy(site),
      site,
    };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1A2330" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://machrun.com/og.jpg?v=26" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "MACH RUN — The Supersonic Retirement Calculator" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://machrun.com/og.jpg?v=26" },
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
    const shortName = heycatchName(user.displayName);
    analytics.setIdentity(user.id, {
      ...(shortName ? { name: shortName } : {}),
      plan,
    });
  }, [user, isPending, plan, pending]);
  return null;
}

let visitNoted: Promise<void> | null = null;

function sessionNoted(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function sessionMark(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* private mode still sends once per mount */
  }
}

/** One visit per browser session, then link the cookie once a real account is on screen. */
function VisitorCount() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visitSent = useRef(false);
  const attachSent = useRef(false);

  useEffect(() => {
    if (visitSent.current) return;
    if (pathname.startsWith("/top-3-desk")) return;
    visitSent.current = true;
    if (sessionNoted("mach-visit-noted")) return;
    sessionMark("mach-visit-noted");
    visitNoted = noteVisitor({ data: { event: "visit" } })
      .then(() => undefined)
      .catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    if (attachSent.current || isPending) return;
    if (!user || user.isDevFallback) return;
    attachSent.current = true;
    if (sessionNoted("mach-visitor-attached")) return;
    sessionMark("mach-visitor-attached");
    const pending = visitNoted ?? Promise.resolve();
    void pending.then(() => attachVisitor()).catch(() => undefined);
  }, [user, isPending]);

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
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var p=new URLSearchParams(location.search).get("ref");if(!p)return;p=p.trim().toLowerCase();if(!/^[a-z0-9]{4,32}$/.test(p))return;if(/(?:^|; )mach_ref=/.test(document.cookie))return;var s=location.protocol==="https:"?"; Secure":"";document.cookie="mach_ref="+p+"; Max-Age=2592000; Path=/; SameSite=Lax"+s;}catch(e){}})();',
          }}
        />
        <PreviewHostBridge />
        <SessionSnapshotProvider value={snapshot}>
          <AuthProvider>
            <HeyCatchPerson />
            <VisitorCount />
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
