update mach_site_pages
set title = 'Updates', updated_at = now()
where slug = 'announcements' and title = 'Feature announcements';

update mach_site_pages
set
  body = replace(body, '[Features](/announcements)', '[Updates](/announcements)'),
  updated_at = now()
where body like '%[Features](/announcements)%';

update mach_announcements
set blurb = replace(blurb, 'Features', 'Updates')
where id = 'feat-2026-09-23-footer'
  and blurb like '%Features%';
