begin;

alter table table_backend.tables add column combat jsonb;

create function table_backend.combat_scene(t table_backend.tables) returns jsonb
language sql immutable set search_path = pg_catalog as $$
 select s from jsonb_array_elements(t.scenes) s
 where not t.archived and s->'id'=t.board->'sceneId' and s->>'kind'='encounter'
   and s->>'status'='active' and s->'published'='true'
$$;

create function table_backend.clear_inactive_combat() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
 if new.combat->'sceneId' is distinct from table_backend.combat_scene(new)->'id' then
   new.combat=null;
 end if;
 return new;
end $$;
create trigger zz_clear_inactive_combat before update of board, scenes, archived on table_backend.tables
for each row execute function table_backend.clear_inactive_combat();

create function table_backend.combat_availability(t table_backend.tables, s jsonb, battle jsonb) returns jsonb
language plpgsql stable set search_path = pg_catalog as $$
declare
 heroes jsonb; enemies jsonb; ready_heroes jsonb; ready_enemies jsonb;
 active_turn jsonb=nullif(battle->'active','null'); preferred text=battle->>'nextSide'; side text;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'heroId',m.active_hero_id)),'[]')
 into heroes from table_backend.members m
 join table_backend.heroes h on (h.table_id,h.user_id,h.hero_id)=(m.table_id,m.user_id,m.active_hero_id)
 join public.characters c on (c.user_id,c.id)=(h.user_id,h.hero_id)
 where m.table_id=t.id and m.user_id<>t.owner_id;
 select coalesce(jsonb_agg(unit->'id'),'[]') into enemies
 from jsonb_array_elements(s->'combatants') unit where unit->>'health'<>'defeated';
 select coalesce(jsonb_agg(h),'[]') into ready_heroes from jsonb_array_elements(heroes) h
 where not battle->'heroTurns' @> jsonb_build_array(jsonb_build_object('userId',h->'id','heroId',h->'heroId','round',battle->'round'));
 select coalesce(jsonb_agg(unit),'[]') into ready_enemies from jsonb_array_elements(enemies) unit
 where not battle->'enemyTurns' @> jsonb_build_array(unit);
 if (active_turn->>'side'='heroes' and heroes @> jsonb_build_array(active_turn-'side'))
     or (active_turn->>'side'='enemies' and enemies @> jsonb_build_array(active_turn->'id')) then
   side=active_turn->>'side';
 else
   active_turn=null;
   side=case
     when ready_heroes<>'[]' and (preferred='heroes' or ready_enemies='[]') then 'heroes'
     when ready_enemies<>'[]' then 'enemies'
   end;
 end if;
 return jsonb_build_object('side',side,'active',active_turn,'heroes',ready_heroes,'enemies',ready_enemies);
end $$;

create function table_backend.project_combat(t table_backend.tables, director boolean) returns jsonb
language plpgsql stable set search_path = pg_catalog as $$
declare s jsonb=table_backend.combat_scene(t); battle jsonb=t.combat; available jsonb; active_turn jsonb; visible jsonb;
begin
 if s is null or battle is null or s->'id'<>battle->'sceneId' then return '{}'; end if;
 available=table_backend.combat_availability(t,s,battle);
 active_turn=available->'active';
 if not director then
   select coalesce(jsonb_agg(unit->'id'),'[]') into visible
   from jsonb_array_elements(s->'combatants') unit where unit->'revealed'='true';
   if active_turn->>'side'='enemies' and not visible @> jsonb_build_array(active_turn->'id') then
     active_turn=active_turn || '{"id":null}';
   end if;
   battle=jsonb_set(battle,'{enemyTurns}',(
     select coalesce(jsonb_agg(unit),'[]') from jsonb_array_elements(battle->'enemyTurns') unit
     where visible @> jsonb_build_array(unit)
   ));
 end if;
 return jsonb_build_object('combat',(battle-'nextSide') || jsonb_build_object('active',active_turn,'side',available->'side'));
end $$;

create or replace function public.table_read(p_table_id text) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
 select table_backend.table_read_before_board(p_table_id) ||
        jsonb_build_object('board',table_backend.project_board(t,t.owner_id=auth.uid())) ||
        table_backend.project_combat(t,t.owner_id=auth.uid())
 from table_backend.tables t where t.id=p_table_id
 union all
 select table_backend.table_read_before_board(p_table_id)
 where not exists (select 1 from table_backend.tables where id=p_table_id)
$$;

create function public.table_hero_combat(p_hero_id text) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare actor uuid=table_backend.actor(); result jsonb;
begin
 perform table_backend.require(table_backend.ident(to_jsonb(p_hero_id)));
 select jsonb_build_object('tableId',t.id,'userId',actor,'combat',table_backend.project_combat(t,false)->'combat') into result
 from table_backend.heroes h
 join table_backend.members m on (m.table_id,m.user_id,m.active_hero_id)=(h.table_id,h.user_id,h.hero_id)
 join table_backend.tables t on t.id=h.table_id
 where h.user_id=actor and h.hero_id=p_hero_id and t.owner_id<>actor
   and t.combat->'sceneId'=table_backend.combat_scene(t)->'id';
 return result;
end $$;

alter function public.table_command(text,jsonb) rename to table_command_before_combat;
alter function public.table_command_before_combat(text,jsonb) set schema table_backend;
revoke all on function table_backend.table_command_before_combat(text,jsonb) from public, anon, authenticated;

create function public.table_command(p_table_id text, p_command jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
 p jsonb=p_command->'payload'; kind text=p_command->>'type'; actor uuid; op text=p_command->>'operationId';
 original jsonb; cached table_backend.operations; t table_backend.tables; s jsonb; battle jsonb;
 available jsonb; active_turn jsonb; side text=p->>'side'; initiative text=p->>'initiative';
begin
 if kind is null or kind not in ('combat-start','combat-next-round','combat-start-turn','combat-end-turn') then
   return table_backend.table_command_before_combat(p_table_id,p_command);
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
 s=table_backend.combat_scene(t);
 if s is null or s->'id' is distinct from p->'sceneId' then raise exception using errcode='PT409',message='Сначала откройте сцену боя'; end if;
 battle=t.combat;
 if kind in ('combat-start','combat-next-round') then
   if t.owner_id<>actor then raise exception using errcode='42501',message='Действие доступно ведущему'; end if;
 else
   perform table_backend.require(side in ('heroes','enemies') and table_backend.ident(p->'id'));
   if (side='heroes' and (t.owner_id=actor or p->>'id'<>actor::text))
       or (side='enemies' and t.owner_id<>actor) then
     raise exception using errcode='42501',message='Нельзя управлять чужим ходом';
   end if;
 end if;

 if kind='combat-start' then
   perform table_backend.require(initiative in ('heroes','enemies'));
   if battle is not null then raise exception using errcode='PT409',message='Бой уже начался'; end if;
   battle=jsonb_build_object('id',op,'sceneId',s->'id','round',1,'initiative',initiative,'nextSide',initiative,
     'active',null,'heroTurns','[]'::jsonb,'enemyTurns','[]'::jsonb);
 else
   if battle is null or battle->'id' is distinct from p->'combatId' then raise exception using errcode='PT409',message='Этот бой уже недоступен'; end if;
   if kind='combat-next-round' then
     battle=battle || jsonb_build_object('round',(battle->>'round')::integer+1,'active',null,'nextSide',battle->'initiative','enemyTurns','[]'::jsonb);
   else
     available=table_backend.combat_availability(t,s,battle);
     active_turn=available->'active';
     if kind='combat-end-turn' then
       if active_turn->'id' is distinct from p->'id' or active_turn->>'side' is distinct from side then
         raise exception using errcode='PT409',message='Этот ход не начат';
       end if;
       battle=battle || jsonb_build_object('active',null,'nextSide',case when side='heroes' then 'enemies' else 'heroes' end);
     else
       if available->>'side' is distinct from side or active_turn<>'null' then
         raise exception using errcode='PT409',message='Сейчас нельзя начать этот ход';
       end if;
       if side='heroes' then
         perform table_backend.require(table_backend.ident(p->'heroId'));
         if not available->'heroes' @> jsonb_build_array(jsonb_build_object('id',p->'id','heroId',p->'heroId')) then
           raise exception using errcode='PT409',message='Герой уже сходил или недоступен';
         end if;
         battle=jsonb_set(battle,'{heroTurns}',battle->'heroTurns' || jsonb_build_array(
           jsonb_build_object('userId',p->'id','heroId',p->'heroId','round',battle->'round')));
         active_turn=jsonb_build_object('id',p->'id','heroId',p->'heroId','side',side);
       else
         if not available->'enemies' @> jsonb_build_array(p->'id') then
           raise exception using errcode='PT409',message='Участник уже сходил или недоступен';
         end if;
         battle=jsonb_set(battle,'{enemyTurns}',battle->'enemyTurns' || jsonb_build_array(p->'id'));
         active_turn=jsonb_build_object('id',p->'id','side',side);
       end if;
       battle=jsonb_set(battle,'{active}',active_turn);
     end if;
   end if;
 end if;
 if kind in ('combat-start','combat-next-round') then
   s=jsonb_set(s,'{combatants}',(
     select coalesce(jsonb_agg(unit || '{"turn":"ready","reactionUsed":false}' order by pos),'[]')
     from jsonb_array_elements(s->'combatants') with ordinality units(unit,pos)
   ));
   update table_backend.tables set combat=battle,scenes=(
     select jsonb_agg(case when scene->'id'=s->'id' then s else scene end order by pos)
     from jsonb_array_elements(t.scenes) with ordinality entries(scene,pos)
   ) where id=t.id;
 else
   update table_backend.tables set combat=battle where id=t.id;
 end if;
 perform table_backend.touch(t.id);
 insert into table_backend.operations values(actor,op,original,t.id);
 return public.table_read(t.id);
end $$;

revoke all on function table_backend.combat_scene(table_backend.tables),
 table_backend.clear_inactive_combat(), table_backend.combat_availability(table_backend.tables,jsonb,jsonb),
 table_backend.project_combat(table_backend.tables,boolean), public.table_command(text,jsonb),
 public.table_hero_combat(text) from public, anon, authenticated;
grant execute on function public.table_command(text,jsonb), public.table_hero_combat(text) to authenticated;

commit;
