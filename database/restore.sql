create function public.ananai_restore(catalog jsonb, expected_revision bigint)
returns integer language plpgsql security invoker set search_path='' as $$
declare
  before_revision bigint;
  total integer;
begin
  if not (select private.is_admin()) then raise insufficient_privilege;end if;
  -- Serialize imports and ordinary mutations before comparing a backup preview's revision.
  lock table public.ananai_categories,public.ananai_items,public.ananai_settings in share row exclusive mode;
  select revision into before_revision from public.ananai_revision where id;
  if before_revision<>expected_revision then raise exception 'Каталог изменился. Повторите импорт.';end if;
  total:=jsonb_array_length(catalog->'items');
  if total<1 or total>10000 then raise exception 'Некорректное количество товаров.';end if;
  insert into public.ananai_categories(name,position)
  select c->>'name',(c->>'position')::integer from jsonb_array_elements(catalog->'categories') c
  on conflict(name) do update set position=excluded.position;
  insert into public.ananai_items(id,cat,position,name,art,price,"desc",img,thumb,sizes,colors)
  select x.id,x.cat,x.position,x.name,x.art,x.price,x."desc",x.img,x.thumb,x.sizes,x.colors
  from jsonb_populate_recordset(null::public.ananai_items,catalog->'items') x
  on conflict(id) do update set cat=excluded.cat,position=excluded.position,name=excluded.name,
    art=excluded.art,price=excluded.price,"desc"=excluded."desc",img=excluded.img,thumb=excluded.thumb,
    sizes=excluded.sizes,colors=excluded.colors;
  if jsonb_typeof(catalog->'texts')='array' then
    update public.ananai_settings set texts=catalog->'texts' where id;
  end if;
  return total;
end $$;
revoke all on function public.ananai_restore(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.ananai_restore(jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
