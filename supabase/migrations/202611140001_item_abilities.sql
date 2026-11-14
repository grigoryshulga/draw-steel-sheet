-- Preserve item ability references through templates, offers and trades.
-- Existing inventories remain valid without the optional abilityIds field.
create or replace function table_backend.item(v jsonb) returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
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
 if v ? 'abilityIds' then
  perform table_backend.require(jsonb_typeof(v->'abilityIds')='array');
  perform table_backend.require(jsonb_array_length(v->'abilityIds')<=16);
  for e in select value from jsonb_array_elements(v->'abilityIds') loop
   perform table_backend.require(table_backend.str(e,200));
  end loop;
  perform table_backend.require((select count(*)=count(distinct value) from jsonb_array_elements(v->'abilityIds')));
 end if;
 return table_backend.pick(v,array['id','name','category','qty','notes','equipped','catalogId','effects','abilityIds']);
end $$;
