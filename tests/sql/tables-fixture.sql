\set ON_ERROR_STOP on
\o /dev/null
-- This file is a disposable database fixture, never a production migration.
insert into auth.users select ('00000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid from generate_series(1,12) i;
create function public.test_assert(ok boolean, label text) returns void language plpgsql as $$ begin if ok is not true then raise exception 'Assertion failed: %',label; end if; end $$;
-- SECURITY INVOKER helpers run with the actual authenticated role/RLS.
create function public.test_command(t text, typ text, payload jsonb default '{}', op text default null) returns jsonb language plpgsql as $$
declare rev bigint;
begin
 if t is not null then rev=(public.table_read(t)->>'revision')::bigint; end if;
 return public.table_command(t,jsonb_build_object('type',typ,'payload',payload,'operationId',coalesce(op,gen_random_uuid()::text),'expectedRevision',rev));
end $$;
create function public.test_denied(statement text, expected text default null) returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if expected is not null and sqlstate<>expected then raise exception 'Unexpected error code: %, expected %, message %',sqlstate,expected,sqlerrm; end if;
  return;
 end;
 raise exception 'Statement unexpectedly succeeded';
end $$;
grant execute on function public.test_assert(boolean,text),public.test_command(text,text,jsonb,text),public.test_denied(text,text) to authenticated,anon;
set role anon;
select public.test_denied('select public.table_list()', '42501');
select public.test_denied('select * from public.table_signals', '42501');
reset role;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
set request.jwt.claim.sub='';
select public.test_denied('select public.table_list()','42501');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_denied('select * from table_backend.tables','42501');
select public.test_denied('select * from table_backend.heroes','42501');
select public.test_denied('select table_backend.touch(''x'')','42501');
select public.test_command(null,'create','{"name":"Campaign","memberName":"DM"}','create-campaign') as created \gset
select :'created'::jsonb->>'id' as tid, :'created'::jsonb->>'inviteCode' as invite \gset
select public.test_assert(public.table_command(null,'{"type":"create","payload":{"name":"Campaign","memberName":"DM"},"operationId":"create-campaign","expectedRevision":null}')->>'id'=:'tid','create replay');
select public.test_denied('select public.table_command(null,''{"type":"create","payload":{"name":"Other","memberName":"DM"},"operationId":"create-campaign"}'')','PT409');
select public.test_command(:'tid','rotate-invite') as rotated \gset
select :'rotated'::jsonb->>'inviteCode' as invite_new \gset
select public.test_assert(:'invite'<>:'invite_new','invite rotates');
select public.test_command(:'tid','save-scene','{"scene":{"id":"prep","name":"Secret preparation","kind":"encounter","status":"prepared","published":true,"description":"Public description","directorNotes":"SECRET-DM","round":1,"initiative":"heroes","malice":17,"combatants":[{"id":"visible","sourceId":"catalog-secret","name":"Goblin","group":"A","organization":"squad","faction":"enemy","revealed":true,"turn":"ready","reactionUsed":false,"conditions":[{"id":"hidden-state","name":"SECRET-CONDITION","public":false,"ends":""},{"id":"public-state","name":"Burning","public":true,"ends":"round"}],"health":"hurt","stamina":37,"maxStamina":65,"temporaryStamina":5,"count":3,"encounterValue":0.75,"notes":"SECRET-MONSTER"},{"id":"hidden","name":"SECRET-AMBUSH","group":"B","organization":"squad","faction":"enemy","revealed":false,"turn":"ready","reactionUsed":false,"conditions":[],"health":"healthy","stamina":99}],"counters":[{"id":"hidden-count","name":"SECRET-COUNTER","value":17,"public":false},{"id":"public-count","name":"Successes","value":2,"public":true}],"objective":"Escape"}}');
select public.test_command(:'tid','start-scene','{"sceneId":"prep"}') as started \gset
select public.test_assert(jsonb_array_length(:'started'::jsonb->'scenes')=1,'start does not copy');
select public.test_assert(:'started'::jsonb#>>'{scenes,0,combatants,0,encounterValue}'='0.75','fractional minion encounter value preserved');
select public.test_assert(:'started'::jsonb#>>'{scenes,0,id}'='prep' and :'started'::jsonb#>>'{scenes,0,status}'='active','starts original scene');
select public.test_assert(:'started'::jsonb#>>'{scenes,0,combatants,0,id}'='visible' and :'started'::jsonb#>>'{scenes,0,combatants,0,stamina}'='37','start preserves identities and progress');
select public.test_command(:'tid','save-material','{"material":{"id":"private","title":"SECRET-MATERIAL","text":"hidden","public":false}}');
select public.test_command(:'tid','event','{"text":"SECRET-EVENT","public":false,"kind":"note"}');
select public.test_command(:'tid','event','{"text":"Round started","public":true,"kind":"message"}');
select public.table_template_save('{"id":"gift-template","name":"Gift","kind":"item","version":0,"item":{"id":"gift","name":"Sword","category":"gear","qty":1,"notes":"gift","equipped":true,"effects":[{"field":"stamina","value":3}]}}');
select public.test_denied('select public.table_template_save(''{"id":"gift-template","name":"Gift","kind":"item","version":0,"item":{}}'')','PT409');
select public.test_command(null,'create','{"name":"Concurrency","memberName":"DM"}');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert(public.table_list()='[]','nonmember list empty');
select public.test_denied(format('select public.table_read(%L)',:'tid'),'PT404');
select public.test_denied(format('select public.test_command(null,''join'',%L)',jsonb_build_object('inviteCode',:'invite','memberName','A')),'PT404');
select public.test_command(null,'join',jsonb_build_object('inviteCode',:'invite_new','memberName','A'));
insert into public.characters(user_id,id,document) values(auth.uid(),'a','{"id":"a","name":"Alice","notes":{"secrets":"SECRET-HERO","story":"Story"},"inventory":[{"id":"potion","name":"Potion","category":"consumable","qty":5,"notes":"Potion description","equipped":true,"effects":[{"field":"save","value":1}]}],"stamina":{"current":20,"max":30,"temp":0,"notes":"SECRET-NESTED"},"conditions":{"slowed":{"active":true,"ends":"save","notes":"SECRET-CONDITION-NOTE"}},"runtime":{"resources":{"drama":2,"secret":{"notes":"SECRET-RESOURCE"}}},"updatedAt":"before archive"}');
insert into public.characters(user_id,id,document) values(auth.uid(),'a2','{"id":"a2","name":"Other Alice","inventory":[]}');
select public.test_command(:'tid','attach-hero','{"heroId":"a"}');
select public.test_command(:'tid','attach-hero','{"heroId":"a2","visibility":{"sections":[],"notes":[]}}');
select public.test_assert(public.table_read(:'tid')->'myHeroIds'='["a","a2"]','own hero ids');
select public.table_read(:'tid') as player_view \gset
select public.test_assert(:'player_view' !~ 'SECRET-|stamina": 37|maxStamina|temporaryStamina|encounterValue|catalog-secret|malice|inviteCode','secrets absent from entire serialized player snapshot');
select public.test_assert(jsonb_array_length(:'player_view'::jsonb->'scenes')=1,'prepared scenes private');
select public.test_assert(jsonb_array_length(:'player_view'::jsonb#>'{scenes,0,combatants}')=1,'hidden creatures omitted');
select public.test_assert(:'player_view'::jsonb#>>'{scenes,0,combatants,0,conditions,0,name}'='Burning','public condition remains');
select public.test_denied(format('select public.test_command(%L,''rename'',''{"name":"Spoof"}'')',:'tid'),'42501');
select public.test_denied(format('select public.test_command(%L,''event'',''{"text":"spoof","public":true,"kind":"dm"}'')',:'tid'),'42501');
select public.table_read(:'tid')->>'revision' as event_rev \gset
select jsonb_build_object('type','event','operationId','player-event','expectedRevision',:'event_rev'::bigint,'payload','{"text":"Player roll","public":true,"kind":"roll","actor":"SPOOF","stamina":999}'::jsonb) as player_event_command \gset
select public.table_command(:'tid',:'player_event_command') as player_event \gset
select public.test_assert(:'player_event'::jsonb#>>'{events,1,actor}'=auth.uid()::text,'event actor cannot be spoofed');
select public.test_assert(jsonb_array_length(public.table_templates())=0,'templates private');
select public.test_assert((select count(*) from public.table_signals)=1,'signals filtered to joined tables');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.test_command(null,'join',jsonb_build_object('inviteCode',:'invite_new','memberName','B'));
insert into public.characters(user_id,id,document) values(auth.uid(),'b','{"id":"b","name":"Bob","inventory":[{"id":"gem","name":"Gem","category":"treasure","qty":3,"notes":"Gem description","equipped":true,"effects":[{"field":"stamina","value":2}]}]}');
select public.test_denied(format('select public.test_command(%L,''attach-hero'',''{"heroId":"a"}'')',:'tid'),'PT404');
select public.test_command(:'tid','attach-hero','{"heroId":"b"}');
select public.test_assert((select count(*) from public.characters)=1,'RLS only own character');
select public.test_denied(format('select public.test_command(%L,''visibility'',''{"heroId":"a","visibility":{"sections":[],"notes":[]}}'')',:'tid'),'PT404');
select public.test_denied(format('select public.table_command(%L,''{"type":"rename","payload":{"name":"Stale"},"operationId":"stale","expectedRevision":1}'')',:'tid'),'PT409');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(:'tid','offer-item','{"heroId":"a","toUserId":"00000000-0000-0000-0000-000000000002","item":{"id":"new-sword","name":"Sword","category":"gear","qty":1,"notes":"","equipped":true},"templateId":"gift-template"}') as with_offer \gset
select :'with_offer'::jsonb#>>'{offers,0,id}' as offer_id \gset
select public.test_command(:'tid','archive','{"archived":true}');
select public.table_template_save('{"id":"gift-template","name":"Renamed template","kind":"item","version":1,"item":{"id":"gift","name":"Renamed item","category":"treasure","qty":9,"notes":"CHANGED-PROSE","equipped":true,"effects":[{"field":"speed","value":2}]}}');
select public.table_read(:'tid') as edited_offer \gset
select public.test_assert(:'edited_offer'::jsonb#>>'{offers,0,version}'='2' and :'edited_offer'::jsonb#>>'{offers,0,item,name}'='Sword' and :'edited_offer'::jsonb#>>'{offers,0,item,notes}'='' and :'edited_offer'::jsonb#>>'{offers,0,item,qty}'='1' and :'edited_offer'::jsonb#>>'{offers,0,item,category}'='gear','template edit updates pending effects/version only');
select public.test_assert(:'edited_offer'::jsonb#>'{offers,0,item,effects}'='[{"field":"speed","value":2}]','pending effects revised');
select public.test_denied('select public.table_template_save(''{"id":"invalid","name":"Invalid","kind":"item","version":0,"item":{"id":"x","name":"x","category":"gear","qty":1,"notes":"","equipped":false,"effects":[{"field":"script","value":1}]}}'')','22023');
select public.test_denied('select public.table_template_save(''{"id":"invalid","name":"Invalid","kind":"item","version":0,"item":{"id":"x","name":"x","category":"gear","qty":1,"notes":"","equipped":false,"effects":[{"field":"save","value":101}]}}'')','22023');
select public.test_denied('select public.table_template_save(''{"id":"invalid","name":"Invalid","kind":"item","version":0,"item":{"id":"x","name":"x","category":"gear","qty":1,"notes":"","equipped":false,"effects":[{"field":"save","value":1,"script":"bad"}]}}'')','22023');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_denied(format('select public.test_command(%L,''answer-offer'',%L)',:'tid',jsonb_build_object('offerId',:'offer_id','accept',true,'version',2)),'PT409');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(:'tid','archive','{"archived":false}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.test_denied(format('select public.test_command(%L,''answer-offer'',%L)',:'tid',jsonb_build_object('offerId',:'offer_id','accept',true,'version',1)),'PT404');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_denied(format('select public.test_command(%L,''answer-offer'',%L)',:'tid',jsonb_build_object('offerId',:'offer_id','accept',true,'version',1)),'PT409');
select public.test_command(:'tid','answer-offer',jsonb_build_object('offerId',:'offer_id','accept',true,'version',2),'accept-gift') as accepted \gset
select public.test_assert((select jsonb_array_length(document->'inventory')=2 and document#>'{inventory,1,equipped}'='false' from public.characters where id='a'),'accepted gift unequipped');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.table_template_save('{"id":"gift-template","name":"Renamed template","kind":"item","version":2,"item":{"id":"gift","name":"Renamed item","category":"treasure","qty":9,"notes":"CHANGED-PROSE","equipped":false,"effects":[{"field":"stamina","value":8}]}}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert((select document#>'{inventory,1,effects}'='[{"field":"speed","value":2}]' from public.characters where id='a'),'accepted effects remain independent of template');

select public.test_command(:'tid','create-trade','{"toUserId":"00000000-0000-0000-0000-000000000003","fromHeroId":"a","toHeroId":"b","offered":[{"itemId":"potion","qty":2}],"requested":[{"itemId":"gem","qty":1}]}') as with_trade \gset
select :'with_trade'::jsonb#>>'{trades,0,id}' as trade_id \gset
select public.test_assert(:'with_trade'::jsonb#>>'{trades,0,offered,0,item,name}'='Potion' and :'with_trade'::jsonb#>>'{trades,0,offered,0,item,qty}'='2' and :'with_trade'::jsonb#>>'{trades,0,offered,0,item,notes}'='Potion description' and :'with_trade'::jsonb#>'{trades,0,offered,0,item,effects}'='[{"field":"save","value":1}]','offered item snapshot without whole stack quantity');
select public.test_assert(:'with_trade'::jsonb#>>'{trades,0,requested,0,item,name}'='Gem' and :'with_trade'::jsonb#>>'{trades,0,requested,0,item,qty}'='1' and :'with_trade'::jsonb#>>'{trades,0,requested,0,item,notes}'='Gem description','requested item snapshot');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_assert(public.table_read(:'tid')->'trades'='[]','trade snapshots only for participants');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.test_command(:'tid','visibility','{"heroId":"b","visibility":{"sections":[],"notes":[]}}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert(public.table_read(:'tid')#>>'{trades,0,requested,0,item,name}'='Gem' and public.table_read(:'tid')#>'{members,2,hero,sections}'='{}','selected trade terms remain visible when inventory closes');

select public.test_command(:'tid','confirm-trade',jsonb_build_object('tradeId',:'trade_id'));
select public.test_assert((select document#>>'{inventory,0,qty}'='5' from public.characters where id='a'),'first confirmation does not move items');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.table_read(:'tid')->>'revision' as trade_rev \gset
select jsonb_build_object('type','confirm-trade','operationId','complete-trade','expectedRevision',:'trade_rev'::bigint,'payload',jsonb_build_object('tradeId',:'trade_id')) as confirm_command \gset
select public.table_command(:'tid',:'confirm_command') as completed \gset
select public.test_assert(:'completed'::jsonb#>>'{trades,0,status}'='accepted','both confirmations commit');
select public.test_assert((select document#>>'{inventory,0,qty}'='2' and document#>>'{inventory,1,qty}'='2' and document#>'{inventory,1,equipped}'='false' from public.characters where id='b'),'recipient quantity and unequipped');
select public.table_command(:'tid',:'confirm_command');
select public.test_assert((select jsonb_array_length(document->'inventory')=2 from public.characters where id='b'),'idempotent trade replay');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert((select document#>>'{inventory,0,qty}'='3' and document#>>'{inventory,2,qty}'='1' from public.characters where id='a'),'both sides quantities');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.test_command(:'tid','visibility','{"heroId":"b","visibility":{"sections":["inventory"],"notes":[]}}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
-- A stale second confirmation must roll back BOTH inventories and its confirmation.
select public.test_command(:'tid','create-trade','{"toUserId":"00000000-0000-0000-0000-000000000003","fromHeroId":"a","toHeroId":"b","offered":[{"itemId":"potion","qty":3}],"requested":[{"itemId":"gem","qty":2}]}') as insufficient_trade \gset
select :'insufficient_trade'::jsonb#>>'{trades,1,id}' as failed_trade_id \gset
select public.test_command(:'tid','confirm-trade',jsonb_build_object('tradeId',:'failed_trade_id'));
update public.characters set document=jsonb_set(document,'{inventory,0,qty}','1') where id='a';
select document as a_before_failure from public.characters where id='a' \gset
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select document as b_before_failure from public.characters where id='b' \gset
select public.test_denied(format('select public.test_command(%L,''confirm-trade'',%L)',:'tid',jsonb_build_object('tradeId',:'failed_trade_id')),'PT409');
select public.test_assert((select document=:'b_before_failure'::jsonb from public.characters where id='b'),'failed trade preserves recipient');
select public.test_assert(public.table_read(:'tid')#>'{trades,1,confirmations}'='[]' and public.table_read(:'tid')#>>'{trades,1,status}'='cancelled','insufficient changed item cancels pending terms and confirmations');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert((select document=:'a_before_failure'::jsonb from public.characters where id='a'),'failed trade preserves sender');
-- Non-quantity item changes refresh the selected snapshot and clear BOTH approvals.
select public.test_command(:'tid','create-trade','{"toUserId":"00000000-0000-0000-0000-000000000003","fromHeroId":"a","toHeroId":"b","offered":[{"itemId":"potion","qty":1}],"requested":[]}') as mutable_trade \gset
select :'mutable_trade'::jsonb#>>'{trades,2,id}' as mutable_id \gset
select public.test_command(:'tid','confirm-trade',jsonb_build_object('tradeId',:'mutable_id'));
update public.characters set document=jsonb_set(jsonb_set(document,'{inventory,0,notes}','"UPDATED-ITEM-DESCRIPTION"'),'{inventory,0,effects}','[{"field":"speed","value":3}]') where id='a';
select public.test_command(:'tid','visibility','{"heroId":"a","visibility":{"sections":[],"notes":[]}}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.table_read(:'tid') as refreshed_terms \gset
select public.test_assert(:'refreshed_terms'::jsonb#>'{trades,2,confirmations}'='[]' and :'refreshed_terms'::jsonb#>>'{trades,2,status}'='pending','item edit invalidates earlier approval');
select public.test_assert(:'refreshed_terms'::jsonb#>>'{trades,2,offered,0,item,notes}'='UPDATED-ITEM-DESCRIPTION' and :'refreshed_terms'::jsonb#>'{trades,2,offered,0,item,effects}'='[{"field":"speed","value":3}]' and :'refreshed_terms'::jsonb#>'{members,1,hero,sections}'='{}','selected refreshed terms visible without other inventory');
select public.test_command(:'tid','confirm-trade',jsonb_build_object('tradeId',:'mutable_id')) as only_one_approval \gset
select public.test_assert(:'only_one_approval'::jsonb#>>'{trades,2,status}'='pending' and jsonb_array_length(:'only_one_approval'::jsonb#>'{trades,2,confirmations}')=1,'new second party approval cannot use invalidated first party approval');
select public.test_command(:'tid','cancel-trade',jsonb_build_object('tradeId',:'mutable_id'));
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
-- A character change advances exactly the related table's observable revision.
select public.table_read(:'tid')->>'revision' as before_hero_write \gset
update public.characters set document=document || '{"surges":2}' where id='a';
select public.test_assert((public.table_read(:'tid')->>'revision')::bigint=:'before_hero_write'::bigint+1,'hero write signals a new revision');
select public.test_command(:'tid','activate-hero','{"heroId":"a2"}') as changed_active \gset
select public.test_assert(:'changed_active'::jsonb#>>'{members,1,hero,id}'='a2','active hero selection');
select public.test_command(:'tid','activate-hero','{"heroId":"a"}');
-- A single (owner,id) cannot attach to a second table.
select public.test_command(null,'create','{"name":"Second table","memberName":"A as DM"}') as second_table \gset
select public.test_denied(format('select public.test_command(%L,''attach-hero'',''{"heroId":"a"}'')',:'second_table'::jsonb->>'id'),'42501');
select public.test_command(:'second_table'::jsonb->>'id','delete');

-- Archive freezes full source documents, applies current owner privacy on every read.
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(:'tid','archive','{"archived":true}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
update public.characters set document=document || '{"name":"NEW-LIVE-NAME","notes":{"secrets":"NEW-SECRET","story":"NEW-STORY"}}' where id='a';
select public.test_command(:'tid','visibility','{"heroId":"a","visibility":{"sections":[],"notes":["story"]}}') as archived \gset
select public.test_assert(:'archived'::jsonb#>>'{members,1,hero,name}'='Alice','archive uses frozen name');
select public.test_assert(:'archived'::jsonb#>>'{members,1,hero,notes,story}'='Story','reopened archive section uses frozen content');
select public.test_assert(:'archived' !~ 'SECRET-HERO|NEW-SECRET|NEW-STORY|NEW-LIVE-NAME','archive no current state leak');
select public.test_denied(format('select public.test_command(%L,''activate-hero'',''{"heroId":"a2"}'')',:'tid'),'PT409');
select public.test_command(:'tid','visibility','{"heroId":"a","visibility":{"sections":[],"notes":[]}}') as closed \gset
select public.test_assert(:'closed'::jsonb#>'{members,1,hero,notes}'='{}','archive access can be revoked');

-- Transfer can be accepted in archive; new DM's heroes/snapshots disappear.
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(:'tid','transfer','{"userId":"00000000-0000-0000-0000-000000000003"}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.test_command(:'tid','accept-transfer') as transferred \gset
select public.test_assert(:'transferred'::jsonb->>'ownerId'=auth.uid()::text and :'transferred'::jsonb->'myHeroIds'='[]' and :'transferred'::jsonb#>'{members,2,hero}'='null','transfer removes Director heroes');
select public.test_command(:'tid','archive','{"archived":false}');
select public.test_command(:'tid','kick','{"userId":"00000000-0000-0000-0000-000000000002"}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert((select count(*) from public.table_signals)=0,'kicked member loses signals');
select public.test_denied(format('select public.table_command(%L,%L)',:'tid',:'player_event_command'),'PT404');
select public.test_denied(format('select public.test_command(null,''join'',%L)',jsonb_build_object('inviteCode',:'invite_new','memberName','A')),'PT404');
select public.test_denied(format('select public.table_command(%L,%L)',:'tid',jsonb_build_object('type','event','payload',jsonb_build_object('text','Player roll','public',true,'kind','roll','actor','SPOOF','stamina',999),'operationId','unused','expectedRevision',1)),'PT404');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.test_command(:'tid','allow-member','{"userId":"00000000-0000-0000-0000-000000000002"}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_command(null,'join',jsonb_build_object('inviteCode',:'invite_new','memberName','A')) as rejoined \gset
select public.test_assert(:'rejoined'::jsonb->'myHeroIds'='[]' and :'rejoined'::jsonb#>'{members,1,hero}'='null','kick removes snapshots');
select public.test_command(:'tid','leave');

-- Ten members includes Director. Distinct authenticated identities use same RPC.
reset role;
do $$ declare i integer; tid text; invite text; begin
 select id,invite_code into tid,invite from table_backend.tables where name='Campaign';
 for i in 2..10 loop
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-' || lpad(i::text,12,'0'),true);
  perform public.test_command(null,'join',jsonb_build_object('inviteCode',invite,'memberName','Member ' || i));
 end loop;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
 perform public.test_denied(format('select public.test_command(null,''join'',%L)',jsonb_build_object('inviteCode',invite,'memberName','Overflow')),'PT409');
 perform public.test_assert((select count(*) from table_backend.members where table_id=tid)=10,'membership cap');
end $$;
select public.test_assert((select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='table_signals')=1,'Realtime publishes signals');
select public.test_assert((select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='table_backend')=0,'private tables never published');
select public.test_assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='table_backend' or n.nspname='public' and p.proname like 'table_%') and p.prosecdef and not coalesce(p.proconfig,'{}') @> array['search_path=pg_catalog']),'security definer search_path locked');
select public.test_assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='table_backend' and p.proname<>'is_member' and has_function_privilege('authenticated',p.oid,'EXECUTE')),'authenticated cannot execute private helpers');
select public.test_assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='table_backend' or n.nspname='public' and p.proname like 'table_%') and has_function_privilege('anon',p.oid,'EXECUTE')),'anon cannot execute backend functions');

set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(null,'create','{"name":"Concurrent gift","memberName":"DM"}') as gift_table \gset
select :'gift_table'::jsonb->>'id' as gift_tid, :'gift_table'::jsonb->>'inviteCode' as gift_invite \gset
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_command(null,'join',jsonb_build_object('inviteCode',:'gift_invite','memberName','A'));
select public.test_command(:'gift_tid','attach-hero','{"heroId":"a"}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(:'gift_tid','offer-item','{"heroId":"a","toUserId":"00000000-0000-0000-0000-000000000002","item":{"id":"concurrent-sword","name":"Concurrent Sword","category":"gear","qty":1,"notes":"","equipped":true}}');
-- Member account deletion also removes archive documents and access.
select public.test_command(null,'create','{"name":"Account removal","memberName":"DM"}') as deletion_table \gset
select :'deletion_table'::jsonb->>'id' as deletion_tid, :'deletion_table'::jsonb->>'inviteCode' as deletion_invite \gset
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000012';
select public.test_command(null,'join',jsonb_build_object('inviteCode',:'deletion_invite','memberName','Deleted user'));
insert into public.characters(user_id,id,document) values(auth.uid(),'deleted-hero','{"id":"deleted-hero","name":"ACCOUNT-SECRET","inventory":[]}');
select public.test_command(:'deletion_tid','attach-hero','{"heroId":"deleted-hero"}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(:'deletion_tid','archive','{"archived":true}');
reset role;
delete from auth.users where id='00000000-0000-0000-0000-000000000012';
select public.test_assert(not exists(select 1 from table_backend.heroes where hero_id='deleted-hero'),'account deletion removes archive source');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_assert(public.table_read(:'deletion_tid')::text !~ 'ACCOUNT-SECRET','deleted account snapshot absent');
reset role;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
insert into public.characters(user_id,id,document) values(auth.uid(),'merge-hero','{"id":"merge-hero","name":"Stack testing","inventory":[]}');
select public.test_command(:'gift_tid','attach-hero','{"heroId":"merge-hero"}');
reset role;
do $$ declare i integer; t text; offered jsonb; offer_id text; effect integer; doc jsonb; begin
 select id into t from table_backend.tables where name='Concurrent gift';
 for i in 1..4 loop
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  effect=case when i=2 then 3 else 2 end;
  offered=public.test_command(t,'offer-item',jsonb_build_object('heroId','merge-hero','toUserId','00000000-0000-0000-0000-000000000002','item',jsonb_build_object('id','token','name','Token','category','gear','qty',1,'notes','','equipped',true,'effects',jsonb_build_array(jsonb_build_object('field','stamina','value',effect)))));
  select o->>'id' into offer_id from jsonb_array_elements(offered->'offers') o where o->>'heroId'='merge-hero' and o->>'status'='pending';
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  perform public.test_command(t,'answer-offer',jsonb_build_object('offerId',offer_id,'accept',true,'version',1));
  select document into doc from public.characters where user_id=auth.uid() and id='merge-hero';
  if i=3 then
   perform public.test_assert(jsonb_array_length(doc->'inventory')=2 and doc#>>'{inventory,0,qty}'='2' and doc#>>'{inventory,1,effects,0,value}'='3','effects participate in stack equality');
   update public.characters set document=jsonb_set(document,'{inventory,0,equipped}','true') where user_id=auth.uid() and id='merge-hero';
  end if;
 end loop;
 perform public.test_assert(jsonb_array_length(doc->'inventory')=3 and doc#>'{inventory,2,equipped}'='false','received items do not merge into equipped stacks');
end $$;
\o
select 'All actor, RLS, archive, rollback and privacy assertions passed' as result;
