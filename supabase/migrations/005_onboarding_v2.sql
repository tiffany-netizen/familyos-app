-- Onboarding v2: safety questions, meal rules, home ownership, and the
-- brief's delivery time. Run on the TEST database first (familyos-test),
-- then on PROD before merging dev into main.

alter table public.profiles add column if not exists brief_time text default '07:00';
alter table public.profiles add column if not exists owns_home boolean;
alter table public.profiles add column if not exists meal_notes text;

alter table public.people add column if not exists dismissal_time text;
alter table public.people add column if not exists pediatrician text;
