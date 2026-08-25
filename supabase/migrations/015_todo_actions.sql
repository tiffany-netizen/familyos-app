-- To-dos carry one executable action: a text link, calendar block,
-- reservation search, local-business search, or in-app link. Run in
-- BOTH Supabase projects (prod + test).

alter table public.todos
  add column if not exists action_kind text,
  add column if not exists action_payload jsonb;

notify pgrst, 'reload schema';
