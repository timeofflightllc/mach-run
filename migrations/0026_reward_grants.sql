-- Mach Rewards is the only points balance. A grant is earned. A redemption is applied.
-- Ten points is one dollar. A credit Stripe already paid is not granted again.

create table if not exists mach_reward_grants (
  id text primary key,
  user_id text not null,
  source text not null,
  source_id text not null,
  points integer not null check (points > 0),
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists mach_reward_grants_user_idx
  on mach_reward_grants (user_id, created_at desc);

create table if not exists mach_reward_redemptions (
  id text primary key,
  user_id text not null,
  points integer not null check (points > 0),
  cents integer not null check (cents > 0),
  created_at timestamptz not null default now()
);

create index if not exists mach_reward_redemptions_user_idx
  on mach_reward_redemptions (user_id, created_at desc);

-- Held personal referral points become a grant. A posted Stripe credit does not.
insert into mach_reward_grants (id, user_id, source, source_id, points, created_at)
select
  'referral-' || s.id,
  c.owner_user_id,
  'referral',
  s.id,
  s.credit_cents / 10,
  coalesce(s.created_at, now())
from mach_referral_signups s
join mach_referral_codes c on c.code = s.code
where c.kind = 'personal'
  and s.credit_cents >= 10
  and s.credit_posted_at is null
on conflict (source, source_id) do nothing;

-- The first three submitted debriefs on an account. 150 points each.
insert into mach_reward_grants (id, user_id, source, source_id, points, created_at)
select
  'beta-' || ranked.id,
  ranked.user_id,
  'beta',
  ranked.id,
  150,
  coalesce(ranked.submitted_at, now())
from (
  select
    r.id,
    r.user_id,
    r.submitted_at,
    row_number() over (
      partition by r.user_id
      order by r.submitted_at asc nulls last, r.id asc
    ) as n
  from mach_beta_responses r
  where r.status = 'submitted'
) ranked
where ranked.n <= 3
on conflict (source, source_id) do nothing;
