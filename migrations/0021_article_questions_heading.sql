-- Rename the pension FAQ heading. Only that exact line. The rest of a Top 3 edit stays.

update mach_articles
set body = replace(
  body,
  '## Questions',
  '## Common questions about military retirement pay and calculations'
)
where body like '%## Questions%';
