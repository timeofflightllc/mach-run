-- Referral links. A personal code is one per user. A campaign code is tracking only.
-- A signup row is written when a new account is created. No billing in this step.

create table if not exists mach_referral_codes (
  code text primary key,
  owner_user_id text not null,
  kind text not null check (kind in ('personal', 'campaign')),
  name text,
  created_at timestamptz not null default now()
);

create unique index if not exists mach_referral_codes_one_personal
  on mach_referral_codes (owner_user_id)
  where kind = 'personal';

create table if not exists mach_referral_signups (
  id text primary key,
  code text not null references mach_referral_codes (code),
  new_user_id text not null unique,
  new_email text not null,
  status text not null default 'signed-up',
  created_at timestamptz not null default now()
);

create index if not exists mach_referral_signups_code_idx
  on mach_referral_signups (code);
