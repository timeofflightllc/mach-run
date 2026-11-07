import { getSql } from "@/lib/db";
import {
  PENSION_ARTICLE_BODY,
  PENSION_ARTICLE_CREATED_AT,
  PENSION_ARTICLE_H1,
  PENSION_ARTICLE_PAGE_TITLE,
  PENSION_ARTICLE_SLUG,
} from "./pension-article";
import { articleFieldsError, articleSlugError, ARTICLE_SLUG_RE } from "./slug";
import type { ArticleRecord } from "./types";

const PENSION_ARTICLE_FLAG = "article_seeded:military-pension-present-value";
/** One refresh. Replaces the stored pension article with the current seed, then stops. */
const PENSION_ARTICLE_REFRESH = "article_refresh:military-pension-present-value:2026-11-07-close";

type ArticleRow = {
  slug: string;
  page_title: string;
  h1: string;
  body: string;
  created_at: string | Date;
};

function asIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return String(value);
}

function pensionSeed(): ArticleRecord {
  return {
    slug: PENSION_ARTICLE_SLUG,
    pageTitle: PENSION_ARTICLE_PAGE_TITLE,
    h1: PENSION_ARTICLE_H1,
    body: PENSION_ARTICLE_BODY,
    createdAt: PENSION_ARTICLE_CREATED_AT,
  };
}

function withPensionSeed(articles: ArticleRecord[]): ArticleRecord[] {
  if (articles.some((article) => article.slug === PENSION_ARTICLE_SLUG)) return articles;
  return [...articles, pensionSeed()];
}

function mapArticle(row: ArticleRow): ArticleRecord {
  return {
    slug: row.slug,
    pageTitle: row.page_title,
    h1: row.h1,
    body: row.body,
    createdAt: asIso(row.created_at),
  };
}

/**
 * Make sure the pension article is the current seed.
 * The refresh flag runs once, so a later Top 3 edit is left alone.
 * A missing table (migration not applied yet) is ignored.
 */
export async function ensurePensionArticle(): Promise<void> {
  try {
    const sql = await getSql();
    await sql.query(`
      create table if not exists mach_copy_flags (
        key text primary key,
        created_at timestamptz not null default now()
      )
    `);
    const flagged = await sql.query<{ key: string }>(
      "select key from mach_copy_flags where key = $1",
      [PENSION_ARTICLE_REFRESH],
    );
    if (flagged.length) return;
    await sql.query(
      `insert into mach_articles (slug, page_title, h1, body, created_at)
       values ($1, $2, $3, $4, $5)
       on conflict (slug) do update set
         page_title = excluded.page_title,
         h1 = excluded.h1,
         body = excluded.body`,
      [
        PENSION_ARTICLE_SLUG,
        PENSION_ARTICLE_PAGE_TITLE,
        PENSION_ARTICLE_H1,
        PENSION_ARTICLE_BODY,
        PENSION_ARTICLE_CREATED_AT,
      ],
    );
    await sql.query(
      `insert into mach_copy_flags (key) values ($1), ($2) on conflict (key) do nothing`,
      [PENSION_ARTICLE_FLAG, PENSION_ARTICLE_REFRESH],
    );
  } catch {
    // mach_articles is not there yet, or the database is down. Do not block the page.
  }
}

export async function listArticles(): Promise<ArticleRecord[]> {
  try {
    await ensurePensionArticle();
    const sql = await getSql();
    const rows = await sql.query<ArticleRow>(
      `select slug, page_title, h1, body, created_at
       from mach_articles
       order by created_at desc, slug asc`,
    );
    return withPensionSeed(rows.map(mapArticle));
  } catch {
    return [pensionSeed()];
  }
}

export async function getArticle(slug: string): Promise<ArticleRecord | null> {
  if (!ARTICLE_SLUG_RE.test(slug)) return null;
  try {
    await ensurePensionArticle();
    const sql = await getSql();
    const rows = await sql.query<ArticleRow>(
      `select slug, page_title, h1, body, created_at
       from mach_articles
       where slug = $1`,
      [slug],
    );
    const row = rows[0];
    return row ? mapArticle(row) : null;
  } catch {
    return null;
  }
}

/** Three fields only. created_at is not in the update. */
export async function saveArticle(
  slug: string,
  pageTitle: string,
  h1: string,
  body: string,
): Promise<string | null> {
  const fields = articleFieldsError(pageTitle, h1, body);
  if (fields) return fields;
  if (!ARTICLE_SLUG_RE.test(slug)) return "That article is not there.";
  const sql = await getSql();
  const rows = await sql.query<{ slug: string }>(
    `update mach_articles
     set page_title = $2, h1 = $3, body = $4
     where slug = $1
     returning slug`,
    [slug, pageTitle, h1, body],
  );
  return rows[0] ? null : "That article is not there.";
}

/** Live on insert. No draft. The slug is fixed after this. */
export async function createArticle(
  slug: string,
  pageTitle: string,
  h1: string,
  body: string,
): Promise<string | null> {
  const fields = articleFieldsError(pageTitle, h1, body);
  if (fields) return fields;
  const sql = await getSql();
  const found = await sql.query<{ slug: string }>(
    "select slug from mach_articles where slug = $1",
    [slug],
  );
  const slugError = articleSlugError(slug, found.length > 0);
  if (slugError) return slugError;
  const rows = await sql.query<{ slug: string }>(
    `insert into mach_articles (slug, page_title, h1, body)
     values ($1, $2, $3, $4)
     on conflict (slug) do nothing
     returning slug`,
    [slug, pageTitle, h1, body],
  );
  return rows[0] ? null : "That slug is already used.";
}
