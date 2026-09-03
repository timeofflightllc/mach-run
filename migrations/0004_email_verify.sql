-- One active 6-digit email-verify code per user. Hash only; plaintext lives
-- in the welcome email and is never stored.
create table if not exists email_verify_codes (
  user_id text primary key references "user" ("id") on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);
