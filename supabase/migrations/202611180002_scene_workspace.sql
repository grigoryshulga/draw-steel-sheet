begin;

create function table_backend.board_grid(v jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
begin
 perform table_backend.require(jsonb_typeof(v->'enabled')='boolean'
   and table_backend.num(v->'size',8) and table_backend.board_range(v->'size',8,400)
   and table_backend.num(v->'x',-1600) and table_backend.board_range(v->'x',-1600,1600)
   and table_backend.num(v->'y',-900) and table_backend.board_range(v->'y',-900,900)
   and (not (v ? 'color') or jsonb_typeof(v->'color')='string' and v->>'color' ~* '^#[a-f0-9]{6}$')
   and (not (v ? 'opacity') or table_backend.num(v->'opacity') and table_backend.board_range(v->'opacity',0,100))
   and (not (v ? 'thickness') or table_backend.num(v->'thickness',1) and table_backend.board_range(v->'thickness',1,8)));
 return table_backend.pick(v,array['enabled','size','x','y','color','opacity','thickness']);
end $$;

create function table_backend.scene_layout(v jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
declare g jsonb=v->'grid'; m jsonb; pieces jsonb='[]'; ids text[]='{}';
begin
 perform table_backend.require(jsonb_typeof(v)='object' and table_backend.ident(v->'tableId')
   and (v->'background'='null' or table_backend.board_asset_id(v->'background'))
   and jsonb_typeof(v->'materials')='array');
 perform table_backend.require(jsonb_array_length(v->'materials')<=32);
 for m in select value from jsonb_array_elements(v->'materials') loop
  perform table_backend.require(table_backend.ident(m->'id') and not (m->>'id'=any(ids)) and table_backend.str(m->'title')
    and table_backend.board_range(m->'x',0,1600) and table_backend.board_range(m->'y',0,900));
  ids=array_append(ids,m->>'id');
  if m->>'kind'='image' then
   perform table_backend.require(table_backend.board_asset_id(m->'assetId'));
   pieces=pieces || jsonb_build_array(table_backend.pick(m,array['kind','id','title','x','y','assetId']));
  else
   perform table_backend.require(m->>'kind'='text' and table_backend.str(m->'text',50000)
      and (not (m ? 'markdown') or jsonb_typeof(m->'markdown')='boolean'));
   pieces=pieces || jsonb_build_array(table_backend.pick(m,array['kind','id','title','x','y','text','markdown']));
  end if;
 end loop;
 return table_backend.pick(v,array['tableId','background']) ||
   jsonb_build_object('grid',table_backend.board_grid(g),'materials',pieces);
end $$;

alter function table_backend.scene(jsonb) rename to scene_before_layout;
create function table_backend.scene(v jsonb) returns jsonb
language sql immutable set search_path = pg_catalog as $$
 select table_backend.scene_before_layout(v) ||
   case when v ? 'layout' then jsonb_build_object('layout',table_backend.scene_layout(v->'layout')) else '{}'::jsonb end
$$;

create function table_backend.scene_uses_asset(t table_backend.tables, asset text) returns boolean
language sql stable set search_path = pg_catalog as $$
 select table_backend.board_uses_asset(t.board,asset)
   or exists(select from jsonb_array_elements(t.scenes) s where table_backend.board_uses_asset(s->'layout',asset))
   or exists(select from table_backend.templates p
     where p.document#>>'{scene,layout,tableId}'=t.id
       and table_backend.board_uses_asset(p.document#>'{scene,layout}',asset))
$$;

create or replace function table_backend.board_has_asset(table_id text, asset jsonb) returns boolean
language sql stable set search_path = pg_catalog as $$
 select table_backend.board_asset_id(asset) and exists (
   select 1 from storage.objects o join table_backend.tables t on t.id=table_id
   where o.bucket_id='table-images' and o.name=table_id || '/' || (asset #>> '{}')
     and o.metadata->>'mimetype'='image/webp'
     and (o.created_at >= statement_timestamp()-interval '24 hours' or table_backend.scene_uses_asset(t,asset #>> '{}'))
 )
$$;

create or replace function table_backend.board_file_expired(object_name text, uploaded_at timestamptz) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
 select uploaded_at<statement_timestamp()-interval '48 hours'
   and table_backend.board_file_access(object_name,true)
   and exists (select 1 from table_backend.tables t where t.id=split_part(object_name,'/',1)
     and not table_backend.scene_uses_asset(t,split_part(object_name,'/',2)))
$$;

create function table_backend.check_layout_assets(table_id text, layout jsonb) returns void
language plpgsql set search_path = pg_catalog as $$
declare asset jsonb;
begin
 perform table_backend.require(layout->>'tableId'=table_id);
 for asset in select layout->'background' where layout->'background'<>'null'
   union select m->'assetId' from jsonb_array_elements(layout->'materials') m where m->>'kind'='image'
 loop
  perform table_backend.require(table_backend.board_has_asset(table_id,asset));
 end loop;
end $$;

create function table_backend.guard_scene_layout() returns trigger
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
  new.board=(new.board-'sceneId') ||
    '{"background":null,"grid":{"enabled":false,"size":80,"x":0,"y":0},"materials":[]}';
 end if;
 return new;
end $$;
create trigger guard_scene_layout before update of scenes on table_backend.tables
 for each row execute function table_backend.guard_scene_layout();

create function table_backend.guard_template_layout() returns trigger
language plpgsql set search_path = pg_catalog as $$
declare layout jsonb=new.document#>'{scene,layout}';
begin
 if layout is not null then
  perform table_backend.require(exists(select from table_backend.tables t
    where t.id=layout->>'tableId' and t.owner_id=new.user_id));
  perform table_backend.check_layout_assets(layout->>'tableId',layout);
 end if;
 return new;
end $$;
create trigger guard_template_layout before insert or update of document on table_backend.templates
 for each row execute function table_backend.guard_template_layout();

alter function table_backend.project_board(table_backend.tables,boolean) rename to project_board_before_scenes;
create function table_backend.project_board(t table_backend.tables, director boolean) returns jsonb
language sql stable set search_path = pg_catalog as $$
 select table_backend.project_board_before_scenes(t,director) || table_backend.pick(t.board,array['sceneId'])
$$;

alter function public.table_command(text,jsonb) rename to table_command_before_workspace;
alter function public.table_command_before_workspace(text,jsonb) set schema table_backend;
revoke all on function table_backend.table_command_before_workspace(text,jsonb) from public, anon, authenticated;

create function public.table_command(p_table_id text, p_command jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
 p jsonb=p_command->'payload'; kind text=p_command->>'type'; actor uuid; op text=p_command->>'operationId'; original jsonb;
 cached table_backend.operations; t table_backend.tables; selected jsonb; next_board jsonb; result jsonb;
begin
 if kind is null or kind not in ('board-start-scene','board-grid') then
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
  next_board=next_board || coalesce(table_backend.pick(selected->'layout',array['background','grid','materials']),
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

revoke all on function table_backend.board_grid(jsonb), table_backend.scene(jsonb), table_backend.scene_layout(jsonb),
 table_backend.scene_uses_asset(table_backend.tables,text), table_backend.check_layout_assets(text,jsonb),
 table_backend.guard_scene_layout(), table_backend.guard_template_layout(),
 table_backend.project_board(table_backend.tables,boolean) from public, anon, authenticated;
revoke all on function public.table_command(text,jsonb) from public, anon, authenticated;
grant execute on function public.table_command(text,jsonb) to authenticated;

commit;
