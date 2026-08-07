-- FamilyOS v1 schema
-- Built from Jamie's Adalo data model (Person as the hub) plus v1 plan additions.

-- Profiles: one row per signed-up user, extends Supabase auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  onboarded boolean not null default false,
  date_night_frequency_days int default 14,
  wants_gift_lists boolean default true,
  brief_email boolean not null default true,
  created_at timestamptz not null default now()
);

-- People: the hub. Spouse, kids, parents, friends, pets.
create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  relationship text not null, -- spouse, child, parent, friend, pet, other
  birthday date,
  gender text,
  grade text,                 -- kids
  school text,
  teacher_name text,          -- kids (from Adalo Teacher)
  best_friend text,
  clothing_size text,
  shoe_size text,
  ring_size text,             -- from Adalo Person
  hair_color text,            -- from the Slack thread
  favorite_wine text,
  favorite_flowers text,
  favorite_toys text,
  allergies text,
  interests text,
  breed text,                 -- pets
  vet_info text,              -- pets
  last_contact date,          -- powers "12 days since you called"
  created_at timestamptz not null default now()
);

-- Dates: birthdays live on people; this holds anniversaries, custom dates, holidays being tracked
create table public.tracked_dates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  label text not null,           -- "Anniversary", "First date", "Mother's Day"
  date_value date not null,
  recurs_yearly boolean not null default true,
  lead_time_days int not null default 30,
  created_at timestamptz not null default now()
);

-- Memories: the AI-filed notes ("Sarah misses Napa wine trips")
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  body text not null,
  category text not null default 'memory', -- memory, gift_idea, interest, plan
  source text not null default 'note',     -- note, voice, weekly_checkin
  surfaced boolean not null default false,
  created_at timestamptz not null default now()
);

-- Gift ideas (a memory can also create one of these)
create table public.gift_ideas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  title text not null,
  detail text,
  url text,                       -- Amazon share sheet lands here later
  status text not null default 'idea',  -- idea, purchased, given
  created_at timestamptz not null default now()
);

-- Bucket list (from Adalo)
create table public.bucket_list_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  title text not null,
  detail text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- Sports schedules (from Adalo; AI schedule upload fills this later)
create table public.sports_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  sport text,
  team text,
  event_date timestamptz not null,
  location text,
  created_at timestamptz not null default now()
);

-- Home maintenance (from Adalo, with frequency in days)
create table public.home_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  task_name text not null,
  last_performed date,
  frequency_days int not null default 90,
  notes text,
  created_at timestamptz not null default now()
);

-- Service providers (gardener, mechanic, CPA), cars and registrations
create table public.service_providers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null,             -- gardener, cleaner, mechanic, cpa, other
  contact_info text,
  schedule_note text,             -- "every other Friday"
  next_visit date,
  remind_day_before boolean not null default true,
  satisfaction text,
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,             -- "Sarah's SUV"
  registration_renewal date,
  last_oil_change date,
  oil_change_interval_miles int,
  created_at timestamptz not null default now()
);

-- Call logs: powers call-from-app and We Talked
create table public.contact_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  method text not null default 'call',   -- call, we_talked, text
  logged_at timestamptz not null default now()
);

-- Row level security: every table locked to its owner
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array['people','tracked_dates','memories','gift_ideas','bucket_list_items','sports_events','home_items','service_providers','vehicles','contact_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id)', t);
  end loop;
end $$;

-- Auto-create a profile row on signup
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
