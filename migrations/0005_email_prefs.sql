-- Optional product-email opt-in. Missing row = opted in.
create table if not exists mach_email_prefs (
  user_id text primary key,
  optional_ok boolean not null default true,
  updated_at timestamptz not null default now()
);
