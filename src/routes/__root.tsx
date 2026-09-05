import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { IdleLockGate } from "@/components/meridian/idle-lock";
import appCss from "../styles.css?url";

const APP_NAME = "The Supersonic Retirement Calculator";

export const Route = createRootRoute({
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
      { name: "theme-color", content: "#0a1835" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://machrun.com/" },
      { property: "og:title", content: "MACH RUN" },
      {
        property: "og:description",
        content:
          "The Supersonic Retirement Calculator. Measure, Allocate, Compound, Harvest.",
      },
      { property: "og:image", content: "https://machrun.com/og.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MACH RUN" },
      {
        name: "twitter:description",
        content:
          "The Supersonic Retirement Calculator. Measure, Allocate, Compound, Harvest.",
      },
      { name: "twitter:image", content: "https://machrun.com/og.jpg" },
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
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=optional",
      },
    ],
  }),
  component: () => (
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
        <AuthProvider>
          <IdleLockGate />
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
