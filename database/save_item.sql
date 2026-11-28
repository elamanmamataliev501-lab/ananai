create function public.ananai_save_item(item jsonb, expected_version bigint)
returns public.ananai_items language plpgsql security invoker set search_path='' as $$
declare result public.ananai_items;
begin
  if not (select private.is_admin()) then raise insufficient_privilege;end if;
  insert into public.ananai_categories(name) values(item->>'cat') on conflict(name) do nothing;
  if expected_version is null then
    insert into public.ananai_items(id,cat,name,art,price,"desc",img,thumb,sizes,colors)
    values(item->>'id',item->>'cat',item->>'name',item->>'art',(item->>'price')::numeric,
      item->>'desc',item->>'img',item->>'thumb',item->'sizes',item->'colors') returning * into result;
  else
    update public.ananai_items set cat=item->>'cat',name=item->>'name',art=item->>'art',
      price=(item->>'price')::numeric,"desc"=item->>'desc',img=item->>'img',thumb=item->>'thumb',
      sizes=item->'sizes',colors=item->'colors' where id=item->>'id' and version=expected_version returning * into result;
    if not found then raise exception 'Товар уже изменён. Откройте его снова.';end if;
  end if;
  return result;
end $$;
revoke all on function public.ananai_save_item(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.ananai_save_item(jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
