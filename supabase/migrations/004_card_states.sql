-- Batch 1: snooze / "all under control" for brief cards.
create table if not exists public.card_states (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  card_key text not null,
  status text not null default 'snoozed', -- snoozed, dismissed
  until date,
  created_at timestamptz not null default now(),
  unique (owner_id, card_key)
);

alter table public.card_states enable row level security;
do $$ begin
  create policy "own rows" on public.card_states
    for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

-- Tester feedback capture (sandbox and beyond).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  page text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
do $$ begin
  create policy "own rows" on public.feedback
    for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;
