-- Persist the Director's drawing layer in the same revision as the scene.
begin;

create function table_backend.board_stroke(v jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
begin
 perform table_backend.require(jsonb_typeof(v)='object' and table_backend.ident(v->'id')
   and jsonb_typeof(v->'color')='string' and v->>'color' ~* '^#[a-f0-9]{6}$'
   and table_backend.num(v->'thickness',1) and table_backend.board_range(v->'thickness',1,32)
   and jsonb_typeof(v->'points')='array');
 perform table_backend.require(jsonb_array_length(v->'points') between 1 and 384);
 perform table_backend.require(not exists(select from jsonb_array_elements(v->'points') point
   where case when jsonb_typeof(point)='array' then
     jsonb_array_length(point)<>2 or not (table_backend.num(point->0) and table_backend.board_range(point->0,0,1600)
       and table_backend.num(point->1) and table_backend.board_range(point->1,0,900))
   else true end));
 return table_backend.pick(v,array['id','color','thickness','points']);
end $$;

alter function table_backend.scene_layout(jsonb) rename to scene_layout_before_drawing;
create function table_backend.scene_layout(v jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
declare layout jsonb=table_backend.scene_layout_before_drawing(v); strokes jsonb; stroke jsonb; marks jsonb='[]'; ids text[]='{}';
begin
 if not (v ? 'strokes') then return layout; end if;
 strokes=v->'strokes';
 perform table_backend.require(jsonb_typeof(strokes)='array');
 perform table_backend.require(jsonb_array_length(strokes)<=128);
 for stroke in select table_backend.board_stroke(value) from jsonb_array_elements(strokes) loop
  perform table_backend.require(not (stroke->>'id'=any(ids)));
  ids=array_append(ids,stroke->>'id');
  marks=marks || jsonb_build_array(stroke);
 end loop;
 return layout || jsonb_build_object('strokes',marks);
end $$;

create or replace function table_backend.project_board(t table_backend.tables, director boolean) returns jsonb
language sql stable set search_path = pg_catalog as $$
 select table_backend.project_board_before_scenes(t,director) || table_backend.pick(t.board,array['sceneId']) ||
 case when jsonb_array_length(t.board->'strokes')>0 then table_backend.pick(t.board,array['strokes']) else '{}'::jsonb end
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
  new.board=(new.board-'sceneId'-'strokes') ||
    '{"background":null,"grid":{"enabled":false,"size":80,"x":0,"y":0},"materials":[]}';
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
 next_board=t.board;
 if next_board->'sceneId' is distinct from selected->'id' then
  next_board=(next_board-'strokes') || coalesce(table_backend.pick(selected->'layout',array['background','grid','materials','strokes']),
   '{}');
  if not (selected ? 'layout') then
   next_board=next_board || '{"background":null,"grid":{"enabled":false,"size":80,"x":0,"y":0},"materials":[]}';
  end if;
  next_board=next_board || jsonb_build_object('sceneId',selected->'id');
 end if;
 update table_backend.tables set board=next_board,scenes=(
   select jsonb_agg(case when s->'id'=selected->'id' then selected else s end order by position)
   from jsonb_array_elements(t.scenes) with ordinality entries(s,position)
 ) where id=t.id;
 end if;
 perform table_backend.touch(t.id);
 insert into table_backend.operations values(actor,op,original,t.id);
 return public.table_read(t.id);
end $$;

revoke all on function table_backend.board_stroke(jsonb), table_backend.scene_layout(jsonb) from public, anon, authenticated;
commit;
