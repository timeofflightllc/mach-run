-- Points on the next bill. 10 points = $1. An existing dollar setting converts once.
-- credit_dollars stays. Rows that already have credit_cents are not rewritten.

alter table mach_referral_settings
  add column if not exists credit_points integer;

update mach_referral_settings
set credit_points = credit_dollars * 10
where credit_points is null
  and credit_dollars is not null;
