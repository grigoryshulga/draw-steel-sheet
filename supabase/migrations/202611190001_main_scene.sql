-- Keep the main scene's layout while a different scene is shown on the board.
begin;

create function table_backend.board_switch_layout(b jsonb, scene_id text, layout jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
declare keys text[]=array['background','grid','materials','strokes'];
 defaults jsonb='{"background":null,"grid":{"enabled":false,"size":80,"x":0,"y":0},"materials":[]}';
begin
 if b->>'sceneId' is not distinct from scene_id then return b; end if;
 if scene_id is null then
  return (b-'sceneId'-'strokes'-'mainLayout') || defaults || table_backend.pick(b->'mainLayout',keys);
 end if;
 if not (b ? 'sceneId') then
  b=b || jsonb_build_object('mainLayout',table_backend.pick(b,keys));
 end if;
 return (b-'strokes') || defaults || table_backend.pick(layout,keys) || jsonb_build_object('sceneId',scene_id);
end $$;

create or replace function table_backend.scene_uses_asset(t table_backend.tables, asset text) returns boolean
language sql stable set search_path = pg_catalog as $$
 select table_backend.board_uses_asset(t.board,asset)
   or coalesce(table_backend.board_uses_asset(t.board->'mainLayout',asset),false)
   or exists(select from jsonb_array_elements(t.scenes) s where table_backend.board_uses_asset(s->'layout',asset))
   or exists(select from table_backend.templates p
     where p.document#>>'{scene,layout,tableId}'=t.id
       and table_backend.board_uses_asset(p.document#>'{scene,layout}',asset))
$$;

create or replace function table_backend.guard_scene_layout() returns trigger
language plpgsql set search_path = pg_catalog as $$
declare s jsonb;
begin
 for s in select value from jsonb_array_elements(new.scenes) loop
  if s ? 'layout' and not exists(select from jsonb_array_elements(old.scenes) old_scene
    where old_scene->'id'=s->'id' and old_scene->'layout'=s->'layout') then
   perform table_backend.check_layout_assets(new.id,s->'layout');
  end if;
 end loop;
 if new.board ? 'sceneId' and not exists(
  select from jsonb_array_elements(new.scenes) current_scene
   where current_scene->'id'=new.board->'sceneId' and current_scene->'published'='true' and current_scene->>'status'<>'prepared'
 ) then
  new.board=table_backend.board_switch_layout(new.board,null,null);
 end if;
 return new;
end $$;
create or replace function public.table_command(p_table_id text, p_command jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
 p jsonb=p_command->'payload'; kind text=p_command->>'type'; actor uuid; op text=p_command->>'operationId'; original jsonb;
 cached table_backend.operations; t table_backend.tables; selected jsonb; next_board jsonb; result jsonb; strokes jsonb; new_stroke jsonb;
begin
 if kind is null or kind not in ('board-start-scene','board-grid','board-draw','board-undo-stroke') then
  result=table_backend.table_command_before_workspace(p_table_id,p_command);
  if result is null then return null; end if;
  return public.table_read(result->>'id');
 end if;
 actor=table_backend.actor();
 perform table_backend.require(jsonb_typeof(p_command)='object' and table_backend.ident(p_command->'operationId')
   and jsonb_typeof(p)='object' and octet_length(p_command::text)<=2097152);
 original=jsonb_build_object('tableId',p_table_id,'command',p_command);
 perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || op,0));
 select * into cached from table_backend.operations where user_id=actor and operation_id=op;
 if found then
  if cached.input<>original then raise exception using errcode='PT409',message='Идентификатор операции уже использован'; end if;
  if not exists(select from table_backend.tables where id=cached.result_table_id) then return null; end if;
  return public.table_read(cached.result_table_id);
 end if;
 perform table_backend.require(table_backend.ident(to_jsonb(p_table_id)) and table_backend.num(p_command->'expectedRevision',1));
 select * into t from table_backend.tables where id=p_table_id for update;
 if not found or not table_backend.is_member(t.id) then raise exception using errcode='PT404',message='Стол не найден'; end if;
 if t.owner_id<>actor then raise exception using errcode='42501',message='Действие доступно ведущему'; end if;
 if t.archived then raise exception using errcode='PT409',message='Стол в архиве'; end if;
 if t.revision<>(p_command->>'expectedRevision')::bigint then raise exception using errcode='PT409',message='Конфликт версии стола. Обновите данные'; end if;
 if kind='board-grid' then
  update table_backend.tables set board=jsonb_set(board,'{grid}',table_backend.board_grid(p)) where id=t.id;
 elsif kind in ('board-draw','board-undo-stroke') then
  perform table_backend.require(p->'sceneId'=coalesce(t.board->'sceneId','null'::jsonb));
  strokes=coalesce(t.board->'strokes','[]');
  if kind='board-draw' then
   new_stroke=table_backend.board_stroke(p->'stroke');
   perform table_backend.require(jsonb_array_length(strokes)<128 and not exists(
     select from jsonb_array_elements(strokes) mark where mark->'id'=new_stroke->'id'));
   strokes=strokes || jsonb_build_array(new_stroke);
  else
   perform table_backend.require(table_backend.ident(p->'id') and strokes#>'{-1,id}'=p->'id');
   strokes=strokes-(-1);
  end if;
  update table_backend.tables set board=jsonb_set(board,'{strokes}',strokes) where id=t.id;
 elsif p->'sceneId'='null' and not (p ? 'scene') then
  update table_backend.tables set board=table_backend.board_switch_layout(t.board,null,null) where id=t.id;
 else
 if p ? 'scene' then
  selected=table_backend.scene(p->'scene');
  perform table_backend.require(not exists(select from jsonb_array_elements(t.scenes) s where s->'id'=selected->'id'));
  t.scenes=t.scenes || jsonb_build_array(selected);
 else
  perform table_backend.require(table_backend.ident(p->'sceneId'));
  select s into selected from jsonb_array_elements(t.scenes) s where s->'id'=p->'sceneId';
  if not found then raise exception using errcode='PT404',message='Сцена не найдена'; end if;
 end if;
 selected=selected || '{"status":"active","published":true}';
 next_board=table_backend.board_switch_layout(t.board,selected->>'id',selected->'layout');
 update table_backend.tables set board=next_board,scenes=(
   select jsonb_agg(case when s->'id'=selected->'id' then selected else s end order by position)
   from jsonb_array_elements(t.scenes) with ordinality entries(s,position)
 ) where id=t.id;
 end if;
 perform table_backend.touch(t.id);
 insert into table_backend.operations values(actor,op,original,t.id);
 return public.table_read(t.id);
end $$;

revoke all on function table_backend.board_switch_layout(jsonb,text,jsonb) from public, anon, authenticated;
commit;
