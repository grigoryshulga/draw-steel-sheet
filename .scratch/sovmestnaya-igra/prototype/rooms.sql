\set ON_ERROR_STOP on
insert into public.characters(user_id,id,name,document) values
 ('00000000-0000-0000-0000-000000000002','same','player','{"owner":"player"}'),
 ('00000000-0000-0000-0000-000000000003','same','stranger','{"owner":"stranger"}');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.room_create('Стол') as room_id \gset
select public.room_invite(:'room_id') as invitation \gset
select set_config('test.room', :'room_id', false);
select set_config('test.invitation', :'invitation', false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.room_join(:'invitation');
select public.room_join(:'invitation');
select public.room_share_character(:'room_id', 'same');
do $$ begin
  if (select count(*) from public.room_list()) <> 1 then raise exception 'room list failed'; end if;
  if (select count(*) from public.characters) <> 1 then raise exception 'original character policy changed'; end if;
  begin perform * from public.room_shared_characters(current_setting('test.room')::uuid); raise exception 'player saw all characters';
  exception when raise_exception then if sqlerrm <> 'Room not available' then raise; end if; end;
  begin perform * from public.room_invitations; raise exception 'player saw invitation';
  exception when insufficient_privilege then null; end;
  begin perform public.room_invite(current_setting('test.room')::uuid); raise exception 'player created invitation';
  exception when raise_exception then if sqlerrm <> 'Room not available' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
  begin perform public.room_share_character(current_setting('test.room')::uuid, 'same'); raise exception 'outsider shared character';
  exception when raise_exception then if sqlerrm <> 'Character or room not available' then raise; end if; end;
  begin perform * from public.room_shared_characters(current_setting('test.room')::uuid); raise exception 'outsider saw characters';
  exception when raise_exception then if sqlerrm <> 'Room not available' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin
  if (select count(*) from public.room_shared_characters(current_setting('test.room')::uuid)) <> 1 then raise exception 'shared count'; end if;
  if (select document->>'owner' from public.room_shared_characters(current_setting('test.room')::uuid)) <> 'player' then raise exception 'wrong owner'; end if;
  begin perform public.room_unshare_character(current_setting('test.room')::uuid, 'same'); raise exception 'owner unshared player character';
  exception when raise_exception then if sqlerrm <> 'Character or room not available' then raise; end if; end;
end $$;
select public.room_revoke_invite(:'invitation');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
  begin perform public.room_join(current_setting('test.invitation')::uuid); raise exception 'revoked invitation accepted';
  exception when raise_exception then if sqlerrm <> 'Invitation not available' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.room_leave(:'room_id');
do $$ begin
  if exists (select 1 from public.room_list()) then raise exception 'left player still member'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin
  if exists (select 1 from public.room_shared_characters(current_setting('test.room')::uuid)) then raise exception 'left player still visible'; end if;
end $$;
reset role;
