-- Share the attached hero's public portrait URL with table members.
create or replace function table_backend.hero(doc jsonb, visibility jsonb) returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare result jsonb; section text; keys text[]; sections jsonb = '{}'; notes jsonb = '{}'; n text; states jsonb; resources jsonb;
begin
 if doc is null then return null; end if;
 for section in select jsonb_array_elements_text(visibility->'sections') loop
  keys = case section
   when 'hero' then array['career','subclass','characteristics','size','speed','stability','disengage','kit','secondaryKit','weapon','armor','equipmentEffects','abilities','damageModifier','damageTraits','ancestryTraits','classFeatures']
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
 if jsonb_typeof(doc #> '{avatar,url}') = 'string' and btrim(doc #>> '{avatar,url}') <> '' then
  result = result || jsonb_build_object('avatarUrl', doc #> '{avatar,url}');
 end if;
 return result;
end $$;
