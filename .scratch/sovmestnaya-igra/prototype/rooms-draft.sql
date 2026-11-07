-- DRAFT: do not deploy. room_shared_characters currently returns complete
-- documents, which conflicts with the player's choice of visible sections.
-- Room access is exposed only through the functions below. Characters retain
-- their existing owner-only RLS policies and composite identity.
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create table public.room_invitations (
  token uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create table public.room_characters (
  room_id uuid not null,
  user_id uuid not null,
  character_id text not null,
  primary key (room_id, user_id, character_id),
  foreign key (room_id, user_id) references public.room_members(room_id, user_id) on delete cascade,
  foreign key (user_id, character_id) references public.characters(user_id, id) on delete cascade
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_invitations enable row level security;
alter table public.room_characters enable row level security;
revoke all on public.rooms, public.room_members, public.room_invitations, public.room_characters from public, anon, authenticated;

create function public.room_create(room_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); result uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  insert into public.rooms(owner_id, name) values (uid, btrim(room_name)) returning id into result;
  insert into public.room_members(room_id, user_id) values (result, uid);
  return result;
end $$;

create function public.room_invite(target_room uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.rooms where id = target_room and owner_id = auth.uid()) then
    raise exception 'Room not available';
  end if;
  insert into public.room_invitations(room_id, expires_at) values (target_room, now() + interval '7 days') returning token into result;
  return result;
end $$;

create function public.room_revoke_invite(invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.room_invitations i set revoked_at = now()
  where i.token = invitation and exists (select 1 from public.rooms r where r.id = i.room_id and r.owner_id = auth.uid());
  if not found then raise exception 'Invitation not available'; end if;
end $$;

create function public.room_join(invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select room_id into target from public.room_invitations where token = invitation and revoked_at is null and expires_at > now() for share;
  if target is null then raise exception 'Invitation not available'; end if;
  insert into public.room_members(room_id, user_id) values (target, uid) on conflict do nothing;
  return target;
end $$;

create function public.room_leave(target_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or exists (select 1 from public.rooms where id = target_room and owner_id = auth.uid()) then
    raise exception 'Room not available';
  end if;
  delete from public.room_members where room_id = target_room and user_id = auth.uid();
  if not found then raise exception 'Room not available'; end if;
end $$;

create function public.room_share_character(target_room uuid, target_character text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.room_members where room_id = target_room and user_id = auth.uid())
    or not exists (select 1 from public.characters where user_id = auth.uid() and id = target_character) then
    raise exception 'Character or room not available';
  end if;
  insert into public.room_characters(room_id, user_id, character_id) values (target_room, auth.uid(), target_character) on conflict do nothing;
end $$;

create function public.room_unshare_character(target_room uuid, target_character text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.room_characters where room_id = target_room and user_id = auth.uid() and character_id = target_character;
  if not found then raise exception 'Character or room not available'; end if;
end $$;

create function public.room_list() returns table(id uuid, name text, owner_id uuid, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.name, r.owner_id, r.created_at from public.rooms r
  join public.room_members m on m.room_id = r.id
  where m.user_id = auth.uid() order by r.created_at desc;
$$;

create function public.room_shared_characters(target_room uuid)
returns table(user_id uuid, character_id text, document jsonb, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.rooms where id = target_room and owner_id = auth.uid()) then
    raise exception 'Room not available';
  end if;
  return query select c.user_id, c.id, c.document, c.updated_at
  from public.room_characters s join public.characters c on c.user_id = s.user_id and c.id = s.character_id
  where s.room_id = target_room order by c.updated_at desc;
end $$;

revoke all on function public.room_create(text), public.room_invite(uuid), public.room_revoke_invite(uuid), public.room_join(uuid), public.room_leave(uuid), public.room_share_character(uuid,text), public.room_unshare_character(uuid,text), public.room_list(), public.room_shared_characters(uuid) from public, anon;
grant execute on function public.room_create(text), public.room_invite(uuid), public.room_revoke_invite(uuid), public.room_join(uuid), public.room_leave(uuid), public.room_share_character(uuid,text), public.room_unshare_character(uuid,text), public.room_list(), public.room_shared_characters(uuid) to authenticated;
