-- Recipe box + shopping list. Run on the TEST database (familyos-test)
-- and PROD before merging code that uses it.

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  url text,
  ingredients jsonb not null default '[]',   -- array of strings
  instructions jsonb not null default '[]',  -- array of strings
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  name text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists grocery_store text;

do $$
declare t text;
begin
  foreach t in array array['recipes','shopping_items']
  loop
    execute format('alter table public.%I enable row level security', t);
    begin
      execute format('create policy "own rows" on public.%I for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id)', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
