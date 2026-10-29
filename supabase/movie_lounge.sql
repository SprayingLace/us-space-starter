-- Run this file in Supabase SQL Editor for the Us Space Movie Lounge.
-- Playback state is shared by room members; videos are embedded from YouTube.

create table if not exists public.movie_lounge_sessions (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  video_id text null check (video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$'),
  current_time double precision not null default 0 check (current_time >= 0),
  is_playing boolean not null default false,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.movie_lounge_sessions enable row level security;

grant select, insert, update on public.movie_lounge_sessions to authenticated;

drop policy if exists "Room members can read movie lounge sessions" on public.movie_lounge_sessions;
create policy "Room members can read movie lounge sessions"
on public.movie_lounge_sessions
for select to authenticated
using (
  exists (
    select 1
    from public.room_members rm
    where rm.room_id = movie_lounge_sessions.room_id
      and rm.user_id = (select auth.uid())
  )
);

drop policy if exists "Room members can create movie lounge sessions" on public.movie_lounge_sessions;
create policy "Room members can create movie lounge sessions"
on public.movie_lounge_sessions
for insert to authenticated
with check (
  exists (
    select 1
    from public.room_members rm
    where rm.room_id = movie_lounge_sessions.room_id
      and rm.user_id = (select auth.uid())
  )
);

drop policy if exists "Room members can update movie lounge sessions" on public.movie_lounge_sessions;
create policy "Room members can update movie lounge sessions"
on public.movie_lounge_sessions
for update to authenticated
using (
  exists (
    select 1
    from public.room_members rm
    where rm.room_id = movie_lounge_sessions.room_id
      and rm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.room_members rm
    where rm.room_id = movie_lounge_sessions.room_id
      and rm.user_id = (select auth.uid())
  )
);

-- Enable Postgres Changes for the shared session table, without failing if it is already enabled.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'movie_lounge_sessions'
  ) then
    alter publication supabase_realtime add table public.movie_lounge_sessions;
  end if;
end
$$;
