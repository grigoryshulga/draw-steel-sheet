-- Starting or resuming a scene preserves its identity and progress.
create or replace function public.table_command(p_table_id text, p_command jsonb) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
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
    update table_backend.tables set scenes=(select coalesce(jsonb_agg(
      case when s->>'id'=p->>'sceneId' then jsonb_set(s,'{status}','"active"'::jsonb) else s end order by ord
    ),'[]'::jsonb) from jsonb_array_elements(t.scenes) with ordinality as rows(s,ord)) where id=t.id;
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
