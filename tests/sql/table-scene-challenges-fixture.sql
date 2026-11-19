\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(null,'create','{"name":"Испытания","memberName":"Ведущий"}') as room \gset
select :'room'::jsonb->>'id' as tid, :'room'::jsonb->>'inviteCode' as invite \gset

select public.test_command(:'tid','board-start-scene','{"scene":{
  "id":"montage-scene","name":"Монтаж","kind":"montage","status":"prepared","published":false,
  "description":"","objective":"","round":2,"initiative":"heroes","combatants":[],
  "counters":[{"id":"successes","name":"Успехи","value":4,"max":6,"public":true}],
  "challenge":{"kind":"montage","rounds":2,"acted":["hero-a"],"hideLimits":true,"obstacles":"Приватное препятствие","result":"partial"}
}}');
select public.test_command(:'tid','board-pin-counter','{"sceneId":"montage-scene","id":"successes"}');
select public.test_assert(public.table_read(:'tid')#>>'{board,counters,0,max}'='6','director sees the pinned limit');

select public.test_command(:'tid','board-start-scene','{"scene":{
  "id":"negotiation-scene","name":"Переговоры","kind":"negotiation","status":"prepared","published":false,
  "description":"","objective":"","round":1,"initiative":"heroes","combatants":[],
  "counters":[{"id":"interest","name":"Интерес","value":3,"max":5,"public":false}],
  "challenge":{"kind":"negotiation","npc":"Капитан","offers":["Приватное предложение"],"impression":4,"traits":[
    {"id":"protected","name":"Защита","kind":"motivation","revealed":true,"used":true},
    {"id":"hidden","name":"Приватная тема","kind":"pitfall","revealed":false}]}
}}');
select public.test_assert(public.table_read(:'tid')#>>'{scenes,1,challenge,traits,0,used}'='true','director retains negotiation state');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_command(null,'join',jsonb_build_object('inviteCode',:'invite','memberName','Игрок'));
select public.table_read(:'tid') as projected \gset
select public.test_assert(not :'projected' like '%Приватное%' and not :'projected' like '%Приватная%', 'player receives no private challenge details');
select public.test_assert(:'projected'::jsonb#>'{scenes,0,challenge}'='{"kind":"montage","rounds":2,"result":"partial"}','player sees montage round limit and result');
select public.test_assert(not (:'projected'::jsonb#>'{scenes,0,counters,0}') ? 'max','player does not see hidden challenge limits');
select public.test_assert(:'projected'::jsonb#>'{scenes,1,counters}'='[]','negotiation counters can be private');
select public.test_assert(:'projected'::jsonb#>'{scenes,1,challenge,traits}'='[{"id":"protected","name":"Защита","kind":"motivation","revealed":true}]','only revealed negotiation traits are public');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(:'tid','board-start-scene','{"sceneId":"montage-scene"}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert(not (public.table_read(:'tid')#>'{board,counters,0}') ? 'max','player does not see hidden pinned limits');

reset role;
\o
