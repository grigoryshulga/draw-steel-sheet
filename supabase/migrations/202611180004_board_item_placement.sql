-- Persist per-item editing settings and positioned counters on the shared scene.
begin;

create function table_backend.board_settings(v jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
begin
 perform table_backend.require(jsonb_typeof(v)='object'
   and table_backend.board_range(v->'width',160,1600) and table_backend.board_range(v->'height',88,900)
   and jsonb_typeof(v->'snap')='boolean' and (not (v ? 'locked') or jsonb_typeof(v->'locked')='boolean'));
 return table_backend.pick(v,array['width','height','snap']) ||
   case when v->'locked'='true' then '{"locked":true}'::jsonb else '{}'::jsonb end;
end $$;

create function table_backend.board_item_settings(v jsonb) returns jsonb
language sql immutable set search_path = pg_catalog as $$
 select case when v ? 'settings' then jsonb_build_object('settings',table_backend.board_settings(v->'settings')) else '{}'::jsonb end
$$;

create function table_backend.board_counter_placement(v jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
begin
 perform table_backend.require(table_backend.board_range(v->'x',0,1600) and table_backend.board_range(v->'y',0,900));
 return table_backend.pick(v,array['x','y']) || table_backend.board_settings(v);
end $$;

create function table_backend.board_check_lock(previous jsonb, next jsonb) returns void
language plpgsql immutable set search_path = pg_catalog as $$
begin
 if previous->'locked'='true' then
  perform table_backend.require(previous-'locked'=next-'locked');
 end if;
end $$;

create or replace function table_backend.scene_layout(v jsonb) returns jsonb
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
   pieces=pieces || jsonb_build_array(table_backend.pick(m,array['kind','id','title','x','y','assetId']) || table_backend.board_item_settings(m));
  elsif m->>'kind'='counter' then
   perform table_backend.require(table_backend.num(m->'value')
     and (not (m ? 'max') or table_backend.num(m->'max',(m->>'value')::bigint)));
   pieces=pieces || jsonb_build_array(table_backend.pick(m,array['kind','id','title','x','y','value','max']) || table_backend.board_item_settings(m));
  else
   perform table_backend.require(m->>'kind'='text' and table_backend.str(m->'text',50000)
      and (not (m ? 'markdown') or jsonb_typeof(m->'markdown')='boolean'));
   pieces=pieces || jsonb_build_array(table_backend.pick(m,array['kind','id','title','x','y','text','markdown']) || table_backend.board_item_settings(m));
  end if;
 end loop;
 return table_backend.pick(v,array['tableId','background']) ||
   jsonb_build_object('grid',table_backend.board_grid(g),'materials',pieces);
end $$;

create or replace function table_backend.project_board_before_scenes(t table_backend.tables, director boolean) returns jsonb
language sql stable set search_path = pg_catalog as $$
 select table_backend.pick(t.board,array['background','grid','materials']) ||
 jsonb_build_object('counters',coalesce((
   select jsonb_agg(c - 'pinned' order by position)
   from jsonb_array_elements(t.board->'counters') with ordinality entries(c,position) where c->'pinned'='true'
 ),'[]'::jsonb) || coalesce((
   select jsonb_agg(c || table_backend.pick(pin,array['placement']) order by position) from jsonb_array_elements(t.board->'pins') with ordinality entries(pin,position)
   cross join lateral table_backend.board_counter(t.scenes,pin) c where c is not null
 ),'[]'::jsonb)) ||
 case when director then jsonb_build_object('availableCounters',coalesce((
   select jsonb_agg(c - 'pinned' order by position)
   from jsonb_array_elements(t.board->'counters') with ordinality entries(c,position) where c->'pinned'='false'
 ),'[]'::jsonb)) else '{}'::jsonb end
$$;

create or replace function table_backend.table_command_before_workspace(p_table_id text, p_command jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
 kind text=p_command->>'type'; p jsonb=p_command->'payload'; actor uuid;
 op text=p_command->>'operationId'; original jsonb; cached table_backend.operations;
 t table_backend.tables; b jsonb; target jsonb; pin jsonb; scene_pos integer; counter_pos integer;
 path text[]; counter_value numeric; result jsonb; placement jsonb; settings jsonb; selected_material jsonb; material_pos integer;
begin
 if kind is null or kind not like 'board-%' then
  result=table_backend.table_command_before_board(p_table_id,p_command);
  if result is null or result ? 'board' then return result; end if;
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
  if not exists(select 1 from table_backend.tables where id=cached.result_table_id) then return null; end if;
  return public.table_read(cached.result_table_id);
 end if;
 perform table_backend.require(table_backend.ident(to_jsonb(p_table_id)) and table_backend.num(p_command->'expectedRevision',1));
 select * into t from table_backend.tables where id=p_table_id for update;
 if not found or not table_backend.is_member(t.id) then raise exception using errcode='PT404',message='Стол не найден'; end if;
 if t.owner_id<>actor then raise exception using errcode='42501',message='Действие доступно ведущему'; end if;
 if t.archived then raise exception using errcode='PT409',message='Стол в архиве'; end if;
 if t.revision<>(p_command->>'expectedRevision')::bigint then raise exception using errcode='PT409',message='Конфликт версии стола. Обновите данные'; end if;
 b=t.board;
 if kind in ('board-show','board-move') then
  perform table_backend.require(table_backend.ident(p->'id') and table_backend.board_range(p->'x',0,1600) and table_backend.board_range(p->'y',0,900));
 end if;
 if kind in ('board-show','board-move','board-remove') then
  select m into target from jsonb_array_elements(b->'materials') m where m->'id'=p->'id';
 end if;
 if kind in ('board-pin-counter','board-unpin-counter','board-step-counter','board-place-counter') then
  perform table_backend.require(table_backend.ident(p->'id') and (not (p ? 'sceneId') or table_backend.ident(p->'sceneId')));
  pin=table_backend.pick(p,array['sceneId','id']);
  if not (p ? 'sceneId') then
   select c, (position-1)::integer into target,counter_pos
   from jsonb_array_elements(b->'counters') with ordinality items(c,position) where c->'id'=p->'id';
  end if;
 end if;
 case kind
  when 'board-grid' then
   perform table_backend.require(jsonb_typeof(p->'enabled')='boolean' and table_backend.num(p->'size',8)
     and table_backend.board_range(p->'size',8,400) and table_backend.num(p->'x',-1600)
     and table_backend.board_range(p->'x',-1600,1600) and table_backend.num(p->'y',-900)
     and table_backend.board_range(p->'y',-900,900));
   b=jsonb_set(b,'{grid}',table_backend.pick(p,array['enabled','size','x','y']));
  when 'board-background' then
   perform table_backend.require(p->'assetId'='null' or table_backend.board_has_asset(t.id,p->'assetId'));
   b=jsonb_set(b,'{background}',p->'assetId');
  when 'board-show' then
   settings=table_backend.board_item_settings(p);
   perform table_backend.require(target is null and jsonb_array_length(b->'materials')<32 and table_backend.str(p->'title'));
   if p->>'kind'='image' then
    perform table_backend.require(table_backend.board_has_asset(t.id,p->'assetId'));
    target=table_backend.pick(p,array['id','title','kind','x','y','assetId']);
   elsif p->>'kind'='counter' then
    perform table_backend.require(table_backend.num(p->'value')
      and (not (p ? 'max') or table_backend.num(p->'max',(p->>'value')::bigint)));
    target=table_backend.pick(p,array['id','title','kind','x','y','value','max']);
   else
    perform table_backend.require(p->>'kind'='text' and table_backend.str(p->'text',50000)
      and (not (p ? 'markdown') or jsonb_typeof(p->'markdown')='boolean'));
    target=table_backend.pick(p,array['id','title','kind','x','y','text','markdown']);
   end if;
   b=jsonb_set(b,'{materials}',(b->'materials') || jsonb_build_array(target || settings));
  when 'board-move','board-remove' then
   perform table_backend.require(target is not null);
   if kind='board-remove' then
    b=jsonb_set(b,'{materials}',coalesce((select jsonb_agg(m order by position)
      from jsonb_array_elements(b->'materials') with ordinality items(m,position) where m->'id'<>p->'id'),'[]'::jsonb));
   else
    placement=target || table_backend.pick(p,array['x','y']) || table_backend.board_item_settings(p);
    perform table_backend.board_check_lock((target->'settings') || table_backend.pick(target,array['x','y']),
      (placement->'settings') || table_backend.pick(placement,array['x','y']));
    b=jsonb_set(b,'{materials}',(select jsonb_agg(case when m->'id'=p->'id' then placement else m end order by position)
      from jsonb_array_elements(b->'materials') with ordinality items(m,position)));
   end if;
  when 'board-add-counter' then
   perform table_backend.require(table_backend.ident(p->'id') and table_backend.str(p->'name')
     and table_backend.num(p->'value') and (not (p ? 'max') or table_backend.num(p->'max',(p->>'value')::bigint))
     and not exists(select 1 from jsonb_array_elements(b->'counters') c where c->'id'=p->'id'));
   b=jsonb_set(b,'{counters}',(b->'counters') || jsonb_build_array(table_backend.pick(p,array['id','name','value','max']) || '{"pinned":true}'));
  when 'board-pin-counter','board-unpin-counter' then
   if p ? 'sceneId' then
    if kind='board-pin-counter' then
     perform table_backend.require(table_backend.board_counter(t.scenes,pin) is not null
       and not (b->'pins' @> jsonb_build_array(pin)));
     if p ? 'placement' then pin=pin || jsonb_build_object('placement',table_backend.board_counter_placement(p->'placement')); end if;
     b=jsonb_set(b,'{pins}',(b->'pins') || jsonb_build_array(pin));
    else
     b=jsonb_set(b,'{pins}',coalesce((select jsonb_agg(r order by position)
       from jsonb_array_elements(b->'pins') with ordinality items(r,position) where not (r @> pin)),'[]'::jsonb));
    end if;
   else
    perform table_backend.require(target is not null);
    if kind='board-pin-counter' and p ? 'placement' and target#>'{placement,locked}' is distinct from 'true' then
     b=jsonb_set(b,array['counters',counter_pos::text,'placement'],table_backend.board_counter_placement(p->'placement'));
    end if;
    b=jsonb_set(b,array['counters',counter_pos::text,'pinned'],to_jsonb(kind='board-pin-counter'));
   end if;
  when 'board-place-counter' then
   placement=table_backend.board_counter_placement(p->'placement');
   if p ? 'sceneId' then
    select r,(position-1)::integer into target,counter_pos
    from jsonb_array_elements(b->'pins') with ordinality entries(r,position) where r @> pin;
    path=array['pins',counter_pos::text,'placement'];
   else
    perform table_backend.require(target->'pinned'='true');
    path=array['counters',counter_pos::text,'placement'];
   end if;
   perform table_backend.require(target is not null);
   perform table_backend.board_check_lock(target->'placement',placement);
   b=jsonb_set(b,path,placement);
  when 'board-step-counter' then
   perform table_backend.require(p->'delta' in ('1'::jsonb,'-1'::jsonb));
   if p ? 'sceneId' then
    perform table_backend.require(b->'pins' @> jsonb_build_array(pin) and table_backend.board_counter(t.scenes,pin) is not null);
    select c,(scene_index-1)::integer,(counter_index-1)::integer into target,scene_pos,counter_pos
    from jsonb_array_elements(t.scenes) with ordinality scenes(s,scene_index)
    cross join lateral jsonb_array_elements(s->'counters') with ordinality counters(c,counter_index)
    where s->'id'=p->'sceneId' and c->'id'=p->'id';
   else
    select m,(position-1)::integer into selected_material,material_pos
    from jsonb_array_elements(b->'materials') with ordinality entries(m,position)
    where m->'id'=p->'id' and m->>'kind'='counter';
    if selected_material is not null then target=selected_material; end if;
   end if;
   perform table_backend.require(target is not null);
   counter_value=greatest(0,least(coalesce((target->>'max')::numeric,1000000000),
      (target->>'value')::numeric+(p->>'delta')::numeric));
   if p ? 'sceneId' then
    path=array[scene_pos::text,'counters',counter_pos::text,'value'];
    update table_backend.tables set scenes=jsonb_set(scenes,path,to_jsonb(counter_value)) where id=t.id;
   elsif material_pos is not null then
    b=jsonb_set(b,array['materials',material_pos::text,'value'],to_jsonb(counter_value));
   else
    b=jsonb_set(b,array['counters',counter_pos::text,'value'],to_jsonb(counter_value));
   end if;
  else raise exception using errcode='22023',message='Неизвестная команда полотна';
 end case;
 update table_backend.tables set board=b where id=t.id;
 perform table_backend.touch(t.id);
 insert into table_backend.operations values(actor,op,original,t.id);
 return public.table_read(t.id);
exception when invalid_text_representation or numeric_value_out_of_range then
 raise exception using errcode='22023',message='Некорректные данные';
end $$;

revoke all on function table_backend.board_settings(jsonb), table_backend.board_item_settings(jsonb),
 table_backend.board_counter_placement(jsonb), table_backend.board_check_lock(jsonb,jsonb)
 from public, anon, authenticated;

commit;
