create table if not exists mach_plans (
  user_id text primary key,
  plan_json jsonb not null,
  updated_at timestamptz not null default now()
);
