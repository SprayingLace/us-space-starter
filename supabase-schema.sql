-- Starter schema only. Review and adapt before production.
-- Enable RLS and policies before using any table from a client.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.bucket_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null check (length(title) between 1 and 300),
  is_done boolean not null default false,
  image_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.envelopes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  title text not null,
  body text not null,
  unlock_at timestamptz,
  manually_unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  check (unlock_at is not null or manually_unlocked_at is not null)
);

create table if not exists public.daily_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  prompt text not null,
  question_date date not null,
  created_at timestamptz not null default now(),
  unique(room_id, question_date)
);

create table if not exists public.daily_answers (
  question_id uuid not null references public.daily_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer_ciphertext text not null,
  submitted_at timestamptz not null default now(),
  primary key (question_id, user_id)
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  event_date timestamptz,
  notes text,
  latitude double precision,
  longitude double precision,
  media_path text,
  created_at timestamptz not null default now()
);

-- Important: do not enable public read/write policies for these tables.
-- Add policies that verify auth.uid() is a member of the referenced room.
-- For daily_answers, do not expose answer content to the other member until both
-- participants have submitted. Prefer a server-side RPC that returns both answers
-- only when the submission count is 2; do not rely on hiding fields in React.
