begin;

alter table table_backend.tables add column companions jsonb not null default '[]'::jsonb;

create or replace function public.table_read(p_table_id text) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
 select table_backend.table_read_before_board(p_table_id) ||
        jsonb_build_object('board',table_backend.project_board(t,t.owner_id=auth.uid()),'companions',t.companions) ||
        table_backend.project_combat(t,t.owner_id=auth.uid())
 from table_backend.tables t where t.id=p_table_id
 union all
 select table_backend.table_read_before_board(p_table_id)
 where not exists (select 1 from table_backend.tables where id=p_table_id)
$$;

alter function public.table_command(text,jsonb) rename to table_command_before_journal_companions;
alter function public.table_command_before_journal_companions(text,jsonb) set schema table_backend;
revoke all on function table_backend.table_command_before_journal_companions(text,jsonb) from public, anon, authenticated;

create function public.table_command(p_table_id text, p_command jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
 p jsonb=p_command->'payload'; kind text=p_command->>'type'; actor uuid; op text=p_command->>'operationId';
 original jsonb; cached table_backend.operations; t table_backend.tables; director boolean;
 entry jsonb; companion jsonb; target jsonb;
begin
 if kind is null or kind not in ('event-edit','event-delete','save-companion','delete-companion') then
   return table_backend.table_command_before_journal_companions(p_table_id,p_command);
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
 if t.archived then raise exception using errcode='PT409',message='Стол в архиве'; end if;
 if t.revision<>(p_command->>'expectedRevision')::bigint then raise exception using errcode='PT409',message='Конфликт версии стола. Обновите данные'; end if;
 director=t.owner_id=actor;

 if kind in ('event-edit','event-delete') then
   perform table_backend.require(table_backend.ident(p->'eventId'));
   select value into entry from jsonb_array_elements(t.events)
   where value->'id'=p->'eventId' and (director or value->'public'='true' or value->>'actor'=actor::text);
   if not found then raise exception using errcode='PT404',message='Запись не найдена'; end if;
   if entry->>'kind' is distinct from 'message' or
      (entry->>'actor' is distinct from actor::text and (kind='event-edit' or not director)) then
     raise exception using errcode='42501',message='Нельзя изменить эту запись';
   end if;
   if kind='event-edit' then
     perform table_backend.require(table_backend.str(p->'text',10000) and
       (not p ? 'public' or director and jsonb_typeof(p->'public')='boolean'));
     entry=entry || jsonb_build_object('text',btrim(p->>'text'),'editedAt',clock_timestamp()) || table_backend.pick(p,array['public']);
   end if;
   update table_backend.tables set events=(
     select coalesce(jsonb_agg(case when value->'id'=p->'eventId' then entry else value end order by pos),'[]')
     from jsonb_array_elements(t.events) with ordinality e(value,pos)
     where kind='event-edit' or value->'id'<>p->'eventId'
   ) where id=t.id;
 else
   if not director then raise exception using errcode='42501',message='Действие доступно ведущему'; end if;
   if kind='save-companion' then
     companion=p->'companion';
     perform table_backend.require(jsonb_typeof(companion)='object' and table_backend.ident(companion->'id') and
       table_backend.str(companion->'name',160) and (not companion ? 'sourceId' or table_backend.str(companion->'sourceId',200)) and
       table_backend.num(companion->'stamina') and table_backend.num(companion->'maxStamina',1));
     perform table_backend.require((companion->>'stamina')::numeric<=(companion->>'maxStamina')::numeric and (companion->>'maxStamina')::numeric<=9999);
     companion=table_backend.pick(companion,array['id','sourceId','stamina','maxStamina']) || jsonb_build_object('name',btrim(companion->>'name'));
     target=companion->'id';
     if not exists(select from jsonb_array_elements(t.companions) c where c->'id'=target) then
       if jsonb_array_length(t.companions)>=50 then raise exception using errcode='PT409',message='На столе уже 50 спутников'; end if;
       t.companions=t.companions || jsonb_build_array(companion);
     end if;
   else
     perform table_backend.require(table_backend.ident(p->'companionId'));
     target=p->'companionId';
     if not exists(select from jsonb_array_elements(t.companions) c where c->'id'=target) then
       raise exception using errcode='PT404',message='Спутник не найден';
     end if;
   end if;
   update table_backend.tables set companions=(
     select coalesce(jsonb_agg(case when value->'id'=target then companion else value end order by pos),'[]')
     from jsonb_array_elements(t.companions) with ordinality c(value,pos)
     where kind='save-companion' or value->'id'<>target
   ) where id=t.id;
 end if;
 perform table_backend.touch(t.id);
 insert into table_backend.operations values(actor,op,original,t.id);
 return public.table_read(t.id);
end $$;

revoke all on function public.table_command(text,jsonb) from public, anon, authenticated;
grant execute on function public.table_command(text,jsonb) to authenticated;

commit;
