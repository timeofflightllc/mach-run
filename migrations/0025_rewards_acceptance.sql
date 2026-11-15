-- One Mach Rewards acceptance per user. A new terms version replaces this row.
-- A click that never finishes does not write a row.

create table if not exists mach_rewards_acceptance (
  user_id text primary key,
  terms_version text not null,
  accepted_at timestamptz not null default now()
);
