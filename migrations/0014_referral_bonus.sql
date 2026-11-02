-- The renewal date granted by a personal yearly invite. A later plan change
-- must not move the subscription earlier than this.

alter table mach_referral_signups
  add column if not exists bonus_until timestamptz;
