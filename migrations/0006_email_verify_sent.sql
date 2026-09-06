alter table email_verify_codes add column if not exists emailed_at timestamptz;
