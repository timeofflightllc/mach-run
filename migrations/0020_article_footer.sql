-- The article template now carries the author line and the disclaimer.
-- Drop that closer from any article that still ends with it, so it does not show twice.
-- A Top 3 edit of the rest of the body is left alone.

update mach_articles
set body = regexp_replace(
  body,
  E'[[:space:]]+MACH RUN is a household calculator\\. The figures on this page are estimates for information and education\\. They are not a DFAS or VA determination, not a forecast, and not financial, tax, or investment advice\\. Confirm the figures with DFAS and the VA, and talk to a fiduciary before acting on a plan\\.[[:space:]]*$',
  ''
)
where body like '%MACH RUN is a household calculator. The figures on this page are estimates%';
