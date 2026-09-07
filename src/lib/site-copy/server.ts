import { getSql } from "@/lib/db";
import { DEFAULT_PAGES, defaultAnnouncements } from "./defaults";
import {
  SITE_PAGE_SLUGS,
  type SiteAnnouncement,
  type SiteCopy,
  type SitePage,
  type SitePageSlug,
} from "./types";

function isSlug(value: string): value is SitePageSlug {
  return (SITE_PAGE_SLUGS as readonly string[]).includes(value);
}

export async function ensureSiteCopyTables(): Promise<boolean> {
  try {
    const sql = await getSql();
    await sql.query(`
      create table if not exists mach_site_pages (
        slug text primary key,
        title text not null,
        kicker text,
        body text not null,
        updated_at timestamptz not null default now()
      )
    `);
    await sql.query(`
      create table if not exists mach_announcements (
        id text primary key,
        at text not null,
        title text not null,
        blurb text not null,
        sort_order int not null default 0,
        created_at timestamptz not null default now()
      )
    `);
    await sql.query(`
      create index if not exists mach_announcements_sort_idx
        on mach_announcements (sort_order desc, created_at desc)
    `);
    return true;
  } catch {
    return false;
  }
}

async function seedIfEmpty(): Promise<void> {
  const sql = await getSql();
  const pages = await sql.query<{ n: number }>("select count(*)::int as n from mach_site_pages");
  if ((pages[0]?.n ?? 0) === 0) {
    for (const page of DEFAULT_PAGES) {
      await sql.query(
        `insert into mach_site_pages (slug, title, kicker, body, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (slug) do nothing`,
        [page.slug, page.title, page.kicker || null, page.body],
      );
    }
  }
  const notes = await sql.query<{ n: number }>("select count(*)::int as n from mach_announcements");
  if ((notes[0]?.n ?? 0) === 0) {
    for (const item of defaultAnnouncements()) {
      await sql.query(
        `insert into mach_announcements (id, at, title, blurb, sort_order)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do nothing`,
        [item.id, item.at, item.title, item.blurb, item.sortOrder],
      );
    }
  }
}

function mapPage(row: {
  slug: string;
  title: string;
  kicker: string | null;
  body: string;
}): SitePage | null {
  if (!isSlug(row.slug)) return null;
  return {
    slug: row.slug,
    title: row.title,
    kicker: row.kicker ?? "",
    body: row.body ?? "",
  };
}

export async function loadSiteCopy(): Promise<SiteCopy> {
  const fallback: SiteCopy = {
    pages: DEFAULT_PAGES,
    announcements: defaultAnnouncements(),
  };
  const ok = await ensureSiteCopyTables();
  if (!ok) return fallback;
  try {
    await seedIfEmpty();
    const sql = await getSql();
    const pageRows = await sql.query<{
      slug: string;
      title: string;
      kicker: string | null;
      body: string;
    }>("select slug, title, kicker, body from mach_site_pages");
    const noteRows = await sql.query<{
      id: string;
      at: string;
      title: string;
      blurb: string;
      sort_order: number;
    }>("select id, at, title, blurb, sort_order from mach_announcements order by sort_order desc, created_at desc");
    const pages = SITE_PAGE_SLUGS.map((slug) => {
      const found = pageRows.map(mapPage).find((p) => p?.slug === slug);
      return found ?? DEFAULT_PAGES.find((p) => p.slug === slug)!;
    });
    const announcements: SiteAnnouncement[] = noteRows.map((row) => ({
      id: row.id,
      at: row.at,
      title: row.title,
      blurb: row.blurb,
      sortOrder: Number(row.sort_order) || 0,
    }));
    return {
      pages,
      announcements: announcements.length ? announcements : defaultAnnouncements(),
    };
  } catch {
    return fallback;
  }
}

export async function saveSitePage(page: SitePage): Promise<string | null> {
  if (!isSlug(page.slug)) return "Unknown page.";
  const ok = await ensureSiteCopyTables();
  if (!ok) return "Could not reach the page table.";
  try {
    const sql = await getSql();
    await sql.query(
      `insert into mach_site_pages (slug, title, kicker, body, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (slug) do update set
         title = excluded.title,
         kicker = excluded.kicker,
         body = excluded.body,
         updated_at = now()`,
      [page.slug, page.title.trim() || page.slug, page.kicker.trim() || null, page.body],
    );
    return null;
  } catch {
    return "Could not save that page.";
  }
}

export async function saveAnnouncement(item: SiteAnnouncement): Promise<string | null> {
  const ok = await ensureSiteCopyTables();
  if (!ok) return "Could not reach the feature table.";
  const id = item.id.trim() || crypto.randomUUID();
  const title = item.title.trim();
  const blurb = item.blurb.trim();
  if (!title || !blurb) return "Title and note are required.";
  try {
    const sql = await getSql();
    await sql.query(
      `insert into mach_announcements (id, at, title, blurb, sort_order)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set
         at = excluded.at,
         title = excluded.title,
         blurb = excluded.blurb,
         sort_order = excluded.sort_order`,
      [id, item.at.trim() || new Date().toISOString().slice(0, 10), title, blurb, item.sortOrder],
    );
    return null;
  } catch {
    return "Could not save that feature.";
  }
}

export async function deleteAnnouncement(id: string): Promise<string | null> {
  if (!id.trim()) return "Missing feature.";
  const ok = await ensureSiteCopyTables();
  if (!ok) return "Could not reach the feature table.";
  try {
    const sql = await getSql();
    await sql.query("delete from mach_announcements where id = $1", [id]);
    return null;
  } catch {
    return "Could not delete that feature.";
  }
}

export async function nextAnnouncementOrder(): Promise<number> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ n: number }>(
      "select coalesce(max(sort_order), 0)::int as n from mach_announcements",
    );
    return (rows[0]?.n ?? 0) + 1;
  } catch {
    return Date.now();
  }
}
