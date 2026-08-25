-- "That's not just work": events the user promoted from the folded
-- work/other list into the week view. Matched by summary so a recurring
-- event promoted once stays promoted every week. Run in BOTH Supabase
-- projects (prod + test).

create table if not exists public.calendar_includes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  summary text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, summary)
);

alter table public.calendar_includes enable row level security;
do $$ begin
  create policy "own rows" on public.calendar_includes
    for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
