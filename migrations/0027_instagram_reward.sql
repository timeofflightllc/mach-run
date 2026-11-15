-- One Instagram code per member. The code never changes. A direct message
-- is what pays, and this table does not grant points.

create table if not exists mach_reward_instagram_codes (
  user_id text primary key,
  code text not null unique,
  created_at timestamptz not null default now()
);
