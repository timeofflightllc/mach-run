import { createFileRoute } from "@tanstack/react-router";
import { buildSitemapXml, SITEMAP_PAGES } from "@/lib/seo/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const recordDates: Record<string, string[]> = {};
        const add = (path: string, value: unknown) => {
          if (value == null) return;
          const text = value instanceof Date ? value.toISOString() : String(value);
          if (!text || text === "null") return;
          (recordDates[path] ??= []).push(text);
        };
        try {
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          const pages = await sql.query<{ slug: string; updated_at: Date | string }>(
            "select slug, updated_at from mach_site_pages",
          );
          for (const row of pages) {
            for (const page of SITEMAP_PAGES) {
              if ((page.slugs as readonly string[]).includes(row.slug)) add(page.path, row.updated_at);
            }
          }
          const ships = await sql.query<{ at: string; created_at: Date | string }>(
            "select at, created_at from mach_announcements",
          );
          for (const row of ships) {
            add("/announcements", row.created_at);
            add("/announcements", row.at);
          }
        } catch {
          /* Source commit dates still fill lastmod. */
        }
        return new Response(buildSitemapXml(recordDates), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
