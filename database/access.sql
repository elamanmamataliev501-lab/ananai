-- Restrict the legacy snapshot API once the new storefront is live.
revoke execute on function public.ananai_read(bigint), public.ananai_owner(text),
  public.ananai_publish(text,bigint,jsonb), public.ananai_password(text,text)
  from public,anon,authenticated;
do $$
declare t text;
begin
 foreach t in array array['ananai_categories','ananai_items','ananai_settings'] loop
   execute format('drop policy storefront_owner on public.%I',t);
   execute format('create policy storefront_owner_insert on public.%I for insert to authenticated with check ((select private.is_admin()))',t);
   execute format('create policy storefront_owner_update on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',t);
   execute format('create policy storefront_owner_delete on public.%I for delete to authenticated using ((select private.is_admin()))',t);
 end loop;
end $$;
notify pgrst,'reload schema';
