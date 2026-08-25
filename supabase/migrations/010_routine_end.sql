-- Season-bounded routines: an activity can end (baseball season wraps).
alter table public.routines add column if not exists end_date date;
-- Kids' schools get a real address (picked from map search), used for
-- school-run calendar events.
alter table public.people add column if not exists school_address text;
