-- Pin onto an existing list. A fresh table is seeded from code, newest first.
insert into mach_announcements (id, at, title, blurb, sort_order)
select
  'feat-2026-09-23-walk',
  '2026-09-23',
  'One step at a time',
  'The MACH RUN walks Family, Accounts, Income, Spending, and Contributions in order. The as-of date starts today. The next paycheck can begin the day after the one before it ends.',
  coalesce((select max(sort_order) from mach_announcements), 0) + 1
where exists (select 1 from mach_announcements)
  and not exists (
    select 1 from mach_announcements where id = 'feat-2026-09-23-walk'
  );

insert into mach_announcements (id, at, title, blurb, sort_order)
select
  'feat-2026-09-23-next',
  '2026-09-23',
  'Next clears a stale MACH RUN',
  'Change an input and press Next. Act waits on the un-run screen until you Execute again. Back and the phase tabs leave the last run alone.',
  coalesce((select max(sort_order) from mach_announcements), 0) + 1
where exists (select 1 from mach_announcements)
  and not exists (
    select 1 from mach_announcements where id = 'feat-2026-09-23-next'
  );

insert into mach_announcements (id, at, title, blurb, sort_order)
select
  'feat-2026-09-23-footer',
  '2026-09-23',
  'One short footer, except on Act',
  'About, Method, Pricing, FAQ, Updates, and Contact share the short MACH footer: page links, Measure through Harvest, then Privacy and Legal above the copyright. Act keeps the full legal footer.',
  coalesce((select max(sort_order) from mach_announcements), 0) + 1
where exists (select 1 from mach_announcements)
  and not exists (
    select 1 from mach_announcements where id = 'feat-2026-09-23-footer'
  );
