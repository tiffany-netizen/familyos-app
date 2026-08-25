-- Persistent multi-step plans (date night first). A plan stays open,
-- remembers which steps became to-dos, and shows progress until the
-- user starts over. Run in BOTH Supabase projects (prod + test).

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'date_night',
  items jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
alter table public.plans enable row level security;
do $$ begin
  create policy "own rows" on public.plans
    for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;
notify pgrst, 'reload schema';
