create table if not exists public.date_rooms (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.date_rooms enable row level security;

drop policy if exists "date_rooms_select_all" on public.date_rooms;
drop policy if exists "date_rooms_insert_all" on public.date_rooms;
drop policy if exists "date_rooms_update_all" on public.date_rooms;

create policy "date_rooms_select_all"
on public.date_rooms for select
using (true);

create policy "date_rooms_insert_all"
on public.date_rooms for insert
with check (true);

create policy "date_rooms_update_all"
on public.date_rooms for update
using (true)
with check (true);
