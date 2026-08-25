-- Phone numbers for the sitter brief: the user's own and anyone in people.
alter table public.profiles add column if not exists phone text;
alter table public.people add column if not exists phone text;
