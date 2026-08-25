-- Batch: teacher school-year rhythm, clock format preference.
-- Run on TEST (familyos-test) and PROD before merging code that uses it.

alter table public.people add column if not exists school_year_start date;
alter table public.profiles add column if not exists time_format text default '12h';
