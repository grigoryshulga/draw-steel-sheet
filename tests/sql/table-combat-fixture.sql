\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(null,'create','{"name":"Бой","memberName":"Ведущий"}') as room \gset
select :'room'::jsonb->>'id' as tid, :'room'::jsonb->>'inviteCode' as invite \gset
select public.test_command(:'tid','board-start-scene','{"scene":{
  "id":"combat-scene","name":"Бой","kind":"encounter","status":"prepared","published":false,
  "description":"","objective":"","round":1,"initiative":"heroes","counters":[],
  "combatants":[{"id":"hidden-ambush","name":"Засада","group":"","organization":"","faction":"enemy",
    "revealed":false,"turn":"ready","reactionUsed":true,"conditions":[],"health":"healthy"}]
}}');
select public.test_assert(not public.table_read(:'tid') ? 'combat','showing a scene waits for initiative');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_command(null,'join',jsonb_build_object('inviteCode',:'invite','memberName','Игрок 1'));
insert into public.characters(user_id,id,document) values(auth.uid(),'fighter-a','{"id":"fighter-a","name":"А"}');
select public.test_command(:'tid','attach-hero','{"heroId":"fighter-a"}');
select public.test_denied(format('select public.test_command(%L,''combat-start'',''{"sceneId":"combat-scene","initiative":"heroes"}'')',:'tid'),'42501');
select auth.uid()::text as a \gset
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.test_command(null,'join',jsonb_build_object('inviteCode',:'invite','memberName','Игрок 2'));
insert into public.characters(user_id,id,document) values(auth.uid(),'fighter-b','{"id":"fighter-b","name":"Б"}');
select public.test_command(:'tid','attach-hero','{"heroId":"fighter-b"}');
select auth.uid()::text as b \gset

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(:'tid','combat-start','{"sceneId":"combat-scene","initiative":"heroes"}','battle-fixture') as started \gset
select public.test_assert(:'started'::jsonb#>>'{combat,side}'='heroes','confirmed heroes initiative');
select public.test_assert(:'started'::jsonb#>>'{scenes,0,combatants,0,reactionUsed}'='false','battle start clears reactions');
select '{"sceneId":"combat-scene","combatId":"battle-fixture","side":"enemies","id":"hidden-ambush"}'::jsonb as enemy_turn,
  jsonb_build_object('sceneId','combat-scene','combatId','battle-fixture','side','heroes','id',:'a','heroId','fighter-a') as turn_a,
  jsonb_build_object('sceneId','combat-scene','combatId','battle-fixture','side','heroes','id',:'b','heroId','fighter-b') as turn_b \gset
select public.test_denied(format('select public.test_command(%L,''combat-start-turn'',%L)',:'tid',:'enemy_turn'),'PT409');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select jsonb_build_object('type','combat-start-turn','operationId','claim-a','expectedRevision',(public.table_read(:'tid')->>'revision')::bigint,'payload',:'turn_a'::jsonb) as claim \gset
select public.test_assert(public.table_command(:'tid',:'claim')#>>'{combat,active,id}'=:'a','player starts own turn');
select public.test_assert(public.table_hero_combat('fighter-a')#>>'{combat,active,heroId}'='fighter-a','personal sheet can read combat independently');
select public.test_assert(jsonb_array_length(public.table_command(:'tid',:'claim')#>'{combat,heroTurns}')=1,'replayed claim has one receipt');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.test_assert(public.table_hero_combat('fighter-a') is null,'other heroes cannot be fetched from the personal endpoint');
select public.test_denied(format('select public.test_command(%L,''combat-start-turn'',%L)',:'tid',:'turn_b'),'PT409');
select public.test_denied(format('select public.test_command(%L,''combat-end-turn'',%L)',:'tid',:'turn_a'),'42501');
select public.test_denied(format('select public.test_command(%L,''combat-next-round'',''{"sceneId":"combat-scene","combatId":"battle-fixture"}'')',:'tid'),'42501');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert(public.test_command(:'tid','combat-end-turn',:'turn_a')#>>'{combat,side}'='enemies','turn passes to Director');
select public.test_denied(format('select public.test_command(%L,''combat-start-turn'',%L)',:'tid',:'enemy_turn'),'42501');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_assert(public.test_command(:'tid','combat-start-turn',:'enemy_turn')#>>'{combat,active,id}'='hidden-ambush','Director starts hidden enemy');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.test_assert(public.table_read(:'tid')#>'{combat,active}'='{"id":null,"side":"enemies"}'
    and public.table_read(:'tid')::text not like '%hidden-ambush%','hidden enemy id is withheld even during its turn');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_assert(public.test_command(:'tid','combat-end-turn',:'enemy_turn')#>>'{combat,side}'='heroes','turn returns to players');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_denied(format('select public.test_command(%L,''combat-start-turn'',%L)',:'tid',:'turn_a'),'PT409');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.test_command(:'tid','combat-start-turn',:'turn_b');
select public.test_assert(public.test_command(:'tid','combat-end-turn',:'turn_b')#>'{combat,side}'='null','both sides exhausted');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(:'tid','combat-next-round','{"sceneId":"combat-scene","combatId":"battle-fixture"}') as next_round \gset
select public.test_assert(:'next_round'::jsonb#>>'{combat,round}'='2' and :'next_round'::jsonb#>>'{combat,side}'='heroes'
  and :'next_round'::jsonb#>'{combat,enemyTurns}'='[]','next round restores original initiative and clears turns');
select public.test_command(:'tid','board-start-scene','{"sceneId":null}');
select public.test_assert(not public.table_read(:'tid') ? 'combat','leaving the encounter clears combat');
select public.test_command(:'tid','board-start-scene','{"sceneId":"combat-scene"}');
select public.test_command(:'tid','combat-start','{"sceneId":"combat-scene","initiative":"enemies"}','director-initiative');
select public.test_assert(public.test_command(:'tid','combat-next-round','{"sceneId":"combat-scene","combatId":"director-initiative"}')
  #>>'{combat,side}'='enemies','Director initiative also carries into the next round');
reset role;
\o
select 'Combat turn order and permissions passed' as result;
