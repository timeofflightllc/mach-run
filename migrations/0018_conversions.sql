-- One row per browser. Counts only. No name, no email, no plan numbers.

create table if not exists mach_visitors (
  id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  quiz_finished_at timestamptz,
  retired_pay_at timestamptz,
  demo_at timestamptz,
  user_id text
);
