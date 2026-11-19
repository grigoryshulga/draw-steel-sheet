\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(null,'create','{"name":"Board fixture","memberName":"Director"}') as room \gset
select :'room'::jsonb->>'id' as tid, :'room'::jsonb->>'inviteCode' as invite \gset
select public.test_assert(public.table_board_view(:'tid')->>'revision'='0','default board view');
select public.test_assert(public.table_read(:'tid')#>>'{board,grid,enabled}'='false','default board grid');
select public.test_command(:'tid','board-grid','{"enabled":true,"size":70,"x":-12,"y":8}');
select (public.table_read(:'tid')->>'revision')::bigint as rev \gset
select jsonb_build_object('type','board-show','operationId','board-show-once','expectedRevision',:rev,'payload',
  '{"id":"letter","kind":"text","text":"An open letter","title":"Letter","x":600.5,"y":400,"private":"OMIT_BOARD_PRIVATE"}'::jsonb) as show_cmd \gset
select public.table_command(:'tid',:'show_cmd');
select public.test_assert(jsonb_array_length(public.table_command(:'tid',:'show_cmd')#>'{board,materials}')=1,'board replay shows one item');
select public.test_command(:'tid','board-draw','{"sceneId":null,"stroke":{"id":"trail","color":"#aa2211","thickness":6,"points":[[100,200],[160,240]]}}');
select public.test_command(:'tid','board-draw','{"sceneId":null,"stroke":{"id":"dot","color":"#118833","thickness":15,"points":[[100,200]]}}');
select public.test_denied(format('select public.test_command(%L,''board-undo-stroke'',''{"sceneId":null,"id":"trail"}'')',:'tid'),'22023');
select public.test_command(:'tid','board-undo-stroke','{"sceneId":null,"id":"dot"}');
select public.test_denied(format('select public.test_command(%L,''board-draw'',''{"sceneId":null,"stroke":{"id":"outside","color":"#aaaaaa","thickness":6,"points":[[1601,0]]}}'')',:'tid'),'22023');
select public.test_command(:'tid','save-scene','{"scene":{"id":"published","name":"Encounter","kind":"encounter","status":"active","published":true,"description":"","objective":"","round":1,"initiative":"heroes","combatants":[],"counters":[{"id":"visible","name":"Alarm","value":2,"max":3,"public":true},{"id":"hidden","name":"OMIT_PRIVATE_COUNTER","value":9,"public":false}]}}');
select public.test_denied(format('select public.test_command(%L,''board-pin-counter'',''{"sceneId":"published","id":"hidden"}'')',:'tid'),'22023');
select public.test_command(:'tid','board-pin-counter','{"sceneId":"published","id":"visible"}');
select public.test_command(:'tid','board-place-counter','{"sceneId":"published","id":"visible","placement":{"x":200,"y":240,"width":240,"height":110,"snap":true}}');
select public.test_command(:'tid','board-step-counter','{"sceneId":"published","id":"visible","delta":1}');
select public.test_assert(public.table_read(:'tid')#>>'{scenes,0,counters,0,value}'='3','board updates source counter');
select public.test_command(:'tid','board-add-counter','{"id":"world","name":"Days left","value":2,"max":4}');
select public.test_command(:'tid','board-unpin-counter','{"id":"world"}');
select public.test_assert(public.table_read(:'tid')#>>'{board,availableCounters,0,value}'='2','unpin retains original counter');
select public.test_command(:'tid','board-pin-counter','{"id":"world"}');
select 'd1234567-1234-1234-1234-123456789012' as asset \gset
insert into storage.objects(bucket_id,name) values('table-images',:'tid'||'/'||:'asset');
select (public.table_read(:'tid')->>'revision')::bigint as before_camera \gset
select public.table_board_view_write(:'tid','{"type":"start","control":"control1","expectedRevision":0,"view":{"x":800,"y":450,"zoom":1}}');
select public.table_board_view_write(:'tid','{"type":"move","control":"control1","sequence":2,"view":{"x":620,"y":340,"zoom":2}}');
select public.table_board_view_write(:'tid','{"type":"move","control":"control1","sequence":1,"view":{"x":800,"y":450,"zoom":1}}');
select public.test_assert(public.table_read(:'tid')->>'revision'=:'before_camera','view writes do not touch board revision');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_denied(format('select public.table_board_view(%L)',:'tid'),'PT404');
select public.test_command(null,'join',jsonb_build_object('inviteCode',:'invite','memberName','Player'));
select public.test_assert(public.table_board_view(:'tid')->>'x'='620','late member sees latest board view');
select public.test_assert((select revision from public.table_board_signals where id=:'tid')=2,'member sees separate view signal');
select public.test_assert(public.table_read(:'tid')#>>'{board,strokes,0,thickness}'='6' and jsonb_array_length(public.table_read(:'tid')#>'{board,strokes}')=1,'player sees the surviving stroke');
select public.test_denied(format('select public.test_command(%L,''board-draw'',''{}'')',:'tid'),'42501');
select public.test_assert(public.table_read(:'tid')::text !~ 'OMIT_','private values absent');
select public.test_assert(public.table_read(:'tid')#>>'{board,counters,1,value}'='3','public linked value projected');
select public.test_assert(public.table_read(:'tid')#>>'{board,counters,1,placement,x}'='200','player sees linked counter placement');
select public.test_assert((select count(*) from storage.objects where bucket_id='table-images')=0,'unpublished image hidden');
select public.test_denied(format('insert into storage.objects(bucket_id,name) values (''table-images'',%L)',:'tid'||'/d2234567-1234-1234-1234-123456789012'),'42501');
select public.test_denied(format('select public.test_command(%L,''board-grid'',''{}'')',:'tid'),'42501');
select public.test_denied(format('select public.table_board_view_write(%L,''{"type":"stop","control":"control1","view":{"x":800,"y":450,"zoom":1}}'')',:'tid'),'42501');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(:'tid','board-background',jsonb_build_object('assetId',:'asset'));
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert((select count(*) from storage.objects where bucket_id='table-images')=1,'published image available');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(:'tid','board-background','{"assetId":null}');
select public.test_command(:'tid','save-scene',jsonb_build_object('scene',jsonb_set(public.table_read(:'tid')#>'{scenes,0}','{counters,0,public}','false')));
select public.test_assert(jsonb_array_length(public.table_read(:'tid')#>'{board,counters}')=1,'link removed when source is hidden');
select public.test_command(:'tid','transfer','{"userId":"00000000-0000-0000-0000-000000000002"}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert((select count(*) from storage.objects where bucket_id='table-images')=0,'new access removed with last reference');
select public.test_command(:'tid','accept-transfer');
select public.test_assert(public.table_board_view(:'tid')->'control'='null','transfer stops following');
select public.table_board_view_write(:'tid','{"type":"move","control":"control1","sequence":3,"view":{"x":700,"y":360,"zoom":2}}');
select public.test_assert(public.table_board_view(:'tid')->>'x'='620','late move from old control cannot change frame');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_denied(format('select public.table_board_view_write(%L,''{"type":"start","control":"old-owner","expectedRevision":3,"view":{"x":800,"y":450,"zoom":1}}'')',:'tid'),'42501');
reset role;
select 'd3234567-1234-1234-1234-123456789012' as expired \gset
insert into storage.objects(bucket_id,name,created_at) values('table-images',:'tid'||'/'||:'expired',now()-interval '3 days');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert(public.table_board_expired_images(:'tid')=array[:'tid'||'/'||:'expired'],'list only expired unreferenced uploads');
select public.test_denied(format('select public.test_command(%L,''board-background'',%L)',:'tid',jsonb_build_object('assetId',:'expired')),'22023');
delete from storage.objects where name=:'tid'||'/'||:'expired';
select public.test_assert(cardinality(public.table_board_expired_images(:'tid'))=0,'director can remove expired upload through its policy');
reset role;

set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select jsonb_build_object('id','layout-scene','name','Prepared layout','kind','montage','status','prepared','published',false,'description','','objective','','round',1,'initiative','heroes','combatants','[]'::jsonb,'counters','[]'::jsonb,'layout',
 jsonb_build_object('tableId',:'tid','background',:'asset','grid','{"enabled":true,"size":64,"x":0,"y":0,"color":"#102030","opacity":35,"thickness":3}'::jsonb,
 'materials','[{"kind":"text","id":"draft-text","title":"Map","text":"Layout text","x":300,"y":420},{"kind":"counter","id":"draft-counter","title":"Days","x":420,"y":420,"value":1,"max":3,"settings":{"width":240,"height":120,"snap":true}}]'::jsonb,
 'strokes','[{"id":"private-trail","color":"#102030","thickness":4,"points":[[100,90],[300,15]]}]'::jsonb)
) as scene_layout_test \gset
select public.test_command(:'tid','save-scene',jsonb_build_object('scene',:'scene_layout_test'::jsonb));
select public.test_assert(public.table_read(:'tid')::text like '%Layout text%','director reads saved layout');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_assert(public.table_read(:'tid')::text not like '%Layout text%','prepared layout remains private');
select public.test_assert(public.table_read(:'tid')::text not like '%private-trail%','prepared strokes remain private');
select public.test_assert((select count(*) from storage.objects where name=:'tid'||'/'||:'asset')=0,'prepared background remains private');
select public.test_denied(format('select public.test_command(%L,''board-start-scene'',''{"sceneId":"layout-scene"}'')',:'tid'),'42501');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select 'd4234567-1234-1234-1234-123456789012' as main_asset \gset
insert into storage.objects(bucket_id,name) values('table-images',:'tid'||'/'||:'main_asset');
select public.test_command(:'tid','board-background',jsonb_build_object('assetId',:'main_asset'));
reset role;
update storage.objects set created_at=now()-interval '3 days' where name=:'tid'||'/'||:'main_asset';
set role authenticated;
select public.test_command(:'tid','board-start-scene','{"sceneId":"layout-scene"}');
select public.test_assert(not (:'tid'||'/'||:'main_asset'=any(public.table_board_expired_images(:'tid'))),'inactive main background survives cleanup');
select public.test_command(:'tid','board-move','{"id":"draft-counter","x":460,"y":420,"settings":{"width":280,"height":120,"snap":true,"locked":true}}');
select public.test_denied(format('select public.test_command(%L,''board-move'',''{"id":"draft-counter","x":470,"y":420}'')',:'tid'),'22023');
select public.test_command(:'tid','board-step-counter','{"id":"draft-counter","delta":1}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_assert(public.table_read(:'tid')#>>'{board,sceneId}'='layout-scene'
 and public.table_read(:'tid')#>>'{board,grid,color}'='#102030'
 and public.table_read(:'tid')#>>'{board,grid,opacity}'='35'
 and public.table_read(:'tid')#>>'{board,grid,thickness}'='3','player reads launched layout and grid styling');
select public.test_assert(public.table_read(:'tid')::text not like '%"layout":%','scene layout remains excluded from player scene records');
select public.test_assert(public.table_read(:'tid')#>>'{board,strokes,0,id}'='private-trail','launched scene replaces previous strokes');
select public.test_assert(public.table_read(:'tid')#>>'{board,materials,1,value}'='2'
 and public.table_read(:'tid')#>>'{board,materials,1,settings,width}'='280'
 and public.table_read(:'tid')#>>'{board,materials,1,settings,locked}'='true','position, lock and value survive projection');
select public.test_assert((select count(*) from storage.objects where name=:'tid'||'/'||:'asset')=1,'launched background can be read by player');
select public.test_assert((select count(*) from storage.objects where name=:'tid'||'/'||:'main_asset')=0,'inactive main background remains private');
select public.test_assert(not (public.table_read(:'tid')->'board' ? 'mainLayout'),'stored main layout does not enter the table snapshot');
select public.test_denied(format('select public.test_command(%L,''board-start-scene'',''{"sceneId":null}'')',:'tid'),'42501');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_command(:'tid','board-start-scene','{"sceneId":"published"}');
select public.test_assert(public.table_read(:'tid')#>>'{board,sceneId}'='published' and public.table_read(:'tid')#>'{board,materials}'='[]','drop target replaces a previously launched scene');
select public.test_command(:'tid','board-start-scene','{"sceneId":null}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_assert(not (public.table_read(:'tid')->'board' ? 'sceneId')
 and public.table_read(:'tid')#>>'{board,materials,0,id}'='letter'
 and public.table_read(:'tid')#>>'{board,strokes,0,id}'='trail'
 and public.table_read(:'tid')#>>'{board,background}'=:'main_asset','return restores the main layout after successive replacements');
select public.test_assert((select count(*) from storage.objects where name=:'tid'||'/'||:'main_asset')=1,'restored main background is visible to player');
reset role;
