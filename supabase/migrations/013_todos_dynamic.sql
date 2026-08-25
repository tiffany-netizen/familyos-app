-- Dynamic to-dos: due dates, person links, AI categorization and next
-- steps, snoozing. Run in BOTH Supabase projects (prod + test).

alter table public.todos
  add column if not exists due_date date,
  add column if not exists person_id uuid references public.people(id) on delete set null,
  add column if not exists category text,
  add column if not exists next_step text,
  add column if not exists snoozed_until date;

notify pgrst, 'reload schema';
