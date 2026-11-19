begin;

create function table_backend.scene_challenge(v jsonb, kind text) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
declare
  k text;
  trait jsonb;
  traits jsonb := '[]';
  ids text[] := '{}';
  entry jsonb;
begin
  perform table_backend.require(jsonb_typeof(v)='object' and v->>'kind'=kind);
  if kind='montage' then
    perform table_backend.require(table_backend.num(v->'rounds',1) and (v->>'rounds')::numeric<=99);
    perform table_backend.require(not v ? 'difficulty' or v->>'difficulty' in ('easy','moderate','hard'));
    perform table_backend.require(not v ? 'result' or v->>'result' in ('success','partial','failure'));
    perform table_backend.require(not v ? 'hideLimits' or jsonb_typeof(v->'hideLimits')='boolean');
    perform table_backend.require(not v ? 'obstacles' or table_backend.str(v->'obstacles',10000,true));
    if v ? 'acted' then
      perform table_backend.require(jsonb_typeof(v->'acted')='array');
      perform table_backend.require(jsonb_array_length(v->'acted')<=100);
      for entry in select value from jsonb_array_elements(v->'acted') loop
        perform table_backend.require(table_backend.ident(entry) and not (entry#>>'{}' = any(ids)));
        ids := array_append(ids,entry#>>'{}');
      end loop;
    end if;
    if v ? 'outcomes' then
      perform table_backend.require(jsonb_typeof(v->'outcomes')='object');
      foreach k in array array['success','partial','failure'] loop
        perform table_backend.require(not (v->'outcomes') ? k or table_backend.str(v->'outcomes'->k,10000,true));
      end loop;
    end if;
    return table_backend.pick(v,array['kind','rounds','difficulty','result','acted','hideLimits','obstacles']) ||
      case when v ? 'outcomes' then jsonb_build_object('outcomes',table_backend.pick(v->'outcomes',array['success','partial','failure'])) else '{}'::jsonb end;
  end if;
  perform table_backend.require(kind='negotiation' and jsonb_typeof(v->'traits')='array');
  perform table_backend.require(jsonb_array_length(v->'traits')<=50);
  perform table_backend.require(not v ? 'npc' or table_backend.str(v->'npc',200,true));
  perform table_backend.require(not v ? 'impression' or table_backend.num(v->'impression'));
  perform table_backend.require(not v ? 'researched' or jsonb_typeof(v->'researched')='boolean');
  perform table_backend.require(not v ? 'result' or v->>'result' in ('accepted','declined'));
  foreach k in array array['initialInterest','initialPatience'] loop
    perform table_backend.require(not v ? k or (table_backend.num(v->k) and (v->>k)::numeric<=5));
  end loop;
  if v ? 'offers' then
    perform table_backend.require(jsonb_typeof(v->'offers')='array');
    perform table_backend.require(jsonb_array_length(v->'offers')<=6);
    for entry in select value from jsonb_array_elements(v->'offers') loop
      perform table_backend.require(table_backend.str(entry,10000,true));
    end loop;
  end if;
  for trait in select value from jsonb_array_elements(v->'traits') loop
    perform table_backend.require(jsonb_typeof(trait)='object' and table_backend.ident(trait->'id') and
      not (trait->>'id'=any(ids)) and table_backend.str(trait->'name',200,true) and
      trait->>'kind' in ('motivation','pitfall') and jsonb_typeof(trait->'revealed')='boolean' and
      (not trait ? 'used' or jsonb_typeof(trait->'used')='boolean'));
    ids := array_append(ids,trait->>'id');
    traits := traits || jsonb_build_array(table_backend.pick(trait,array['id','name','kind','revealed','used']));
  end loop;
  return table_backend.pick(v,array['kind','npc','impression','researched','result','offers','initialInterest','initialPatience']) ||
    jsonb_build_object('traits',traits);
end $$;

alter function table_backend.scene(jsonb) rename to scene_before_challenges;
create function table_backend.scene(v jsonb) returns jsonb
language sql immutable set search_path = pg_catalog as $$
 select table_backend.scene_before_challenges(v) ||
   case when v ? 'challenge' then jsonb_build_object('challenge',table_backend.scene_challenge(v->'challenge',v->>'kind')) else '{}'::jsonb end
$$;

create function table_backend.public_scene_counter(s jsonb, c jsonb) returns jsonb
language sql immutable set search_path = pg_catalog as $$
 select case when s#>>'{challenge,kind}'='montage' and s#>'{challenge,hideLimits}'='true'::jsonb
   and (c->>'id' in ('successes','failures') or lower(btrim(c->>'name')) in ('успехи','провалы'))
   then c - 'max' else c end
$$;

alter function table_backend.public_scene(jsonb) rename to public_scene_before_challenges;
create function table_backend.public_scene(v jsonb) returns jsonb
language sql immutable set search_path = pg_catalog as $$
 select jsonb_set(p.base,'{counters}',coalesce((
   select jsonb_agg(table_backend.public_scene_counter(v,c) order by position)
   from jsonb_array_elements(p.base->'counters') with ordinality counters(c,position)
 ),'[]'::jsonb)) ||
 case v#>>'{challenge,kind}'
 when 'montage' then jsonb_build_object('challenge',table_backend.pick(v->'challenge',array['kind','rounds','result']))
 when 'negotiation' then jsonb_build_object('challenge',table_backend.pick(v->'challenge',array['kind','npc','result']) ||
   jsonb_build_object('traits',coalesce((select jsonb_agg(table_backend.pick(trait,array['id','name','kind','revealed']) order by position)
    from jsonb_array_elements(v#>'{challenge,traits}') with ordinality entries(trait,position) where trait->'revealed'='true'),'[]'::jsonb)))
 else '{}'::jsonb end
 from (select table_backend.public_scene_before_challenges(v) as base) p
$$;

alter function table_backend.project_board(table_backend.tables,boolean) rename to project_board_before_challenges;
create function table_backend.project_board(t table_backend.tables, director boolean) returns jsonb
language sql stable set search_path = pg_catalog as $$
 select case when director then p.base else jsonb_set(p.base,'{counters}',coalesce((
   select jsonb_agg(table_backend.public_scene_counter(s,c) order by position)
   from jsonb_array_elements(p.base->'counters') with ordinality entries(c,position)
   left join lateral (select value from jsonb_array_elements(t.scenes) where value->'id'=c->'sceneId' limit 1) scene(s) on true
 ),'[]'::jsonb)) end
 from (select table_backend.project_board_before_challenges(t,director) as base) p
$$;

revoke all on function table_backend.scene_challenge(jsonb,text), table_backend.scene(jsonb),
  table_backend.public_scene_counter(jsonb,jsonb), table_backend.public_scene(jsonb),
  table_backend.project_board(table_backend.tables,boolean) from public, anon, authenticated;

commit;
