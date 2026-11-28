-- The original catalogue tables and snapshots are retained separately.
create table public.ananai_categories (
  name text primary key check (length(trim(name)) between 1 and 180),
  position integer not null default 10000
);
create table public.ananai_items (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  cat text not null references public.ananai_categories(name),
  position integer not null default -1,
  name text not null check (length(trim(name)) between 1 and 400),
  art text not null default '', price numeric not null check (price >= 0),
  "desc" text not null default '',
  img text not null default '', thumb text not null default '',
  sizes jsonb not null default '[]' check (jsonb_typeof(sizes)='array'),
  colors jsonb not null default '[]' check (jsonb_typeof(colors)='array'),
  version bigint not null default 1
);
create index ananai_items_order on public.ananai_items(position,id);
create index ananai_items_category on public.ananai_items(cat,position,id);
create index ananai_items_price on public.ananai_items(price,id);
create table public.ananai_settings (
  id boolean primary key default true check (id), texts jsonb not null default '[]',
  version bigint not null default 1
);
create table public.ananai_revision (
  id boolean primary key default true check (id), revision bigint not null default 0
);
insert into public.ananai_revision default values;
alter table public.ananai_categories enable row level security;
alter table public.ananai_items enable row level security;
alter table public.ananai_settings enable row level security;
alter table public.ananai_revision enable row level security;
do $$
declare t text;
begin
 foreach t in array array['ananai_categories','ananai_items','ananai_settings','ananai_revision'] loop
   execute format('revoke all on public.%I from public, anon, authenticated',t);
   execute format('grant select on public.%I to anon, authenticated',t);
   execute format('create policy storefront_read on public.%I for select to anon,authenticated using (true)',t);
   if t <> 'ananai_revision' then
     execute format('grant insert,update,delete on public.%I to authenticated',t);
     execute format('create policy storefront_owner on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',t);
   end if;
 end loop;
end $$;
create function private.ananai_bump_row() returns trigger language plpgsql set search_path='' as $$
begin new.version := old.version + 1; return new; end $$;
create function private.ananai_bump_catalog() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.ananai_revision set revision=revision+1 where id; return null; end $$;
revoke all on function private.ananai_bump_catalog(), private.ananai_bump_row() from public, anon, authenticated;
create trigger item_version before update on public.ananai_items for each row execute function private.ananai_bump_row();
create trigger text_version before update on public.ananai_settings for each row execute function private.ananai_bump_row();
create trigger items_changed after insert or update or delete on public.ananai_items for each statement execute function private.ananai_bump_catalog();
create trigger cats_changed after insert or update or delete on public.ananai_categories for each statement execute function private.ananai_bump_catalog();
create trigger texts_changed after insert or update or delete on public.ananai_settings for each statement execute function private.ananai_bump_catalog();

create view public.ananai_sections with (security_invoker=true) as
select c.name,c.position,count(i.id)::integer as total
from public.ananai_categories c left join public.ananai_items i on i.cat=c.name
group by c.name,c.position;
revoke all on public.ananai_sections from public, anon,authenticated;
grant select on public.ananai_sections to anon,authenticated;

create function public.ananai_page(category text default '',term text default '',ordering text default '',page_no integer default 0)
returns setof public.ananai_items language sql stable security invoker set search_path='' as $$
 select i.* from public.ananai_items i join public.ananai_categories c on c.name=i.cat
 where (category='' or i.cat=category)
 and (trim(term)='' or not exists (
   select 1 from regexp_split_to_table(lower(trim(term)), '[[:space:]]+') w
   where strpos(replace(lower(concat_ws(' ',i.name,i.art,i.cat,i."desc",i.colors::text)),'ё','е'),replace(w,'ё','е'))=0
 ))
 order by case when ordering in ('priceUp','priceDown') then (i.price=0)::int end,
 case when ordering='priceUp' then i.price end,
 case when ordering='priceDown' then i.price end desc,
 case when ordering='name' then i.name end,
 c.position,c.name,i.position,i.id
 limit 25 offset (greatest(0,page_no)::bigint*24)
$$;
revoke all on function public.ananai_page(text,text,text,integer) from public;
grant execute on function public.ananai_page(text,text,text,integer) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ananai-shop','ananai-shop',true,6291456,array['image/jpeg','image/png','image/webp']);
create policy ananai_shop_upload on storage.objects for insert to authenticated
with check (bucket_id='ananai-shop' and (select private.is_admin()) and (storage.foldername(name))[1]='owner');
create policy ananai_shop_owner_read on storage.objects for select to authenticated
using (bucket_id='ananai-shop' and (select private.is_admin()));
notify pgrst, 'reload schema';
