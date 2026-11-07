-- Articles edited from Top 3. The pension article is seeded once in
-- src/lib/articles/server.ts, behind a flag, so a later edit is not overwritten.

create table if not exists mach_articles (
  slug text primary key,
  page_title text not null,
  h1 text not null,
  body text not null,
  created_at timestamptz not null default now()
);
