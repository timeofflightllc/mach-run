-- Beta debrief invites and answers. Access is by email. One draft per user.
-- Submitted rows are not unique. No page in this step.

create table if not exists mach_beta_access (
  email text primary key check (email = lower(email)),
  granted_at timestamptz not null default now(),
  granted_by text,
  submission_limit integer not null default 3 check (submission_limit >= 0)
);

create table if not exists mach_beta_responses (
  id text primary key,
  user_id text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create unique index if not exists mach_beta_responses_one_draft
  on mach_beta_responses (user_id)
  where status = 'draft';

create index if not exists mach_beta_responses_user_idx
  on mach_beta_responses (user_id, submitted_at desc);
