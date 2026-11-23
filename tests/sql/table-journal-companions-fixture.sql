\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_command(null,'create','{"name":"Journal and companions","memberName":"Director"}') as room \gset
select :'room'::jsonb->>'id' as tid, :'room'::jsonb->>'inviteCode' as invite \gset
select public.test_assert(:'room'::jsonb->'companions'='[]','new and legacy tables have a default roster');
select public.test_command(:'tid','event','{"text":"Secret","public":false,"kind":"message"}')#>>'{events,0,id}' as secret \gset
select public.test_command(:'tid','save-companion','{"companion":{"id":"retainer","name":" Guide ","stamina":20.0,"maxStamina":24,"sourceId":"catalog-id","extra":"OMIT"}}');
select (public.table_read(:'tid')->>'revision')::bigint as rev \gset
select public.test_denied(format('select public.test_command(%L,''save-companion'',''{"companion":{"id":"retainer","name":"Guide","stamina":25,"maxStamina":24}}'')',:'tid'),'22023');
select public.test_assert((select revision from public.table_signals where id=:'tid')=:rev,'invalid entry does not increment revision');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_denied(format('select public.table_read(%L)',:'tid'),'PT404');
select public.test_command(null,'join',jsonb_build_object('inviteCode',:'invite','memberName','Player'));
select public.test_assert(public.table_read(:'tid')#>>'{companions,0,name}'='Guide' and
  public.table_read(:'tid')::text !~ 'OMIT|Secret','player sees validated companion and no private fields');
select public.test_denied(format('select public.test_command(%L,''delete-companion'',''{"companionId":"retainer"}'')',:'tid'),'42501');
select public.test_denied(format('select public.test_command(%L,''event-delete'',%L)',:'tid',jsonb_build_object('eventId',:'secret')),'PT404');
select public.test_command(:'tid','event','{"text":"Old","public":true,"kind":"message"}') as added \gset
select :'added'::jsonb#>>'{events,0,id}' as entry, :'added'::jsonb#>>'{events,0,at}' as original_time \gset
select jsonb_build_object('type','event-edit','operationId','edit-entry-once','expectedRevision',:'added'::jsonb->'revision',
  'payload',jsonb_build_object('eventId',:'entry','text',' New ')) as edit_cmd \gset
select public.table_command(:'tid',:'edit_cmd') as edited \gset
select public.test_assert(:'edited'::jsonb#>>'{events,0,text}'='New' and :'edited'::jsonb#>>'{events,0,at}'=:'original_time'
  and :'edited'::jsonb#>'{events,0,editedAt}' is not null,'edit keeps author and original time');
select public.test_assert(public.table_command(:'tid',:'edit_cmd')=:'edited'::jsonb,'event edit is idempotent');
select public.test_command(:'tid','event','{"text":"Roll","public":true,"kind":"roll"}')#>>'{events,1,id}' as roll \gset

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_denied(format('select public.test_command(%L,''event-edit'',%L)',:'tid',jsonb_build_object('eventId',:'entry','text','No')),'42501');
select public.test_denied(format('select public.test_command(%L,''event-delete'',%L)',:'tid',jsonb_build_object('eventId',:'roll')),'42501');
select public.test_command(:'tid','event-delete',jsonb_build_object('eventId',:'entry'));
select public.test_command(:'tid','save-companion','{"companion":{"id":"retainer","name":"Guide","stamina":7,"maxStamina":24,"sourceId":"catalog-id"}}');
select public.test_assert(jsonb_array_length(public.table_read(:'tid')->'companions')=1 and public.table_read(:'tid')#>>'{companions,0,stamina}'='7','edit updates the existing companion');
select public.test_command(:'tid','archive','{"archived":true}');
select public.test_denied(format('select public.test_command(%L,''delete-companion'',''{"companionId":"retainer"}'')',:'tid'),'PT409');
select public.test_command(:'tid','archive','{"archived":false}');
select public.test_command(:'tid','delete-companion','{"companionId":"retainer"}');
select public.test_assert(public.table_read(:'tid')->'companions'='[]','director removes companion');
reset role;
\o
