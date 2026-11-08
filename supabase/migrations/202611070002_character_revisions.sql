-- Owner document writes use CAS. No existing JSON is rewritten by this migration.
-- RPC character_save(p_document jsonb, p_expected_updated_at timestamptz default null)
-- null = create only; timestamp = exact characters.updated_at read by the client.
-- Returns {document: <full saved Character>, updatedAt: <server timestamptz>}.
-- PT409 has detail {server: <current full Character or null>} for owner recovery.
create or replace function public.character_save(
  p_document jsonb,
  p_expected_updated_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  actor uuid := auth.uid();
  hero_id text;
  previous public.characters%rowtype;
  saved_document jsonb;
  saved_at timestamptz;
  hero_level integer;
begin
  if actor is null then raise exception using errcode='42501', message='Требуется вход'; end if;
  if jsonb_typeof(p_document) is distinct from 'object' or octet_length(p_document::text) > 2097152 then
    raise exception using errcode='22023', message='Некорректный документ героя';
  end if;
  hero_id := p_document->>'id';
  if hero_id is null or hero_id !~ '^[A-Za-z0-9_-]{1,80}$' or
     (p_document ? 'name' and jsonb_typeof(p_document->'name') <> 'string') or
     (p_document ? 'className' and jsonb_typeof(p_document->'className') <> 'string') or
     (p_document ? 'ancestry' and jsonb_typeof(p_document->'ancestry') <> 'string') or
     (p_document ? 'level' and (jsonb_typeof(p_document->'level') <> 'number' or (p_document->>'level') !~ '^(10|[1-9])$')) or
     (p_document ? 'inventory' and jsonb_typeof(p_document->'inventory') <> 'array') then
    raise exception using errcode='22023', message='Некорректные данные героя';
  end if;
  hero_level := coalesce((p_document->>'level')::integer,1);
  -- Insertion is create-only even when two requests see an absent row.
  if p_expected_updated_at is null then
    saved_at := clock_timestamp();
    saved_document := p_document || jsonb_build_object('updatedAt',saved_at);
    insert into public.characters(user_id,id,name,class_name,ancestry,level,avatar_url,document,updated_at)
    values(actor,hero_id,coalesce(nullif(p_document->>'name',''),'Без имени'),coalesce(p_document->>'className',''),
      coalesce(p_document->>'ancestry',''),hero_level,p_document #>> '{avatar,url}',saved_document,saved_at)
    on conflict(user_id,id) do nothing;
    if found then return jsonb_build_object('document',saved_document,'updatedAt',saved_at); end if;
  end if;
  select * into previous from public.characters where user_id=actor and id=hero_id for update;
  if not found then
    raise exception using errcode='PT409', message='Герой удалён или изменён', detail='{"server":null}';
  end if;
  if p_expected_updated_at is null or previous.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode='PT409', message='Герой уже изменён на сервере',
      detail=jsonb_build_object('server',previous.document || jsonb_build_object('updatedAt',previous.updated_at))::text;
  end if;
  saved_at := greatest(clock_timestamp(), previous.updated_at + interval '1 microsecond');
  saved_document := p_document || jsonb_build_object('updatedAt',saved_at);
  update public.characters set name=coalesce(nullif(p_document->>'name',''),'Без имени'),
    class_name=coalesce(p_document->>'className',''),ancestry=coalesce(p_document->>'ancestry',''),
    level=hero_level,avatar_url=p_document #>> '{avatar,url}',document=saved_document,updated_at=saved_at
  where user_id=actor and id=hero_id;
  return jsonb_build_object('document',saved_document,'updatedAt',saved_at);
end $$;
revoke all on function public.character_save(jsonb,timestamptz) from public,anon;
grant execute on function public.character_save(jsonb,timestamptz) to authenticated;
-- Every app document write now uses the RPC. Keep reads, owner deletes and
-- Storage avatar policies intact; table_backend's definer transactions still work.
revoke insert,update on public.characters from authenticated;
