begin;

alter table table_backend.tables add column board jsonb not null default
  '{"background":null,"grid":{"enabled":false,"size":80,"x":0,"y":0},"materials":[],"counters":[],"pins":[]}';

create function table_backend.board_range(v jsonb, low numeric, high numeric) returns boolean
language sql immutable set search_path = pg_catalog as $$
 select case when jsonb_typeof(v)='number' then (v #>> '{}')::numeric between low and high else false end
$$;

create function table_backend.board_counter(scenes jsonb, pin jsonb) returns jsonb
language sql immutable set search_path = pg_catalog as $$
 select table_backend.pick(c,array['id','name','value','max']) || jsonb_build_object('sceneId',s->'id')
 from jsonb_array_elements(scenes) s cross join lateral jsonb_array_elements(s->'counters') c
 where s->'id'=pin->'sceneId' and s->'published'='true' and s->>'status'<>'prepared'
   and c->'id'=pin->'id' and c->'public'='true'
$$;

create function table_backend.board_prune_pins() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
 new.board = jsonb_set(new.board,'{pins}',coalesce((
   select jsonb_agg(pin) from jsonb_array_elements(new.board->'pins') pin
   where table_backend.board_counter(new.scenes,pin) is not null
 ),'[]'::jsonb));
 return new;
end $$;

create trigger board_prune_pins before update of scenes on table_backend.tables
 for each row execute function table_backend.board_prune_pins();

create function table_backend.project_board(t table_backend.tables, director boolean) returns jsonb
language sql stable set search_path = pg_catalog as $$
 select table_backend.pick(t.board,array['background','grid','materials']) ||
 jsonb_build_object('counters',coalesce((
   select jsonb_agg(c - 'pinned' order by position)
   from jsonb_array_elements(t.board->'counters') with ordinality entries(c,position) where c->'pinned'='true'
 ),'[]'::jsonb) || coalesce((
   select jsonb_agg(c order by position) from jsonb_array_elements(t.board->'pins') with ordinality entries(pin,position)
   cross join lateral table_backend.board_counter(t.scenes,pin) c where c is not null
 ),'[]'::jsonb)) ||
 case when director then jsonb_build_object('availableCounters',coalesce((
   select jsonb_agg(c - 'pinned' order by position)
   from jsonb_array_elements(t.board->'counters') with ordinality entries(c,position) where c->'pinned'='false'
 ),'[]'::jsonb)) else '{}'::jsonb end
$$;

-- Keep the existing projection and command contracts for all other table workflows.
alter function public.table_read(text) rename to table_read_before_board;
alter function public.table_read_before_board(text) set schema table_backend;
revoke all on function table_backend.table_read_before_board(text) from public, anon, authenticated;

create function public.table_read(p_table_id text) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
 select table_backend.table_read_before_board(p_table_id) ||
        jsonb_build_object('board',table_backend.project_board(t,t.owner_id=auth.uid()))
 from table_backend.tables t where t.id=p_table_id
 union all
 select table_backend.table_read_before_board(p_table_id)
 where not exists (select 1 from table_backend.tables where id=p_table_id)
$$;

create function table_backend.board_asset_id(v jsonb) returns boolean
language sql immutable set search_path = pg_catalog as $$
 select coalesce(jsonb_typeof(v)='string' and (v #>> '{}') ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$',false)
$$;

create function table_backend.board_uses_asset(board jsonb, asset text) returns boolean
language sql immutable set search_path = pg_catalog as $$
 select coalesce(board->>'background'=asset,false)
   or (board->'materials') @> jsonb_build_array(jsonb_build_object('assetId',asset))
$$;

create function table_backend.board_has_asset(table_id text, asset jsonb) returns boolean
language sql stable set search_path = pg_catalog as $$
 select table_backend.board_asset_id(asset) and exists (
   select 1 from storage.objects o join table_backend.tables t on t.id=table_id
   where o.bucket_id='table-images' and o.name=table_id || '/' || (asset #>> '{}')
     and o.metadata->>'mimetype'='image/webp'
     and (o.created_at >= statement_timestamp()-interval '24 hours' or table_backend.board_uses_asset(t.board,asset #>> '{}'))
 )
$$;

alter function public.table_command(text,jsonb) rename to table_command_before_board;
alter function public.table_command_before_board(text,jsonb) set schema table_backend;
revoke all on function table_backend.table_command_before_board(text,jsonb) from public, anon, authenticated;

create function public.table_command(p_table_id text, p_command jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
 kind text=p_command->>'type'; p jsonb=p_command->'payload'; actor uuid;
 op text=p_command->>'operationId'; original jsonb; cached table_backend.operations;
 t table_backend.tables; b jsonb; target jsonb; pin jsonb; scene_pos integer; counter_pos integer;
 path text[]; counter_value numeric; result jsonb;
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
 if kind in ('board-pin-counter','board-unpin-counter','board-step-counter') then
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
   perform table_backend.require(target is null and jsonb_array_length(b->'materials')<32 and table_backend.str(p->'title'));
   if p->>'kind'='image' then
    perform table_backend.require(table_backend.board_has_asset(t.id,p->'assetId'));
    target=table_backend.pick(p,array['id','title','kind','x','y','assetId']);
   else
    perform table_backend.require(p->>'kind'='text' and table_backend.str(p->'text',50000)
      and (not (p ? 'markdown') or jsonb_typeof(p->'markdown')='boolean'));
    target=table_backend.pick(p,array['id','title','kind','x','y','text','markdown']);
   end if;
   b=jsonb_set(b,'{materials}',(b->'materials') || jsonb_build_array(target));
  when 'board-move','board-remove' then
   perform table_backend.require(target is not null);
   if kind='board-remove' then
    b=jsonb_set(b,'{materials}',coalesce((select jsonb_agg(m order by position)
      from jsonb_array_elements(b->'materials') with ordinality items(m,position) where m->'id'<>p->'id'),'[]'::jsonb));
   else
    b=jsonb_set(b,'{materials}',(select jsonb_agg(case when m->'id'=p->'id' then m || table_backend.pick(p,array['x','y']) else m end order by position)
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
     b=jsonb_set(b,'{pins}',(b->'pins') || jsonb_build_array(pin));
    else
     b=jsonb_set(b,'{pins}',coalesce((select jsonb_agg(r order by position)
       from jsonb_array_elements(b->'pins') with ordinality items(r,position) where r<>pin),'[]'::jsonb));
    end if;
   else
    perform table_backend.require(target is not null);
    b=jsonb_set(b,array['counters',counter_pos::text,'pinned'],to_jsonb(kind='board-pin-counter'));
   end if;
  when 'board-step-counter' then
   perform table_backend.require(p->'delta' in ('1'::jsonb,'-1'::jsonb));
   if p ? 'sceneId' then
    perform table_backend.require(b->'pins' @> jsonb_build_array(pin) and table_backend.board_counter(t.scenes,pin) is not null);
    select c,(scene_index-1)::integer,(counter_index-1)::integer into target,scene_pos,counter_pos
    from jsonb_array_elements(t.scenes) with ordinality scenes(s,scene_index)
    cross join lateral jsonb_array_elements(s->'counters') with ordinality counters(c,counter_index)
    where s->'id'=p->'sceneId' and c->'id'=p->'id';
   end if;
   perform table_backend.require(target is not null);
   counter_value=greatest(0,least(coalesce((target->>'max')::numeric,1000000000),
      (target->>'value')::numeric+(p->>'delta')::numeric));
   if p ? 'sceneId' then
    path=array[scene_pos::text,'counters',counter_pos::text,'value'];
    update table_backend.tables set scenes=jsonb_set(scenes,path,to_jsonb(counter_value)) where id=t.id;
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

create table table_backend.board_views (
 id text primary key references table_backend.tables(id) on delete cascade,
 revision bigint not null default 0,
 x numeric not null default 800,
 y numeric not null default 450,
 zoom numeric not null default 1,
 control text,
 sequence bigint not null default 0
);
alter table table_backend.board_views enable row level security;
revoke all on table_backend.board_views from public, anon, authenticated;

create table public.table_board_signals (
 id text primary key references table_backend.tables(id) on delete cascade,
 revision bigint not null
);
alter table public.table_board_signals enable row level security;
revoke all on public.table_board_signals from public, anon, authenticated;
grant select on public.table_board_signals to authenticated;
create policy board_signal_members on public.table_board_signals for select to authenticated
 using (table_backend.is_member(id));
alter publication supabase_realtime add table public.table_board_signals;

create function public.table_board_view(p_table_id text) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare v table_backend.board_views;
begin
 perform table_backend.actor();
 if not table_backend.is_member(p_table_id) then raise exception using errcode='PT404',message='Стол не найден'; end if;
 select * into v from table_backend.board_views where id=p_table_id;
 if not found then return '{"revision":0,"x":800,"y":450,"zoom":1,"control":null}'; end if;
 return to_jsonb(v)-array['id','sequence'];
end $$;

create function table_backend.board_view_signal(p_table_id text, p_revision bigint) returns void
language sql set search_path = pg_catalog as $$
 insert into public.table_board_signals values(p_table_id,p_revision)
 on conflict (id) do update set revision=excluded.revision
$$;

create function public.table_board_view_write(p_table_id text, p_command jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
 actor uuid=table_backend.actor(); t table_backend.tables; old table_backend.board_views;
 kind text=p_command->>'type'; token text=p_command->>'control'; pos jsonb=p_command->'view';
 next_zoom numeric; half_width numeric; half_height numeric; seq bigint=0;
begin
 perform table_backend.require(table_backend.ident(p_command->'control') and kind in ('start','move','stop')
   and table_backend.board_range(pos->'x',0,1600) and table_backend.board_range(pos->'y',0,900)
   and table_backend.board_range(pos->'zoom',1,4));
 select * into t from table_backend.tables where id=p_table_id for share;
 if not found or not table_backend.is_member(p_table_id) then raise exception using errcode='PT404',message='Стол не найден'; end if;
 if t.owner_id<>actor then raise exception using errcode='42501',message='Действие доступно ведущему'; end if;
 if t.archived then raise exception using errcode='PT409',message='Стол в архиве'; end if;
 insert into table_backend.board_views(id) values(p_table_id) on conflict do nothing;
 select * into old from table_backend.board_views where id=p_table_id for update;
 if kind='start' then
  perform table_backend.require(table_backend.num(p_command->'expectedRevision'));
  if old.revision<>(p_command->>'expectedRevision')::bigint or old.control=token then return public.table_board_view(p_table_id); end if;
 elsif old.control is distinct from token then return public.table_board_view(p_table_id);
 end if;
 if kind='move' then
  perform table_backend.require(table_backend.num(p_command->'sequence',1));
  seq=(p_command->>'sequence')::bigint;
  if seq<=old.sequence then return public.table_board_view(p_table_id); end if;
 end if;
 next_zoom=(pos->>'zoom')::numeric;
 half_width=800/next_zoom; half_height=450/next_zoom;
 update table_backend.board_views set revision=old.revision+1, zoom=next_zoom,
   x=greatest(half_width,least(1600-half_width,(pos->>'x')::numeric)),
   y=greatest(half_height,least(900-half_height,(pos->>'y')::numeric)),
   control=case when kind='stop' then null else token end, sequence=seq where id=p_table_id;
 perform table_backend.board_view_signal(p_table_id,old.revision+1);
 return public.table_board_view(p_table_id);
end $$;

create function table_backend.stop_board_view() returns trigger
language plpgsql set search_path = pg_catalog as $$
declare revision_after bigint;
begin
 if new.archived or new.owner_id<>old.owner_id then
  update table_backend.board_views set control=null,sequence=0,revision=revision+1
    where id=new.id and control is not null returning revision into revision_after;
  if found then perform table_backend.board_view_signal(new.id,revision_after); end if;
 end if;
 return new;
end $$;
create trigger stop_board_view after update of archived,owner_id on table_backend.tables
 for each row execute function table_backend.stop_board_view();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('table-images','table-images',false,8388608,array['image/webp']);

create function table_backend.board_file_access(object_name text, editing boolean) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
 select exists (
   select 1 from table_backend.tables t
   where t.id=split_part(object_name,'/',1)
     and object_name=t.id || '/' || split_part(object_name,'/',2)
     and table_backend.board_asset_id(to_jsonb(split_part(object_name,'/',2)))
     and table_backend.is_member(t.id)
     and case when editing then t.owner_id=auth.uid() and not t.archived
       else t.owner_id=auth.uid() or table_backend.board_uses_asset(t.board,split_part(object_name,'/',2))
       end
 )
$$;

create policy table_image_read on storage.objects for select to authenticated
 using (bucket_id='table-images' and table_backend.board_file_access(name,false));
create policy table_image_upload on storage.objects for insert to authenticated
 with check (bucket_id='table-images' and table_backend.board_file_access(name,true));

-- Expired uploads cannot be published. The extra day between expiry and deletion
-- keeps garbage collection independent of concurrent publish requests.
create function table_backend.board_file_expired(object_name text, uploaded_at timestamptz) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
 select uploaded_at<statement_timestamp()-interval '48 hours'
   and table_backend.board_file_access(object_name,true)
   and exists (select 1 from table_backend.tables t where t.id=split_part(object_name,'/',1)
               and not table_backend.board_uses_asset(t.board,split_part(object_name,'/',2)))
$$;
create policy table_image_cleanup on storage.objects for delete to authenticated
 using (bucket_id='table-images' and table_backend.board_file_expired(name,created_at));

create function public.table_board_expired_images(p_table_id text) returns text[]
language sql stable security definer set search_path = pg_catalog as $$
 select array(
   select o.name from storage.objects o
   where o.bucket_id='table-images' and o.name like p_table_id || '/%'
     and split_part(o.name,'/',1)=p_table_id
     and table_backend.board_file_expired(o.name,o.created_at)
   order by o.created_at limit 50
 )
$$;

revoke all on function table_backend.board_range(jsonb,numeric,numeric), table_backend.board_counter(jsonb,jsonb),
 table_backend.project_board(table_backend.tables,boolean), table_backend.board_prune_pins(),
 table_backend.board_asset_id(jsonb), table_backend.board_uses_asset(jsonb,text), table_backend.board_has_asset(text,jsonb),
 table_backend.board_view_signal(text,bigint), table_backend.stop_board_view(),
 table_backend.board_file_access(text,boolean), table_backend.board_file_expired(text,timestamptz) from public, anon, authenticated;
grant execute on function table_backend.board_file_access(text,boolean), table_backend.board_file_expired(text,timestamptz) to authenticated;

revoke all on function public.table_read(text), public.table_command(text,jsonb),
 public.table_board_view(text), public.table_board_view_write(text,jsonb), public.table_board_expired_images(text) from public, anon, authenticated;
grant execute on function public.table_read(text), public.table_command(text,jsonb),
 public.table_board_view(text), public.table_board_view_write(text,jsonb), public.table_board_expired_images(text) to authenticated;
commit;
