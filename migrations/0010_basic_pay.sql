create table if not exists mach_basic_pay (
  year integer primary key,
  rates jsonb not null,
  updated_at timestamptz not null default now()
);
