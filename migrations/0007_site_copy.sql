create table if not exists mach_site_pages (
  slug text primary key,
  title text not null,
  kicker text,
  body text not null,
  updated_at timestamptz not null default now()
);

create table if not exists mach_announcements (
  id text primary key,
  at text not null,
  title text not null,
  blurb text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists mach_announcements_sort_idx
  on mach_announcements (sort_order desc, created_at desc);
