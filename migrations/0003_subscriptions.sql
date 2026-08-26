create table if not exists mach_subscriptions (
  user_id text primary key,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none',
  price_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists mach_subscriptions_customer_idx
  on mach_subscriptions (stripe_customer_id);
