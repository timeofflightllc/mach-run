import { getSql } from "@/lib/db";
import { pathsForSlug, pingIndexNow } from "@/lib/seo/sitemap";
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
  for (const page of DEFAULT_PAGES) {
    await sql.query(
      `insert into mach_site_pages (slug, title, kicker, body, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (slug) do nothing`,
      [page.slug, page.title, page.kicker || null, page.body],
    );
  }
  await sql.query(`
    create table if not exists mach_copy_flags (
      key text primary key,
      created_at timestamptz not null default now()
    )
  `);
  const flagged = await sql.query<{ key: string }>(
    "select key from mach_copy_flags where key = 'announcements_seeded'",
  );
  if (flagged.length) return;
  const notes = await sql.query<{ n: number }>(
    "select count(*)::int as n from mach_announcements",
  );
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
  await sql.query(
    `insert into mach_copy_flags (key) values ('announcements_seeded')
     on conflict (key) do nothing`,
  );
}

function freshenStoredCopy(body: string): string {
  return body
    .replace(
      /^This is the briefing on the engine\s*[—–-]\s*not a second legal page\.\s*\[Legal\]\(\/legal\) holds the disclaimer\.\s*Here is what Calculate does with the numbers in Observe, Orient, and Decide\.\s*/m,
      "",
    )
    .replaceAll(
      "[Free vs MACH RUN paid](/pricing) — $4/month or $40/year unlocks unlimited accounts, contribution rules, income stages, Net Worth, and the full OODA.",
      "[Free vs MACH RUN paid](/pricing) — Individual ($4/month or $40/year) keeps unlimited accounts, contributions, and incomes. Net Worth stays locked until Individual Unlimited or Advisor.",
    )
    .replaceAll("MachRun Financial Analysis", "MACH OODA Financial Analysis")
    .replaceAll("MachRun", "MACH RUN")
    .replaceAll("Supersonic Financial Calculator", "Supersonic Retirement Calculator")
    .replaceAll("Project through primary age", "Project through longevity age")
    .replaceAll("project through primary age", "project through longevity age")
    .replaceAll("“project through” age", "longevity age")
    .replaceAll("For financial professionals, or nerds", "For financial professionals")
    .replaceAll(
      "Individual ($4/month or $40/year): one household, unlimited accounts, contributions, and incomes, plus the full MACH OODA Financial Analysis and OODA AI on that MACH RUN.",
      "Individual ($4/month or $40/year) is one household with unlimited accounts, contributions, and incomes. It adds the full MACH OODA Financial Analysis and OODA AI on that MACH RUN.",
    )
    .replaceAll(
      "In Family, set the retirement goal date — there is an “already retired” path so you can put the month and year you left work.",
      "In Family, set the retirement goal date. An already-retired path lets you enter the month and year you left work.",
    )
    .replaceAll(
      "For tax-qualified accounts, required minimum distributions are modeled in the background when the rules say they apply, and called out in the analysis.",
      "For tax-qualified accounts, required minimum distributions are modeled when the rules say they apply. The analysis calls them out.",
    )
    .replaceAll(
      "Individual Unlimited and Advisor can download a password-protected .machrun backup — that password is not the site login, and MACH RUN does not keep it.",
      "Individual Unlimited and Advisor can download a password-protected .machrun backup. That password is not the site login. MACH RUN does not keep it.",
    )
    .replaceAll(
      "A retired U.S. Air Force fighter pilot who wanted one system for multiple stages of income, numerous types of accounts and contributions, a nest-egg goal, and math-driven estimations of date the money runs out.",
      "A retired U.S. Air Force fighter pilot wanted one system for staged income, accounts, and contributions. It also holds a nest-egg goal and estimates the date the money runs out.",
    );
}

function preferCurrentLegal(page: SitePage): SitePage {
  const fresh = DEFAULT_PAGES.find((item) => item.slug === page.slug);
  if (!fresh) return page;
  if (page.slug === "privacy" && !page.body.includes("Cloudflare Turnstile")) return fresh;
  if (page.slug === "legal" && !page.body.includes("Florida law governs")) return fresh;
  return page;
}

function mapPage(row: {
  slug: string;
  title: string;
  kicker: string | null;
  body: string;
}): SitePage | null {
  if (!isSlug(row.slug)) return null;
  return preferCurrentLegal({
    slug: row.slug,
    title: row.title,
    kicker: row.kicker ?? "",
    body: freshenStoredCopy(row.body ?? ""),
  });
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
      announcements,
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
    void pingIndexNow(pathsForSlug(page.slug));
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
    await sql.query(
      "update mach_site_pages set updated_at = now() where slug = 'announcements'",
    );
    void pingIndexNow(["/announcements"]);
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
    await sql.query(
      "update mach_site_pages set updated_at = now() where slug = 'announcements'",
    );
    void pingIndexNow(["/announcements"]);
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
