-- Wishlist / saved looks feature
-- Run this in the Supabase SQL editor

-- Table for saving looks (photos)
create table if not exists public.saved_looks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, photo_id)
);

-- Indexes
create index if not exists saved_looks_user_id_idx on public.saved_looks(user_id);
create index if not exists saved_looks_photo_id_idx on public.saved_looks(photo_id);

-- RLS
alter table public.saved_looks enable row level security;

create policy "Users can view their own saved looks"
  on public.saved_looks for select
  using (auth.uid() = user_id);

create policy "Users can save looks"
  on public.saved_looks for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave looks"
  on public.saved_looks for delete
  using (auth.uid() = user_id);
