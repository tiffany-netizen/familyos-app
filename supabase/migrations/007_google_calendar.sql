-- Google Calendar connection: one token row per user.
-- Run on the TEST database (familyos-test) and PROD before merging.

create table if not exists public.google_tokens (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  email text,
  created_at timestamptz not null default now()
);

alter table public.google_tokens enable row level security;
do $$ begin
  create policy "own rows" on public.google_tokens
    for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;
