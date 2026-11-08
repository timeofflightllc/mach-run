-- Optional subtitle under the article H1. Blank means the page shows no line.
-- This sets the pension article only, and only when it is still blank,
-- so a later Top 3 edit is left alone.

alter table mach_articles
  add column if not exists subtitle text not null default '';

update mach_articles
set subtitle = 'An O-5''s 20-year pension is worth about $2.35 million today. Most FIRE math never writes that number down.'
where slug = 'military-pension-present-value'
  and subtitle = '';
