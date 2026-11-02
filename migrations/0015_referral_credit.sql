-- Whole-dollar credit for a future yearly friend. The amount on a signup row
-- is the amount that was granted. Changing the setting does not rewrite it.

create table if not exists mach_referral_settings (
  id integer primary key,
  credit_dollars integer not null default 20
);

insert into mach_referral_settings (id, credit_dollars)
values (1, 20)
on conflict (id) do nothing;

alter table mach_referral_signups
  add column if not exists credit_cents integer,
  add column if not exists credit_posted_at timestamptz;
