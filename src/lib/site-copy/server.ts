import { getSql } from "@/lib/db";
import { pathsForSlug, pingIndexNow } from "@/lib/seo/sitemap";
import { DEFAULT_PAGES, defaultAnnouncements, byAnnouncementDateDesc, PINNED_ANNOUNCEMENTS, REFUND_FAQ_BLOCK, REFUND_LEGAL_BLOCK, FREE_CALCULATORS_BLOCK } from "./defaults";
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

const TOOLS_DECISION_LINE =
  "A calculator result is not a decision. The rule is in the [Terms of Service](/legal#free-calculators).";

/** Once. Puts the closing Tools line into the desk body. A later edit can change or delete it. */
async function ensureToolsDecisionLine(): Promise<void> {
  const sql = await getSql();
  const flagged = await sql.query<{ key: string }>(
    "select key from mach_copy_flags where key = 'tools_decision_line'",
  );
  if (flagged.length) return;
  const rows = await sql.query<{ body: string }>(
    "select body from mach_site_pages where slug = 'tools'",
  );
  const body = rows[0]?.body ?? "";
  if (body && !body.includes("not a decision")) {
    await sql.query("update mach_site_pages set body = $1, updated_at = now() where slug = 'tools'", [
      `${body.trimEnd()}\n\n${TOOLS_DECISION_LINE}\n`,
    ]);
  }
  await sql.query(
    `insert into mach_copy_flags (key) values ('tools_decision_line')
     on conflict (key) do nothing`,
  );
}

/** A later ship note inserts once. A desk delete stays deleted. */
async function ensurePinnedAnnouncements(): Promise<void> {
  const sql = await getSql();
  for (const item of [...PINNED_ANNOUNCEMENTS].reverse()) {
    const flag = `announcement_seeded:${item.id}`;
    const flagged = await sql.query<{ key: string }>(
      "select key from mach_copy_flags where key = $1",
      [flag],
    );
    if (flagged.length) continue;
    const found = await sql.query<{ id: string }>(
      "select id from mach_announcements where id = $1",
      [item.id],
    );
    if (!found.length) {
      const rows = await sql.query<{ n: number }>(
        "select coalesce(max(sort_order), 0)::int as n from mach_announcements",
      );
      const sort = (rows[0]?.n ?? 0) + 1;
      await sql.query(
        `insert into mach_announcements (id, at, title, blurb, sort_order)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do nothing`,
        [item.id, item.at, item.title, item.blurb, sort],
      );
    }
    await sql.query(
      `insert into mach_copy_flags (key) values ($1) on conflict (key) do nothing`,
      [flag],
    );
  }
  await sql.query(
    `update mach_announcements set title = 'Mach Rewind' where id = 'feat-2026-10-27-mach-back' and title = 'Mach Back'`,
  );
}

function freshenStoredCopy(body: string): string {
  const next = body
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
      "The full disclaimer and Terms of Service live on [Legal](/legal).",
      "The full disclaimer and Terms of Service live on [Terms of Service](/legal).",
    )
    .replaceAll(
      "The full rule is on [Legal](/legal#refunds).",
      "The full rule is on [Terms of Service](/legal#refunds).",
    )
    .replaceAll(
      "A retired U.S. Air Force fighter pilot who wanted one system for multiple stages of income, numerous types of accounts and contributions, a nest-egg goal, and math-driven estimations of date the money runs out.",
      "A retired U.S. Air Force fighter pilot wanted one system for staged income, accounts, and contributions. It also holds a nest-egg goal and estimates the date the money runs out.",
    )
    .replaceAll(
      "A spreadsheet has only the rows you build. Quicken Classic can hold some of the same pay. The checks below are what each one includes today.",
      "A spreadsheet has only the rows you build, and lacks Monte Carlo and a seamless user interface. Quicken Classic can hold some of the same pay, but is not focused on retirement planning and is not made by veterans for veterans. Please see the table below for a robust comparison of MACH RUN to the other common products.",
    )
    .replaceAll("Seven-day trial, then $69/month.", "14-day trial, then $69/month.")
    .replaceAll("7-day free trial", "14-day free trial")
    .replaceAll("7-day trial, we throw in two months", "14-day trial, we throw in two months")
    .replaceAll("7-day trial, 2 months free", "14-day trial, 2 months free")
    .replaceAll("7-day trial, then $69/month", "14-day trial, then $69/month")
    .replaceAll("A 7-day Advisor trial", "A 14-day Advisor Lite or Advisor Unlimited trial")
    .replaceAll(
      "Details and a 7-day trial live on [Pricing](/pricing).",
      "Each includes a 14-day trial. Details live on [Pricing](/pricing).",
    )
    .replaceAll(
      "Advisor Lite includes a 14-day trial. Details live on [Pricing](/pricing).",
      "Each includes a 14-day trial. Details live on [Pricing](/pricing).",
    )
    .replaceAll(
      "For Advisor Lite and Advisor Unlimited trials, the card is charged when the trial ends unless canceled before then.",
      "Advisor Lite and Advisor Unlimited each include a 14-day trial. The card is charged when that trial ends unless canceled before then.",
    )
    .replaceAll(
      "Advisor Lite includes a 14-day trial. The card is charged when that trial ends unless canceled before then. Advisor Unlimited is charged at checkout.",
      "Advisor Lite and Advisor Unlimited each include a 14-day trial. The card is charged when that trial ends unless canceled before then.",
    )
    .replaceAll(
      "Advisor Unlimited is the same engine with unlimited profiles.",
      "Advisor Unlimited is unlimited profiles. 14-day trial, then $169/month.",
    )
    .replaceAll(
      "Advisor Lite includes a 14-day free trial (card on file).",
      "Advisor Lite and Advisor Unlimited each include a 14-day free trial (card on file).",
    )
    .replaceAll('"$169/month for an unlimited book."', '"14-day trial, then $169/month"')
    .replaceAll(
      '"advisorUnlimitedTagYear": "Fly yearly and we throw in two months."',
      '"advisorUnlimitedTagYear": "14-day trial, we throw in two months."',
    );
  return ensureFreeCalculators(ensureRefundCopy(next));
}

const OLD_NOT_REFUNDED = "The current period is not refunded except where the law requires it.";
const OLD_ACCESS =
  "Access lasts through the paid period unless the account is closed for abuse.";
const NEW_ACCESS =
  "Access lasts through the paid period unless a refund is sent or the account is closed for abuse.";

function ensureRefundCopy(body: string): string {
  let next = body
    .replaceAll(
      "Last updated: October 3, 2026. MACH RUN is a hypothetical",
      "Last updated: October 24, 2026. MACH RUN is a hypothetical",
    )
    .replaceAll(
      "Last updated: October 12, 2026. MACH RUN is a hypothetical",
      "Last updated: October 24, 2026. MACH RUN is a hypothetical",
    );
  if (next.includes(OLD_NOT_REFUNDED)) {
    next = next.replaceAll(
      OLD_NOT_REFUNDED,
      "Canceling stops the next charge. It does not by itself refund a charge already made.",
    );
  }
  if (next.includes(OLD_ACCESS)) next = next.replaceAll(OLD_ACCESS, NEW_ACCESS);
  if (next.includes("# Subscriptions") && next.includes("Paid plans are billed by Stripe") && !next.includes("# Refunds")) {
    const at = next.indexOf("\n# Not advice");
    next = at === -1 ? `${next.trimEnd()}\n\n${REFUND_LEGAL_BLOCK}\n` : `${next.slice(0, at)}\n\n${REFUND_LEGAL_BLOCK}${next.slice(at)}`;
  }
  if ((next.includes("# How do I cancel") || next.includes("# What is free")) && !next.includes("# Can I get a refund?")) {
    const who = next.indexOf("\n# Who built this?");
    next = who === -1 ? `${next.trimEnd()}\n\n${REFUND_FAQ_BLOCK}\n` : `${next.slice(0, who)}\n\n${REFUND_FAQ_BLOCK}${next.slice(who)}`;
  }
  return next;
}

function ensureFreeCalculators(body: string): string {
  let next = body.replaceAll(
    " You can use them without a paid plan. Other pay calculators, such as BAH and OHA, may be added later.",
    " You can use them without a paid plan.",
  );
  const oldClose = "MACH RUN is not a fiduciary, and these calculators are not advice.";
  const newClose =
    "While we do care about your financial success, MACH RUN is not a fiduciary, and these calculators are not advice.";
  if (next.includes(oldClose) && !next.includes("While we do care about your financial success")) {
    next = next.replaceAll(oldClose, newClose);
  }
  if (!next.includes("Florida law governs") || next.includes("# Free calculators")) return next;
  const marker = "# Acceptable use";
  const at = next.indexOf(marker);
  if (at === -1) return `${next.trimEnd()}\n\n${FREE_CALCULATORS_BLOCK}\n`;
  return `${next.slice(0, at).trimEnd()}\n\n${FREE_CALCULATORS_BLOCK}\n\n${next.slice(at)}`;
}

function presentTerms(page: SitePage): SitePage {
  if (page.slug !== "legal") return page;
  const body = page.body
    .replace(/^# Terms of Service \{#terms\}\s*/m, "")
    .replace(/^Last updated: [A-Za-z]+ \d{1,2}, \d{4}\.\s*/, "");
  return {
    ...page,
    title: "Terms of Service",
    kicker: "Last updated: October 24, 2026.",
    body,
  };
}

function preferCurrentLegal(page: SitePage): SitePage {
  const fresh = DEFAULT_PAGES.find((item) => item.slug === page.slug);
  if (!fresh) return page;
  if (page.slug === "privacy" && !page.body.includes("Cloudflare Turnstile")) return fresh;
  if (page.slug === "legal" && !page.body.includes("Florida law governs")) return fresh;
  if (page.slug === "about" && !page.body.includes("FIGHTS ON!")) return fresh;
  return freshenKicker(page);
}

function freshenKicker(page: SitePage): SitePage {
  const fresh = DEFAULT_PAGES.find((item) => item.slug === page.slug);
  if (!fresh) return page;
  const oldMethod = new Set([
    "How the MACH RUN engine actually flies the numbers you type.",
    "How the supersonic engine generates your MACH RUN.",
  ]);
  if (page.slug === "method" && oldMethod.has(page.kicker)) return { ...page, kicker: fresh.kicker };
  if (page.slug === "faq" && page.kicker === "Kick the tires. Then light the fires.") {
    return { ...page, kicker: fresh.kicker };
  }
  return page;
}

function mapPage(row: {
  slug: string;
  title: string;
  kicker: string | null;
  body: string;
}): SitePage | null {
  if (!isSlug(row.slug)) return null;
  return presentTerms(
    preferCurrentLegal({
      slug: row.slug,
      title: row.title,
      kicker: row.kicker ?? "",
      body: freshenStoredCopy(row.body ?? ""),
    }),
  );
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
    await ensureToolsDecisionLine();
    await ensurePinnedAnnouncements();
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
    }>("select id, at, title, blurb, sort_order from mach_announcements order by at desc, created_at desc");
    const pages = SITE_PAGE_SLUGS.map((slug) => {
      const found = pageRows.map(mapPage).find((p) => p?.slug === slug);
      return found ?? DEFAULT_PAGES.find((p) => p.slug === slug)!;
    });
    const announcements: SiteAnnouncement[] = noteRows
      .map((row) => ({
        id: row.id,
        at: row.at,
        title: row.title,
        blurb: row.blurb,
        sortOrder: Number(row.sort_order) || 0,
      }))
      .sort(byAnnouncementDateDesc);
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
      `insert into mach_copy_flags (key) values ($1) on conflict (key) do nothing`,
      [`announcement_seeded:${id.trim()}`],
    );
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
