-- The user's standing orders for their daily brief, in their own words.
alter table public.profiles add column if not exists brief_notes text;
