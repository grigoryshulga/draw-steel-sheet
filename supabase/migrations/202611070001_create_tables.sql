-- Cooperative tables. No private table is exposed through PostgREST or Realtime.
-- Apply only after 202610230001_create_characters.sql. No deployment is performed here.
begin;
create schema table_backend;
revoke all on schema table_backend from public, anon, authenticated;

create table table_backend.tables (
  id text primary key,
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  archived boolean not null default false,
  revision bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp(),
  invite_code text not null unique,
  transfer_to uuid,
  blocked uuid[] not null default '{}',
  scenes jsonb not null default '[]',
  materials jsonb not null default '[]',
  events jsonb not null default '[]',
  offers jsonb not null default '[]',
  trades jsonb not null default '[]'
);
create table table_backend.members (
  table_id text not null references table_backend.tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  active_hero_id text,
  primary key(table_id,user_id)
);
create table table_backend.heroes (
  table_id text not null,
  user_id uuid not null,
  hero_id text not null,
  visibility jsonb not null,
  snapshot jsonb,
  primary key(user_id,hero_id),
  foreign key(table_id,user_id) references table_backend.members(table_id,user_id) on delete cascade
);
create index on table_backend.heroes(table_id);
create table table_backend.operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id text not null,
  input jsonb not null,
  result_table_id text,
  primary key(user_id,operation_id)
);
create table table_backend.templates (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  document jsonb not null,
  primary key(user_id,id)
);
create table public.table_signals (
  id text primary key references table_backend.tables(id) on delete cascade,
  revision bigint not null
);
alter table table_backend.tables enable row level security;
alter table table_backend.members enable row level security;
alter table table_backend.heroes enable row level security;
alter table table_backend.operations enable row level security;
alter table table_backend.templates enable row level security;
alter table public.table_signals enable row level security;
revoke all on table_backend.tables, table_backend.members, table_backend.heroes, table_backend.operations, table_backend.templates from public, anon, authenticated;
revoke all on public.table_signals from public, anon, authenticated;
grant select on public.table_signals to authenticated;

create function table_backend.require(ok boolean) returns void language plpgsql set search_path = pg_catalog as $$
begin if ok is not true then raise exception using errcode = '22023', message = 'Некорректные данные'; end if; end $$;
create function table_backend.actor() returns uuid language plpgsql stable security definer set search_path = pg_catalog as $$
begin if auth.uid() is null then raise exception using errcode = '42501', message = 'Требуется вход'; end if; return auth.uid(); end $$;
create function table_backend.ident(v jsonb) returns boolean language sql immutable set search_path = pg_catalog as $$
 select coalesce(jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^[A-Za-z0-9_-]{1,80}$',false)
$$;
create function table_backend.str(v jsonb, lim integer default 200, empty_ok boolean default false) returns boolean language sql immutable set search_path = pg_catalog as $$
 select coalesce(jsonb_typeof(v) = 'string' and char_length(v #>> '{}') <= lim and (empty_ok or char_length(btrim(v #>> '{}')) > 0),false)
$$;
create function table_backend.num(v jsonb, minimum bigint default 0) returns boolean language sql immutable set search_path = pg_catalog as $$
 select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric between minimum and 1000000000 and trunc((v #>> '{}')::numeric) = (v #>> '{}')::numeric else false end
$$;
create function table_backend.pick(v jsonb, keys text[]) returns jsonb language sql immutable set search_path = pg_catalog as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(v) where key = any(keys)
$$;
create function table_backend.visibility(v jsonb) returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare s jsonb;
begin
 if v is null then return '{"sections":["hero","development","inventory","journal","companions"],"notes":[]}'::jsonb; end if;
 perform table_backend.require(jsonb_typeof(v) = 'object' and jsonb_typeof(v->'sections') = 'array' and jsonb_typeof(v->'notes') = 'array');
 perform table_backend.require(jsonb_array_length(v->'sections') <= 5 and jsonb_array_length(v->'notes') <= 5);
 for s in select value from jsonb_array_elements(v->'sections') loop
  perform table_backend.require(s #>> '{}' = any(array['hero','development','inventory','journal','companions']));
 end loop;
 for s in select value from jsonb_array_elements(v->'notes') loop
  perform table_backend.require(s #>> '{}' = any(array['story','contacts','debts','secrets','misc']));
 end loop;
 perform table_backend.require((select count(*) = count(distinct value) from jsonb_array_elements(v->'sections')) and (select count(*) = count(distinct value) from jsonb_array_elements(v->'notes')));
 return table_backend.pick(v,array['sections','notes']);
end $$;
create function table_backend.item(v jsonb) returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare e jsonb;
begin
 perform table_backend.require(jsonb_typeof(v) = 'object' and table_backend.ident(v->'id') and table_backend.str(v->'name') and v->>'category' = any(array['gear','consumable','treasure','trinket','title']) and table_backend.num(v->'qty',1) and jsonb_typeof(v->'equipped') = 'boolean' and table_backend.str(v->'notes',50000,true));
 perform table_backend.require(not v ? 'catalogId' or table_backend.str(v->'catalogId'));
 if v ? 'effects' then
  perform table_backend.require(jsonb_typeof(v->'effects')='array');
  perform table_backend.require(jsonb_array_length(v->'effects')<=16);
  for e in select value from jsonb_array_elements(v->'effects') loop
   perform table_backend.require(jsonb_typeof(e)='object' and e->>'field'=any(array['stamina','recoveries','speed','stability','disengage','save','rolledDamage','freeStrikeDamage']) and table_backend.num(e->'value',-100));
   perform table_backend.require((e->>'value')::numeric<=100 and e=table_backend.pick(e,array['field','value']));
  end loop;
 end if;
 return table_backend.pick(v,array['id','name','category','qty','notes','equipped','catalogId','effects']);
end $$;
create function table_backend.scene(v jsonb) returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare c jsonb; s jsonb; k text; cs jsonb = '[]'; counters jsonb = '[]'; states jsonb; ids text[] = '{}'; condition_ids text[]; counter_ids text[] = '{}';
begin
 perform table_backend.require(jsonb_typeof(v) = 'object' and table_backend.ident(v->'id') and table_backend.str(v->'name') and v->>'kind' = any(array['encounter','negotiation','montage']) and v->>'status' = any(array['prepared','active','finished']) and jsonb_typeof(v->'published') = 'boolean' and table_backend.str(v->'description',50000,true) and table_backend.str(v->'objective',10000,true) and table_backend.num(v->'round') and v->>'initiative' = any(array['heroes','enemies']));
 perform table_backend.require(jsonb_typeof(v->'combatants') = 'array' and jsonb_typeof(v->'counters') = 'array');
 perform table_backend.require(jsonb_array_length(v->'combatants') <= 500 and jsonb_array_length(v->'counters') <= 100);
 perform table_backend.require(not v ? 'directorNotes' or table_backend.str(v->'directorNotes',50000,true));
 perform table_backend.require(not v ? 'malice' or table_backend.num(v->'malice'));
 for c in select value from jsonb_array_elements(v->'combatants') loop
  perform table_backend.require(jsonb_typeof(c) = 'object' and table_backend.ident(c->'id') and not (c->>'id' = any(ids)) and table_backend.str(c->'name') and table_backend.str(c->'group',200,true) and table_backend.str(c->'organization',200,true) and c->>'faction' = any(array['enemy','ally']) and jsonb_typeof(c->'revealed') = 'boolean' and c->>'turn' = any(array['ready','active','done']) and jsonb_typeof(c->'reactionUsed') = 'boolean' and c->>'health' = any(array['healthy','hurt','winded','defeated']));
  ids = array_append(ids,c->>'id');
  foreach k in array array['maxStamina','temporaryStamina','count'] loop perform table_backend.require(not c ? k or table_backend.num(c->k)); end loop;
  if c ? 'encounterValue' then
   perform table_backend.require(jsonb_typeof(c->'encounterValue')='number');
   perform table_backend.require((c->>'encounterValue')::numeric between 0 and 1000000000 and trunc((c->>'encounterValue')::numeric*4)=(c->>'encounterValue')::numeric*4);
  end if;
  perform table_backend.require(not c ? 'stamina' or table_backend.num(c->'stamina',-1000000000));
  perform table_backend.require(not c ? 'notes' or table_backend.str(c->'notes',50000,true));
  perform table_backend.require(not c ? 'sourceId' or table_backend.str(c->'sourceId'));
  perform table_backend.require(not c ? 'captainId' or table_backend.ident(c->'captainId'));
  perform table_backend.require(jsonb_typeof(c->'conditions') = 'array');
  perform table_backend.require(jsonb_array_length(c->'conditions') <= 100);
  states = '[]'; condition_ids = '{}';
  for s in select value from jsonb_array_elements(c->'conditions') loop
   perform table_backend.require(jsonb_typeof(s) = 'object' and table_backend.ident(s->'id') and not (s->>'id' = any(condition_ids)) and table_backend.str(s->'name') and jsonb_typeof(s->'public') = 'boolean' and table_backend.str(s->'ends',1000,true));
   condition_ids = array_append(condition_ids,s->>'id'); states = states || jsonb_build_array(table_backend.pick(s,array['id','name','public','ends']));
  end loop;
  cs = cs || jsonb_build_array(table_backend.pick(c,array['id','sourceId','name','group','organization','captainId','faction','revealed','turn','reactionUsed','health','stamina','maxStamina','temporaryStamina','count','encounterValue','notes']) || jsonb_build_object('conditions',states));
 end loop;
 for c in select value from jsonb_array_elements(v->'combatants') loop perform table_backend.require(not c ? 'captainId' or c->>'captainId' = any(ids)); end loop;
 for c in select value from jsonb_array_elements(v->'counters') loop
  perform table_backend.require(jsonb_typeof(c) = 'object' and table_backend.ident(c->'id') and not (c->>'id' = any(counter_ids)) and table_backend.str(c->'name') and table_backend.num(c->'value',-1000000000) and (not c ? 'max' or table_backend.num(c->'max')) and jsonb_typeof(c->'public') = 'boolean');
  counter_ids = array_append(counter_ids,c->>'id'); counters = counters || jsonb_build_array(table_backend.pick(c,array['id','name','value','max','public']));
 end loop;
 return table_backend.pick(v,array['id','name','kind','status','published','description','directorNotes','round','initiative','malice','objective']) || jsonb_build_object('combatants',cs,'counters',counters);
end $$;
create function table_backend.number_value(v jsonb) returns jsonb language sql immutable set search_path = pg_catalog as $$
 select case when jsonb_typeof(v)='number' then v else '0'::jsonb end
$$;
create function table_backend.string_value(v jsonb, fallback text default '') returns jsonb language sql immutable set search_path = pg_catalog as $$
 select case when jsonb_typeof(v)='string' then v else to_jsonb(fallback) end
$$;
create function table_backend.hero(doc jsonb, visibility jsonb) returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare result jsonb; section text; keys text[]; sections jsonb = '{}'; notes jsonb = '{}'; n text; states jsonb; resources jsonb;
begin
 if doc is null then return null; end if;
 for section in select jsonb_array_elements_text(visibility->'sections') loop
  keys = case section
   when 'hero' then array['career','subclass','characteristics','size','speed','stability','disengage','kit','secondaryKit','weapon','armor','equipmentEffects','abilities','damageTraits','ancestryTraits','classFeatures']
   when 'development' then array['xp','xpThreshold','epic','victories','perks','skills','languages','culture','careerInfo','advancements','automation']
   when 'inventory' then array['inventory','wealth','renown'] when 'journal' then array['projects'] when 'companions' then array['companions'] else '{}'::text[] end;
  sections = sections || jsonb_build_object(section,table_backend.pick(doc,keys));
 end loop;
 for n in select jsonb_array_elements_text(visibility->'notes') loop
  if jsonb_typeof(doc->'notes'->n) = 'string' then notes = notes || jsonb_build_object(n,doc->'notes'->n); end if;
 end loop;
 select coalesce(jsonb_object_agg(key,table_backend.pick(value,array['active','ends'])),'{}') into states from jsonb_each(case when jsonb_typeof(doc->'conditions')='object' then doc->'conditions' else '{}' end) where jsonb_typeof(value)='object' and jsonb_typeof(value->'active')='boolean' and value->>'ends'=any(array['save','end-turn','next-turn','encounter','until-removed']);
 select coalesce(jsonb_object_agg(key,value),'{}') into resources from jsonb_each(case when jsonb_typeof(doc->'runtime'->'resources')='object' then doc->'runtime'->'resources' else '{}' end) where jsonb_typeof(value)='number';
 result = jsonb_build_object('id',table_backend.string_value(doc->'id'),'name',table_backend.string_value(doc->'name','Без имени'), 'ancestry',table_backend.string_value(doc->'ancestry'),'className',table_backend.string_value(doc->'className'),'level',case when table_backend.num(doc->'level',1) and (doc->>'level')::numeric<=10 then doc->'level' else '1' end,
  'stamina',jsonb_build_object('current',table_backend.number_value(doc->'stamina'->'current'),'max',table_backend.number_value(doc->'stamina'->'max'),'temp',table_backend.number_value(doc->'stamina'->'temp')),
  'resources',jsonb_build_object('heroicResource',jsonb_build_object('name',table_backend.string_value(doc->'heroicResource'->'name'),'current',table_backend.number_value(doc->'heroicResource'->'current'),'max',table_backend.number_value(doc->'heroicResource'->'max')),'surges',table_backend.number_value(doc->'surges'),'heroTokens',table_backend.number_value(doc->'heroTokens'),'recoveries',jsonb_build_object('current',table_backend.number_value(doc->'recoveries'->'current'),'max',table_backend.number_value(doc->'recoveries'->'max')),'additional',resources),
  'conditions',states,'updatedAt',table_backend.string_value(doc->'updatedAt'),'sections',sections,'notes',notes);
 return result;
end $$;
create function table_backend.public_scene(v jsonb) returns jsonb language sql immutable set search_path = pg_catalog as $$
 select table_backend.pick(v,array['id','name','kind','status','published','description','round','initiative','objective']) || jsonb_build_object(
 'combatants',coalesce((select jsonb_agg(table_backend.pick(c,array['id','name','group','organization','faction','revealed','turn','reactionUsed','health']) || jsonb_build_object('conditions',coalesce((select jsonb_agg(table_backend.pick(s,array['id','name','public','ends'])) from jsonb_array_elements(c->'conditions') s where s->'public' = 'true'), '[]'))) from jsonb_array_elements(v->'combatants') c where c->'revealed' = 'true'),'[]'),
 'counters',coalesce((select jsonb_agg(table_backend.pick(c,array['id','name','value','max','public'])) from jsonb_array_elements(v->'counters') c where c->'public' = 'true'),'[]'))
$$;
create function table_backend.is_member(p_id text) returns boolean language sql stable security definer set search_path = pg_catalog as $$
 select auth.uid() is not null and exists(select 1 from table_backend.members where table_id = p_id and user_id = auth.uid())
$$;
create policy table_signals_members on public.table_signals for select to authenticated using (table_backend.is_member(id));
-- RLS needs this single boolean helper; private schema remains unexposed by PostgREST.
grant usage on schema table_backend to authenticated;

create function table_backend.summary(t table_backend.tables) returns jsonb language sql stable set search_path = pg_catalog as $$
 select jsonb_build_object('id',t.id,'name',t.name,'ownerId',t.owner_id,'archived',t.archived,'revision',t.revision,'updatedAt',t.updated_at,'memberCount',(select count(*) from table_backend.members where table_id = t.id))
$$;
create function public.table_list() returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare actor uuid = table_backend.actor(); result jsonb;
begin
 select coalesce(jsonb_agg(table_backend.summary(t) order by t.updated_at desc,t.id),'[]') into result from table_backend.tables t join table_backend.members m on m.table_id=t.id where m.user_id=actor;
 return result;
end $$;
create function public.table_read(p_table_id text) returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare actor uuid = table_backend.actor(); t table_backend.tables; director boolean; result jsonb; members jsonb; scenes jsonb; materials jsonb; events jsonb; offers jsonb; trades jsonb; mine jsonb; visibility jsonb;
begin
 select * into t from table_backend.tables where id=p_table_id;
 if t.id is null or not table_backend.is_member(t.id) then raise exception using errcode='PT404',message='Стол не найден'; end if;
 director = t.owner_id=actor;
 select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'name',m.name,'role',case when m.user_id=t.owner_id then 'director' else 'player' end,'hero',table_backend.hero(case when t.archived then h.snapshot else c.document end,h.visibility)) order by m.user_id),'[]') into members
 from table_backend.members m left join table_backend.heroes h on h.table_id=m.table_id and h.user_id=m.user_id and h.hero_id=m.active_hero_id left join public.characters c on c.user_id=h.user_id and c.id=h.hero_id where m.table_id=t.id;
 select coalesce(jsonb_agg(hero_id order by hero_id),'[]'),coalesce(jsonb_object_agg(hero_id,h.visibility),'{}') into mine,visibility from table_backend.heroes h where table_id=t.id and user_id=actor;
 select coalesce(jsonb_agg(case when director then s else table_backend.public_scene(s) end),'[]') into scenes from jsonb_array_elements(t.scenes) s where director or s->'published'='true' and s->>'status'<>'prepared';
 select coalesce(jsonb_agg(s),'[]') into materials from jsonb_array_elements(t.materials) s where director or s->'public'='true';
 select coalesce(jsonb_agg(s),'[]') into events from jsonb_array_elements(t.events) s where director or s->'public'='true' or s->>'actor'=actor::text;
 select coalesce(jsonb_agg(s),'[]') into offers from jsonb_array_elements(t.offers) s where director or s->>'fromUserId'=actor::text or s->>'toUserId'=actor::text;
 select coalesce(jsonb_agg(s),'[]') into trades from jsonb_array_elements(t.trades) s where s->>'fromUserId'=actor::text or s->>'toUserId'=actor::text;
 result = table_backend.summary(t) || jsonb_build_object('actorId',actor,'members',members,'myHeroIds',mine,'visibility',visibility,'scenes',scenes,'materials',materials,'events',events,'offers',offers,'trades',trades);
 if director then result=result || jsonb_build_object('inviteCode',t.invite_code); end if;
 if t.transfer_to is not null and (director or t.transfer_to=actor) then result=result || jsonb_build_object('transferTo',t.transfer_to); end if;
 return result;
end $$;
create function table_backend.touch(p_id text) returns void language plpgsql set search_path = pg_catalog as $$
declare rev bigint;
begin
 update table_backend.tables set revision=revision+1,updated_at=clock_timestamp() where id=p_id returning revision into rev;
 if found then insert into public.table_signals values(p_id,rev) on conflict(id) do update set revision=excluded.revision; end if;
end $$;
create function table_backend.cancel_for(p_id text, p_user uuid, p_hero text default null) returns void language plpgsql set search_path = pg_catalog as $$
begin
 update table_backend.tables t set
 offers=(select coalesce(jsonb_agg(case when o->>'status'='pending' and (o->>'fromUserId'=p_user::text or o->>'toUserId'=p_user::text) and (p_hero is null or o->>'heroId'=p_hero) then o || jsonb_build_object('status','revoked','version',(o->>'version')::integer+1) else o end),'[]') from jsonb_array_elements(t.offers) o),
 trades=(select coalesce(jsonb_agg(case when o->>'status'='pending' and (o->>'fromUserId'=p_user::text or o->>'toUserId'=p_user::text) and (p_hero is null or o->>'fromHeroId'=p_hero or o->>'toHeroId'=p_hero) then o || '{"status":"cancelled"}' else o end),'[]') from jsonb_array_elements(t.trades) o) where t.id=p_id;
end $$;
-- Character writes signal current tables; deletion removes archived copies as well.
create function table_backend.character_changed() returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare h record;
begin
 if auth.uid() is null and current_setting('role',true)=any(array['anon','authenticated']) then raise exception using errcode='42501',message='Требуется вход'; end if;
 for h in select table_id,user_id,hero_id from table_backend.heroes where user_id=old.user_id and hero_id=old.id order by table_id loop
  if tg_op='DELETE' or new.user_id is distinct from old.user_id or new.id is distinct from old.id then
   perform table_backend.cancel_for(h.table_id,h.user_id,h.hero_id);
   update table_backend.members set active_hero_id=null where table_id=h.table_id and user_id=h.user_id and active_hero_id=h.hero_id;
   delete from table_backend.heroes where user_id=h.user_id and hero_id=h.hero_id;
  else
   perform table_backend.refresh_trades(h.table_id,h.user_id,h.hero_id,old.document,new.document);
  end if;
  perform table_backend.touch(h.table_id);
 end loop;
 return null;
end $$;
create trigger table_character_changed after update or delete on public.characters for each row execute function table_backend.character_changed();
-- Applies to account deletion as well as explicit leave/kick. The FK removes
-- all hero snapshots first; the remaining JSON contains no character documents.
create function table_backend.member_removed() returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
 if auth.uid() is null and current_setting('role',true)=any(array['anon','authenticated']) then raise exception using errcode='42501',message='Требуется вход'; end if;
 perform table_backend.cancel_for(old.table_id,old.user_id);
 update table_backend.tables set transfer_to=null where id=old.table_id and transfer_to=old.user_id;
 perform table_backend.touch(old.table_id);
 return null;
end $$;
create trigger table_member_removed after delete on table_backend.members for each row execute function table_backend.member_removed();

-- Validate a trade's distinct positive quantities. Empty side permits gifts.
create function table_backend.quantities(v jsonb) returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare entry jsonb; ids text[] = '{}'; result jsonb = '[]';
begin
 perform table_backend.require(jsonb_typeof(v)='array');
 perform table_backend.require(jsonb_array_length(v)<=100);
 for entry in select value from jsonb_array_elements(v) loop
  perform table_backend.require(jsonb_typeof(entry)='object' and table_backend.ident(entry->'itemId') and not (entry->>'itemId'=any(ids)) and table_backend.num(entry->'qty',1));
  ids=array_append(ids,entry->>'itemId'); result=result || jsonb_build_array(table_backend.pick(entry,array['itemId','qty']));
 end loop;
 return result;
end $$;
create function table_backend.available(doc jsonb, quantities jsonb) returns void language plpgsql set search_path = pg_catalog as $$
declare q jsonb; i jsonb;
begin
 perform table_backend.require(jsonb_typeof(coalesce(doc->'inventory','[]'))='array');
 for q in select value from jsonb_array_elements(quantities) loop
  if (select count(*) from jsonb_array_elements(doc->'inventory') x where x->>'id'=q->>'itemId') <> 1 then raise exception using errcode='PT409',message='Предмет уже изменён'; end if;
  select x into i from jsonb_array_elements(doc->'inventory') x where x->>'id'=q->>'itemId';
  perform table_backend.item(i);
  if (i->>'qty')::bigint < (q->>'qty')::bigint then raise exception using errcode='PT409',message='Недостаточно предметов'; end if;
 end loop;
end $$;
-- A trade discloses only selected item snapshots to its two participants.
-- Snapshot qty is the offered/requested amount, never the owner's entire stack.
create function table_backend.trade_rows(doc jsonb, quantities jsonb) returns jsonb language plpgsql set search_path = pg_catalog as $$
declare q jsonb; i jsonb; result jsonb='[]';
begin
 perform table_backend.available(doc,quantities);
 for q in select value from jsonb_array_elements(quantities) loop
  select x into i from jsonb_array_elements(doc->'inventory') x where x->>'id'=q->>'itemId';
  result=result || jsonb_build_array(table_backend.pick(q,array['itemId','qty']) || jsonb_build_object('item',table_backend.item(i) || jsonb_build_object('qty',q->'qty')));
 end loop;
 return result;
end $$;
create function table_backend.refresh_trades(p_id text, p_user uuid, p_hero text, before_doc jsonb, after_doc jsonb) returns void language plpgsql set search_path = pg_catalog as $$
declare trade jsonb; q jsonb; old_item jsonb; new_item jsonb; updated_rows jsonb; row_item jsonb; side text; changed boolean; invalid boolean; inventory jsonb; previous_inventory jsonb; item_count integer;
begin
 inventory=case when jsonb_typeof(after_doc->'inventory')='array' then after_doc->'inventory' else '[]' end;
 previous_inventory=case when jsonb_typeof(before_doc->'inventory')='array' then before_doc->'inventory' else '[]' end;
 for trade in select o from table_backend.tables t cross join lateral jsonb_array_elements(t.trades) o where t.id=p_id and o->>'status'='pending' and ((o->>'fromUserId'=p_user::text and o->>'fromHeroId'=p_hero) or (o->>'toUserId'=p_user::text and o->>'toHeroId'=p_hero)) loop
  side=case when trade->>'fromUserId'=p_user::text then 'offered' else 'requested' end;
  changed=false; invalid=false; updated_rows='[]';
  for q in select value from jsonb_array_elements(trade->side) loop
   select x into old_item from jsonb_array_elements(previous_inventory) x where x->>'id'=q->>'itemId';
   select count(*) into item_count from jsonb_array_elements(inventory) x where x->>'id'=q->>'itemId';
   select x into new_item from jsonb_array_elements(inventory) x where x->>'id'=q->>'itemId';
   if old_item is distinct from new_item or item_count<>1 then changed=true; end if;
   row_item=q;
   if item_count<>1 or not table_backend.num(new_item->'qty',1) then invalid=true;
   elsif (new_item->>'qty')::bigint<(q->>'qty')::bigint then invalid=true;
   else
    begin
     row_item=table_backend.pick(q,array['itemId','qty']) || jsonb_build_object('item',table_backend.item(new_item) || jsonb_build_object('qty',q->'qty'));
    exception when sqlstate '22023' then invalid=true;
    end;
   end if;
   updated_rows=updated_rows || jsonb_build_array(row_item);
  end loop;
  if changed then
   trade=jsonb_set(trade,array[side],updated_rows) || jsonb_build_object('confirmations','[]'::jsonb);
   if invalid then trade=trade || '{"status":"cancelled"}'; end if;
   update table_backend.tables t set trades=(select jsonb_agg(case when o->>'id'=trade->>'id' then trade else o end) from jsonb_array_elements(t.trades) o) where t.id=p_id;
  end if;
 end loop;
end $$;
-- Merge only identical UNEQUIPPED stacks. Effects are part of identity;
-- received items never activate equipment implicitly.
create function table_backend.inventory_add(inventory jsonb, item jsonb) returns jsonb language plpgsql set search_path = pg_catalog as $$
declare entry jsonb; result jsonb='[]'; merged boolean=false; incoming jsonb; identity jsonb; quantity bigint;
begin
 perform table_backend.require(jsonb_typeof(inventory)='array');
 incoming=table_backend.item(item) || jsonb_build_object('id',gen_random_uuid()::text,'equipped',false);
 identity=(incoming-array['id','qty','equipped','effects']) || jsonb_build_object('effects',coalesce(incoming->'effects','[]'));
 for entry in select value from jsonb_array_elements(inventory) loop
  if not merged and jsonb_typeof(entry)='object' and coalesce(entry->'equipped','false')='false' and table_backend.num(entry->'qty',1) and table_backend.ident(entry->'id') and ((entry-array['id','qty','equipped','effects']) || jsonb_build_object('effects',coalesce(entry->'effects','[]')))=identity then
   quantity=(entry->>'qty')::bigint+(incoming->>'qty')::bigint;
   perform table_backend.require(quantity<=1000000000);
   entry=entry || jsonb_build_object('qty',quantity,'equipped',false); merged=true;
  end if;
  result=result || jsonb_build_array(entry);
 end loop;
 if not merged then result=result || jsonb_build_array(incoming); end if;
 return result;
end $$;
-- Build BOTH replacement documents before updating either row. New stacks get
-- fresh IDs; identical unequipped stacks can merge without changing effects.
create function table_backend.inventory_move(source jsonb, destination jsonb, quantities jsonb) returns jsonb language plpgsql set search_path = pg_catalog as $$
declare q jsonb; i jsonb; src jsonb=coalesce(source->'inventory','[]'); dst jsonb=coalesce(destination->'inventory','[]'); qty bigint;
begin
 perform table_backend.available(source,quantities);
 perform table_backend.require(jsonb_typeof(dst)='array');
 for q in select value from jsonb_array_elements(quantities) loop
  select x into i from jsonb_array_elements(src) x where x->>'id'=q->>'itemId';
  qty=(q->>'qty')::bigint;
  dst=table_backend.inventory_add(dst,table_backend.item(i) || jsonb_build_object('qty',qty,'equipped',false));
  select coalesce(jsonb_agg(case when x->>'id'=q->>'itemId' then x || jsonb_build_object('qty',(x->>'qty')::bigint-qty) else x end),'[]') into src from jsonb_array_elements(src) x where x->>'id'<>q->>'itemId' or (x->>'qty')::bigint>qty;
 end loop;
 return jsonb_build_object('source',jsonb_set(source,'{inventory}',src),'destination',jsonb_set(destination,'{inventory}',dst));
end $$;
create function table_backend.clone_scene(v jsonb) returns jsonb language plpgsql set search_path = pg_catalog as $$
declare mapping jsonb='{}'; c jsonb; s jsonb; cs jsonb='[]'; states jsonb; counters jsonb='[]';
begin
 for c in select value from jsonb_array_elements(v->'combatants') loop mapping=mapping || jsonb_build_object(c->>'id',gen_random_uuid()::text); end loop;
 for c in select value from jsonb_array_elements(v->'combatants') loop
  states='[]';
  for s in select value from jsonb_array_elements(c->'conditions') loop states=states || jsonb_build_array(s || jsonb_build_object('id',gen_random_uuid()::text)); end loop;
  if c ? 'captainId' then c=jsonb_set(c,'{captainId}',mapping->(c->>'captainId')); end if;
  cs=cs || jsonb_build_array(c || jsonb_build_object('id',mapping->>(c->>'id'),'conditions',states,'turn','ready','reactionUsed',false));
 end loop;
 for c in select value from jsonb_array_elements(v->'counters') loop counters=counters || jsonb_build_array(c || jsonb_build_object('id',gen_random_uuid()::text)); end loop;
 return v || jsonb_build_object('id',gen_random_uuid()::text,'status','active','round',1,'combatants',cs,'counters',counters);
end $$;
create function public.table_command(p_table_id text, p_command jsonb) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
 actor uuid=table_backend.actor(); op text=p_command->>'operationId'; kind text=p_command->>'type'; p jsonb=p_command->'payload';
 original jsonb; cached table_backend.operations; t table_backend.tables; target uuid; director boolean; v jsonb; offer jsonb; trade jsonb; doc jsonb; other_doc jsonb; moved jsonb; first_move jsonb; affected integer;
begin
 perform table_backend.require(jsonb_typeof(p_command)='object' and table_backend.ident(p_command->'operationId') and table_backend.str(p_command->'type',80) and jsonb_typeof(p)='object' and octet_length(p_command::text)<=2097152);
 original=jsonb_build_object('tableId',p_table_id,'command',p_command);
 -- Serialize retries before looking at revisions; no TTL can reapply old trades.
 perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || op,0));
 select * into cached from table_backend.operations where user_id=actor and operation_id=op;
 if found then
  if cached.input<>original then raise exception using errcode='PT409',message='Идентификатор операции уже использован'; end if;
  -- Reproject CURRENT authorized state. A replay never returns a cached private snapshot.
  if cached.result_table_id is null or not exists(select 1 from table_backend.tables where id=cached.result_table_id) then return null; end if;
  if not table_backend.is_member(cached.result_table_id) then raise exception using errcode='PT404',message='Стол не найден'; end if;
  return public.table_read(cached.result_table_id);
 end if;
 if kind='create' then
  perform table_backend.require(p_table_id is null and table_backend.str(p->'name') and table_backend.str(p->'memberName'));
  insert into table_backend.tables(id,name,owner_id,invite_code) values(gen_random_uuid()::text,btrim(p->>'name'),actor,gen_random_uuid()::text) returning * into t;
  insert into table_backend.members(table_id,user_id,name) values(t.id,actor,btrim(p->>'memberName'));
  insert into public.table_signals values(t.id,t.revision);
 elsif kind='join' then
  perform table_backend.require(p_table_id is null and table_backend.str(p->'inviteCode',80) and table_backend.str(p->'memberName'));
  select * into t from table_backend.tables where invite_code=p->>'inviteCode' for update;
  if t.id is null or actor=any(t.blocked) then raise exception using errcode='PT404',message='Приглашение недоступно'; end if;
  if t.archived then raise exception using errcode='PT409',message='Стол в архиве'; end if;
  if not table_backend.is_member(t.id) then
   if (select count(*) from table_backend.members where table_id=t.id)>=10 then raise exception using errcode='PT409',message='За столом уже десять участников'; end if;
   insert into table_backend.members(table_id,user_id,name) values(t.id,actor,btrim(p->>'memberName'));
   perform table_backend.touch(t.id);
  end if;
 else
  perform table_backend.require(table_backend.ident(to_jsonb(p_table_id)) and table_backend.num(p_command->'expectedRevision',1));
  select * into t from table_backend.tables where id=p_table_id for update;
  if t.id is null or not table_backend.is_member(t.id) then raise exception using errcode='PT404',message='Стол не найден'; end if;
  if t.revision<>(p_command->>'expectedRevision')::bigint then raise exception using errcode='PT409',message='Конфликт версии стола. Обновите данные'; end if;
  director=t.owner_id=actor;
  if t.archived and kind<>all(array['archive','leave','visibility','delete','transfer','accept-transfer']) then raise exception using errcode='PT409',message='Стол в архиве'; end if;
  if kind=any(array['rename','rotate-invite','archive','kick','allow-member','delete','transfer','remove-hero','save-scene','delete-scene','start-scene','save-material','delete-material','offer-item']) and not director then raise exception using errcode='42501',message='Действие доступно ведущему'; end if;
  case kind
   when 'rename' then
    perform table_backend.require(table_backend.str(p->'name'));
    update table_backend.tables set name=btrim(p->>'name') where id=t.id;
   when 'rotate-invite' then update table_backend.tables set invite_code=gen_random_uuid()::text where id=t.id;
   when 'archive' then
    perform table_backend.require(jsonb_typeof(p->'archived')='boolean');
    if not t.archived and p->'archived'='true' then
     update table_backend.heroes h set snapshot=c.document from public.characters c where h.table_id=t.id and c.user_id=h.user_id and c.id=h.hero_id;
    end if;
    update table_backend.tables set archived=(p->>'archived')::boolean where id=t.id;
   when 'delete' then
    delete from table_backend.tables where id=t.id;
   when 'transfer' then
    target=(p->>'userId')::uuid;
    if target=actor or not exists(select 1 from table_backend.members where table_id=t.id and user_id=target) then raise exception using errcode='22023',message='Участник не найден'; end if;
    update table_backend.tables set transfer_to=target where id=t.id;
   when 'accept-transfer' then
    if t.transfer_to is distinct from actor then raise exception using errcode='42501',message='Передача роли недоступна'; end if;
    perform table_backend.cancel_for(t.id,actor);
    delete from table_backend.heroes where table_id=t.id and user_id=actor;
    update table_backend.members set active_hero_id=null where table_id=t.id and user_id=actor;
    update table_backend.tables set owner_id=actor,transfer_to=null where id=t.id;
   when 'leave', 'kick' then
    target=case when kind='leave' then actor else (p->>'userId')::uuid end;
    if target=t.owner_id then raise exception using errcode='PT409',message='Сначала передайте роль ведущего или удалите стол'; end if;
    if not exists(select 1 from table_backend.members where table_id=t.id and user_id=target) then raise exception using errcode='PT404',message='Участник не найден'; end if;
    perform table_backend.cancel_for(t.id,target);
    delete from table_backend.members where table_id=t.id and user_id=target;
    update table_backend.tables set transfer_to=case when transfer_to=target then null else transfer_to end,blocked=case when kind='kick' then array_append(blocked,target) else blocked end where id=t.id;
   when 'allow-member' then
    perform table_backend.require(jsonb_typeof(p->'userId')='string' and p->>'userId' is not null);
    target=(p->>'userId')::uuid;
    update table_backend.tables set blocked=array_remove(blocked,target) where id=t.id;
   when 'attach-hero' then
    if director then raise exception using errcode='42501',message='Ведущий не добавляет своего героя'; end if;
    perform table_backend.require(table_backend.ident(p->'heroId'));
    v=table_backend.visibility(p->'visibility');
    -- Same actor hero is unique across all tables; serialize attachment races.
    perform pg_advisory_xact_lock(hashtextextended('hero:' || actor::text || ':' || (p->>'heroId'),0));
    select document into doc from public.characters where user_id=actor and id=p->>'heroId' for update;
    if not found then raise exception using errcode='PT404',message='Герой не найден'; end if;
    if exists(select 1 from table_backend.heroes where user_id=actor and hero_id=p->>'heroId') then raise exception using errcode='PT409',message='Герой уже за столом'; end if;
    insert into table_backend.heroes values(t.id,actor,p->>'heroId',v,null);
    update table_backend.members set active_hero_id=coalesce(active_hero_id,p->>'heroId') where table_id=t.id and user_id=actor;
   when 'activate-hero' then
    perform table_backend.require(table_backend.ident(p->'heroId'));
    if director or not exists(select 1 from table_backend.heroes where table_id=t.id and user_id=actor and hero_id=p->>'heroId') then raise exception using errcode='PT404',message='Герой не найден'; end if;
    update table_backend.members set active_hero_id=p->>'heroId' where table_id=t.id and user_id=actor;
   when 'remove-hero' then
    target=(p->>'userId')::uuid;
    perform table_backend.require(table_backend.ident(p->'heroId'));
    if not exists(select 1 from table_backend.heroes where table_id=t.id and user_id=target and hero_id=p->>'heroId') then raise exception using errcode='PT404',message='Герой не найден'; end if;
    perform table_backend.cancel_for(t.id,target,p->>'heroId');
    delete from table_backend.heroes where table_id=t.id and user_id=target and hero_id=p->>'heroId';
    update table_backend.members set active_hero_id=null where table_id=t.id and user_id=target and active_hero_id=p->>'heroId';
   when 'visibility' then
    perform table_backend.require(table_backend.ident(p->'heroId'));
    v=table_backend.visibility(p->'visibility');
    update table_backend.heroes set visibility=v where table_id=t.id and user_id=actor and hero_id=p->>'heroId';
    if not found then raise exception using errcode='PT404',message='Герой не найден'; end if;
   when 'save-scene' then
    v=table_backend.scene(p->'scene');
    update table_backend.tables set scenes=(select coalesce(jsonb_agg(s),'[]') from jsonb_array_elements(t.scenes) s where s->>'id'<>v->>'id') || jsonb_build_array(v) where id=t.id;
   when 'delete-scene' then
    perform table_backend.require(table_backend.ident(p->'sceneId'));
    update table_backend.tables set scenes=(select coalesce(jsonb_agg(s),'[]') from jsonb_array_elements(t.scenes) s where s->>'id'<>p->>'sceneId') where id=t.id;
   when 'start-scene' then
    perform table_backend.require(table_backend.ident(p->'sceneId'));
    select s into v from jsonb_array_elements(t.scenes) s where s->>'id'=p->>'sceneId';
    if v is null then raise exception using errcode='PT404',message='Сцена не найдена'; end if;
    update table_backend.tables set scenes=scenes || jsonb_build_array(table_backend.clone_scene(v)) where id=t.id;
   when 'save-material' then
    v=p->'material';
    perform table_backend.require(jsonb_typeof(v)='object' and table_backend.ident(v->'id') and table_backend.str(v->'title') and table_backend.str(v->'text',50000,true) and jsonb_typeof(v->'public')='boolean');
    v=table_backend.pick(v,array['id','title','text','public']);
    update table_backend.tables set materials=(select coalesce(jsonb_agg(s),'[]') from jsonb_array_elements(t.materials) s where s->>'id'<>v->>'id') || jsonb_build_array(v) where id=t.id;
   when 'delete-material' then
    perform table_backend.require(table_backend.ident(p->'materialId'));
    update table_backend.tables set materials=(select coalesce(jsonb_agg(s),'[]') from jsonb_array_elements(t.materials) s where s->>'id'<>p->>'materialId') where id=t.id;
   when 'event' then
    perform table_backend.require(table_backend.str(p->'text',10000) and jsonb_typeof(p->'public')='boolean' and table_backend.str(p->'kind',80));
    if not director and p->>'kind'<>all(array['message','roll']) then raise exception using errcode='42501',message='Игрок может публиковать сообщения и броски'; end if;
    -- Actor is always auth.uid(). Never interpolate scene or character JSON in logs.
    v=jsonb_build_object('id',gen_random_uuid()::text,'at',clock_timestamp(),'actor',actor,'text',p->>'text','public',p->'public','kind',p->>'kind');
    update table_backend.tables set events=events || jsonb_build_array(v) where id=t.id;
   when 'offer-item' then
    target=(p->>'toUserId')::uuid;
    perform table_backend.require(table_backend.ident(p->'heroId') and (not p ? 'templateId' or table_backend.ident(p->'templateId')));
    if target=t.owner_id or not exists(select 1 from table_backend.heroes where table_id=t.id and user_id=target and hero_id=p->>'heroId') then raise exception using errcode='PT404',message='Герой не найден'; end if;
    v=table_backend.item(p->'item');
    if p ? 'templateId' then
     perform pg_advisory_xact_lock(hashtextextended('template:' || actor::text || ':' || (p->>'templateId'),0));
     select document into offer from table_backend.templates where user_id=actor and id=p->>'templateId';
     if offer is null or offer->>'kind'<>'item' then raise exception using errcode='PT404',message='Заготовка не найдена'; end if;
     v=(v-'effects') || table_backend.pick(offer->'item',array['effects']);
    end if;
    offer=jsonb_build_object('id',gen_random_uuid()::text,'fromUserId',actor,'heroId',p->>'heroId','toUserId',target,'item',v || '{"equipped":false}','status','pending','version',1);
    if p ? 'templateId' then offer=offer || jsonb_build_object('templateId',p->>'templateId'); end if;
    update table_backend.tables set offers=offers || jsonb_build_array(offer) where id=t.id;
   when 'answer-offer' then
    perform table_backend.require(table_backend.ident(p->'offerId') and jsonb_typeof(p->'accept')='boolean' and table_backend.num(p->'version',1));
    select s into offer from jsonb_array_elements(t.offers) s where s->>'id'=p->>'offerId';
    if offer is null or offer->>'toUserId'<>actor::text then raise exception using errcode='PT404',message='Предложение не найдено'; end if;
    if offer->>'status'<>'pending' or offer->'version'<>p->'version' then raise exception using errcode='PT409',message='Предложение уже изменено'; end if;
    if p->'accept'='true' then
     if not exists(select 1 from table_backend.heroes where table_id=t.id and user_id=actor and hero_id=offer->>'heroId') then raise exception using errcode='PT404',message='Герой не найден'; end if;
     select document into doc from public.characters where user_id=actor and id=offer->>'heroId' for update;
     if not found then raise exception using errcode='PT404',message='Герой не найден'; end if;
     perform table_backend.require(jsonb_typeof(coalesce(doc->'inventory','[]'))='array');
     doc=jsonb_set(doc,'{inventory}',table_backend.inventory_add(coalesce(doc->'inventory','[]'),offer->'item'));
     update public.characters set document=doc || jsonb_build_object('updatedAt',clock_timestamp()),updated_at=clock_timestamp() where user_id=actor and id=offer->>'heroId';
    end if;
    offer=offer || jsonb_build_object('status',case when p->'accept'='true' then 'accepted' else 'declined' end,'version',(offer->>'version')::integer+1);
    update table_backend.tables set offers=(select jsonb_agg(case when s->>'id'=offer->>'id' then offer else s end) from jsonb_array_elements(offers) s) where id=t.id;
   when 'revoke-offer' then
    perform table_backend.require(table_backend.ident(p->'offerId'));
    select s into offer from jsonb_array_elements(t.offers) s where s->>'id'=p->>'offerId';
    if offer is null or offer->>'fromUserId'<>actor::text then raise exception using errcode='PT404',message='Предложение не найдено'; end if;
    if offer->>'status'<>'pending' then raise exception using errcode='PT409',message='Предложение уже изменено'; end if;
    update table_backend.tables set offers=(select jsonb_agg(case when s->>'id'=offer->>'id' then s || jsonb_build_object('status','revoked','version',(s->>'version')::integer+1) else s end) from jsonb_array_elements(offers) s) where id=t.id;
   when 'create-trade' then
    target=(p->>'toUserId')::uuid;
    perform table_backend.require(table_backend.ident(p->'fromHeroId') and table_backend.ident(p->'toHeroId'));
    if director or target=actor or target=t.owner_id or not exists(select 1 from table_backend.heroes where table_id=t.id and user_id=actor and hero_id=p->>'fromHeroId') or not exists(select 1 from table_backend.heroes where table_id=t.id and user_id=target and hero_id=p->>'toHeroId') then raise exception using errcode='PT404',message='Участник обмена не найден'; end if;
    -- Other player's inventory must already be shared to propose requested IDs.
    if not exists(select 1 from table_backend.heroes where table_id=t.id and user_id=target and hero_id=p->>'toHeroId' and visibility->'sections' ? 'inventory') and p->'requested'<>'[]' then raise exception using errcode='42501',message='Инвентарь закрыт'; end if;
    v=table_backend.quantities(p->'offered'); offer=table_backend.quantities(p->'requested');
    perform table_backend.require(jsonb_array_length(v)+jsonb_array_length(offer)>0);
    perform 1 from public.characters where (user_id=actor and id=p->>'fromHeroId') or (user_id=target and id=p->>'toHeroId') order by user_id,id for update;
    get diagnostics affected=row_count;
    if affected<>2 then raise exception using errcode='PT404',message='Герой не найден'; end if;
    select document into doc from public.characters where user_id=actor and id=p->>'fromHeroId';
    select document into other_doc from public.characters where user_id=target and id=p->>'toHeroId';
    v=table_backend.trade_rows(doc,v); offer=table_backend.trade_rows(other_doc,offer);
    trade=jsonb_build_object('id',gen_random_uuid()::text,'fromUserId',actor,'toUserId',target,'fromHeroId',p->>'fromHeroId','toHeroId',p->>'toHeroId','offered',v,'requested',offer,'confirmations','[]'::jsonb,'status','pending');
    update table_backend.tables set trades=trades || jsonb_build_array(trade) where id=t.id;
   when 'confirm-trade', 'cancel-trade' then
    perform table_backend.require(table_backend.ident(p->'tradeId'));
    select s into trade from jsonb_array_elements(t.trades) s where s->>'id'=p->>'tradeId';
    if trade is null or actor::text<>all(array[trade->>'fromUserId',trade->>'toUserId']) then raise exception using errcode='PT404',message='Обмен не найден'; end if;
    if trade->>'status'<>'pending' then raise exception using errcode='PT409',message='Обмен уже изменён'; end if;
    if kind='cancel-trade' then trade=trade || '{"status":"cancelled"}';
    else
     if not (trade->'confirmations' ? actor::text) then trade=jsonb_set(trade,'{confirmations}',trade->'confirmations' || to_jsonb(actor::text)); end if;
     if jsonb_array_length(trade->'confirmations')=2 then
      if not exists(select 1 from table_backend.heroes where table_id=t.id and user_id=(trade->>'fromUserId')::uuid and hero_id=trade->>'fromHeroId') or not exists(select 1 from table_backend.heroes where table_id=t.id and user_id=(trade->>'toUserId')::uuid and hero_id=trade->>'toHeroId') then raise exception using errcode='PT404',message='Герой не найден'; end if;
      -- Global row order prevents opposing exchanges from locking in reverse order.
      perform 1 from public.characters where (user_id=(trade->>'fromUserId')::uuid and id=trade->>'fromHeroId') or (user_id=(trade->>'toUserId')::uuid and id=trade->>'toHeroId') order by user_id,id for update;
      get diagnostics affected=row_count;
      if affected<>2 then raise exception using errcode='PT404',message='Герой не найден'; end if;
      select document into doc from public.characters where user_id=(trade->>'fromUserId')::uuid and id=trade->>'fromHeroId';
      select document into other_doc from public.characters where user_id=(trade->>'toUserId')::uuid and id=trade->>'toHeroId';
      perform table_backend.available(doc,trade->'offered'); perform table_backend.available(other_doc,trade->'requested');
      first_move=table_backend.inventory_move(doc,other_doc,trade->'offered');
      moved=table_backend.inventory_move(first_move->'destination',first_move->'source',trade->'requested');
      update public.characters set document=case when user_id=(trade->>'fromUserId')::uuid then moved->'destination' else moved->'source' end || jsonb_build_object('updatedAt',clock_timestamp()), updated_at=clock_timestamp()
       where (user_id=(trade->>'fromUserId')::uuid and id=trade->>'fromHeroId') or (user_id=(trade->>'toUserId')::uuid and id=trade->>'toHeroId');
      trade=trade || '{"status":"accepted"}';
     end if;
    end if;
    update table_backend.tables set trades=(select jsonb_agg(case when s->>'id'=trade->>'id' then trade else s end) from jsonb_array_elements(trades) s) where id=t.id;
   else raise exception using errcode='22023',message='Неизвестная команда';
  end case;
  if kind<>'delete' then perform table_backend.touch(t.id); end if;
 end if;
 insert into table_backend.operations values(actor,op,original,case when kind='delete' or kind='leave' then null else t.id end);
 if kind='delete' or kind='leave' then return null; end if;
 return public.table_read(t.id);
exception when invalid_text_representation or numeric_value_out_of_range then
 raise exception using errcode='22023',message='Некорректные данные';
end $$;
create function public.table_templates() returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare actor uuid=table_backend.actor(); result jsonb;
begin select coalesce(jsonb_agg(document order by id),'[]') into result from table_backend.templates where user_id=actor; return result; end $$;
create function public.table_template_save(p_template jsonb) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare actor uuid=table_backend.actor(); old jsonb; result jsonb; related record; changed integer;
begin
 perform table_backend.require(jsonb_typeof(p_template)='object' and table_backend.ident(p_template->'id') and table_backend.str(p_template->'name') and p_template->>'kind'=any(array['scene','item']) and table_backend.num(p_template->'version') and octet_length(p_template::text)<=2097152);
 perform pg_advisory_xact_lock(hashtextextended('template:' || actor::text || ':' || (p_template->>'id'),0));
 select document into old from table_backend.templates where user_id=actor and id=p_template->>'id' for update;
 perform table_backend.require(old is null or old->>'kind'=p_template->>'kind');
 if coalesce(old->>'version','0')::bigint<>(p_template->>'version')::bigint then raise exception using errcode='PT409',message='Заготовка уже изменена'; end if;
 result=table_backend.pick(p_template,array['id','name','kind']) || jsonb_build_object('version',(p_template->>'version')::bigint+1);
 if p_template->>'kind'='scene' then result=result || jsonb_build_object('scene',table_backend.scene(p_template->'scene'));
 else result=result || jsonb_build_object('item',table_backend.item(p_template->'item')); end if;
 insert into table_backend.templates values(actor,p_template->>'id',result) on conflict(user_id,id) do update set document=excluded.document;
 if result->>'kind'='item' then
  -- Offer prose/quantity/category are snapshots. Only effects track a pending
  -- template, and a recipient must acknowledge the resulting offer version.
  for related in select t.id from table_backend.tables t where exists(select 1 from jsonb_array_elements(t.offers) o where o->>'fromUserId'=actor::text and o->>'templateId'=p_template->>'id' and o->>'status'='pending') order by t.id for update loop
   update table_backend.tables t set offers=(select jsonb_agg(case when o->>'fromUserId'=actor::text and o->>'templateId'=p_template->>'id' and o->>'status'='pending' and coalesce(o->'item'->'effects','[]')<>coalesce(result->'item'->'effects','[]') then o || jsonb_build_object('item',((o->'item')-'effects') || table_backend.pick(result->'item',array['effects']),'version',(o->>'version')::integer+1) else o end) from jsonb_array_elements(t.offers) o)
    where t.id=related.id and exists(select 1 from jsonb_array_elements(t.offers) o where o->>'fromUserId'=actor::text and o->>'templateId'=p_template->>'id' and o->>'status'='pending' and coalesce(o->'item'->'effects','[]')<>coalesce(result->'item'->'effects','[]'));
   get diagnostics changed=row_count;
   if changed>0 then perform table_backend.touch(related.id); end if;
  end loop;
 end if;
 return result;
end $$;
create function public.table_template_delete(p_id text) returns void language plpgsql security definer set search_path = pg_catalog as $$
declare actor uuid=table_backend.actor();
begin
 perform table_backend.require(table_backend.ident(to_jsonb(p_id)));
 perform pg_advisory_xact_lock(hashtextextended('template:' || actor::text || ':' || p_id,0));
 delete from table_backend.templates where user_id=actor and id=p_id;
end $$;

-- Functions default to PUBLIC EXECUTE in PostgreSQL: explicitly close every helper.
revoke all on all functions in schema table_backend from public, anon, authenticated;
grant execute on function table_backend.is_member(text) to authenticated;
revoke all on function public.table_list(), public.table_read(text), public.table_command(text,jsonb), public.table_templates(), public.table_template_save(jsonb), public.table_template_delete(text) from public, anon, authenticated;
grant execute on function public.table_list(), public.table_read(text), public.table_command(text,jsonb), public.table_templates(), public.table_template_save(jsonb), public.table_template_delete(text) to authenticated;
-- Only id/revision notifications enter Realtime. Existing characters publication is untouched.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.table_signals;
 end if;
end $$;
commit;
