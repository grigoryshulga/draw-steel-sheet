create table if not exists public.characters (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 80),
  name text not null default 'Без имени',
  class_name text not null default '',
  ancestry text not null default '',
  level integer not null default 1 check (level between 1 and 10),
  document jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.characters enable row level security;

revoke all on public.characters from anon;
grant select, insert, update, delete on public.characters to authenticated;

create policy "Users can read their own characters"
  on public.characters for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own characters"
  on public.characters for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own characters"
  on public.characters for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own characters"
  on public.characters for delete to authenticated
  using ((select auth.uid()) = user_id);
