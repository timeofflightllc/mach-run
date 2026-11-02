-- Campaign click-throughs. A personal link does not write a row here.

create table if not exists mach_referral_clicks (
  code text primary key references mach_referral_codes (code),
  clicks integer not null default 0
);
