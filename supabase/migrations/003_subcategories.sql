-- Subcategories schema, foreign keys, RLS, and catalog RPC extensions
create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 150),
  slug text unique not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  image text not null default '',
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subcategories_category_idx on public.subcategories(category_id);
create index if not exists subcategories_slug_idx on public.subcategories(slug);

create trigger touch_subcategories before update on public.subcategories for each row execute function public.touch_updated_at();

alter table public.subcategories enable row level security;
create policy admin_all_subcategories on public.subcategories for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy public_subcategories on public.subcategories for select to anon,authenticated using(active and exists(select 1 from public.categories c where c.id=category_id and c.active));

grant select on public.subcategories to anon,authenticated;
grant all on public.subcategories to authenticated;

alter table public.products add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null;
create index if not exists products_subcategory_idx on public.products(subcategory_id);

-- Update save_product RPC to persist subcategory_id
create or replace function public.save_product(p_id uuid,p_product jsonb,p_variants jsonb,p_images jsonb,p_collections jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare pid uuid; v jsonb; keep_sizes text[]; begin
 if not public.is_admin() then raise exception 'Admin authorization required';end if;
 pid=coalesce(p_id,gen_random_uuid());
 insert into public.products(id,name,slug,category_id,subcategory_id,short_description,description,fabric,colour,care_instructions,sku,keywords,original_price,selling_price,status,is_featured,is_new_arrival,is_best_seller,meta_title,meta_description)
 values(pid,p_product->>'name',p_product->>'slug',(p_product->>'category_id')::uuid,nullif(p_product->>'subcategory_id','')::uuid,p_product->>'short_description',p_product->>'description',p_product->>'fabric',p_product->>'colour',p_product->>'care_instructions',p_product->>'sku',p_product->>'keywords',nullif(p_product->>'original_price','')::numeric,(p_product->>'selling_price')::numeric,p_product->>'status',(p_product->>'is_featured')::boolean,(p_product->>'is_new_arrival')::boolean,(p_product->>'is_best_seller')::boolean,p_product->>'meta_title',p_product->>'meta_description')
 on conflict(id) do update set name=excluded.name,slug=excluded.slug,category_id=excluded.category_id,subcategory_id=excluded.subcategory_id,short_description=excluded.short_description,description=excluded.description,fabric=excluded.fabric,colour=excluded.colour,care_instructions=excluded.care_instructions,sku=excluded.sku,keywords=excluded.keywords,original_price=excluded.original_price,selling_price=excluded.selling_price,status=excluded.status,is_featured=excluded.is_featured,is_new_arrival=excluded.is_new_arrival,is_best_seller=excluded.is_best_seller,meta_title=excluded.meta_title,meta_description=excluded.meta_description;
 select array_agg(x->>'size') into keep_sizes from jsonb_array_elements(p_variants) x;
 delete from public.product_variants where product_id=pid and not(size=any(keep_sizes));
 for v in select * from jsonb_array_elements(p_variants) loop
 insert into public.product_variants(product_id,size,stock_quantity,active,sku) values(pid,v->>'size',(v->>'stock_quantity')::integer,(v->>'active')::boolean,coalesce(v->>'sku','')) on conflict(product_id,size) do update set stock_quantity=excluded.stock_quantity,active=excluded.active,sku=excluded.sku;
 end loop;
 delete from public.product_images where product_id=pid;
 insert into public.product_images(product_id,storage_path,alt_text,sort_order,is_cover) select pid,x->>'storage_path',coalesce(x->>'alt_text',''),(x->>'sort_order')::integer,(x->>'is_cover')::boolean from jsonb_array_elements(p_images) x;
 delete from public.product_collections where product_id=pid;
 insert into public.product_collections(product_id,collection_id) select pid,x::text::uuid from jsonb_array_elements_text(p_collections) x;
 return pid;end; $$;

-- Drop old 12-parameter overload so catalog_search is unambiguous
drop function if exists public.catalog_search(text,text,text,text,numeric,numeric,text,text,boolean,boolean,integer,integer);

-- Update catalog_search RPC to accept subcategory filter and hydrate subcategories object
create or replace function public.catalog_search(p_query text default null,p_category text default null,p_collection text default null,p_size text default null,p_min numeric default null,p_max numeric default null,p_availability text default null,p_sort text default 'newest',p_new boolean default false,p_best boolean default false,p_page integer default 1,p_limit integer default 24,p_subcategory text default null)
returns jsonb language sql stable security invoker set search_path=public as $$
 with filtered as (
 select p.* from public.products p
 join public.categories c on c.id=p.category_id
 left join public.subcategories sc on sc.id=p.subcategory_id
 where p.status='active' and c.active and (p.subcategory_id is null or sc.active)
 and (p_query is null or p.name ilike '%'||left(p_query,200)||'%' or p.keywords ilike '%'||left(p_query,200)||'%')
 and (p_category is null or c.slug=p_category)
 and (p_subcategory is null or sc.slug=p_subcategory)
 and (p_collection is null or exists(select 1 from public.product_collections pc join public.collections co on co.id=pc.collection_id where pc.product_id=p.id and co.slug=p_collection and co.active))
 and (p_size is null or exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and v.size=p_size and (case when p_availability='out-of-stock' then v.stock_quantity=0 else v.stock_quantity>0 end)))
 and (p_min is null or p.selling_price>=p_min) and (p_max is null or p.selling_price<=p_max)
 and (p_availability is null or (p_availability='in-stock' and exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and v.stock_quantity>0)) or (p_availability='out-of-stock' and not exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and v.stock_quantity>0)))
 and (not p_new or p.is_new_arrival) and (not p_best or p.is_best_seller)
 ), page as (
 select p.* from filtered p order by case when p_sort='price-asc' then p.selling_price end asc, case when p_sort='price-desc' then p.selling_price end desc, case when p_sort='featured' then p.is_featured end desc,p.created_at desc,p.id
 limit least(greatest(p_limit,1),100) offset (greatest(p_page,1)-1)*least(greatest(p_limit,1),100)
 ), hydrated as (
 select to_jsonb(p)||jsonb_build_object(
   'product_images',coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.product_images i where i.product_id=p.id),'[]'::jsonb),
   'product_variants',coalesce((select jsonb_agg(to_jsonb(v)) from public.product_variants v where v.product_id=p.id and v.active),'[]'::jsonb),
   'product_collections',coalesce((select jsonb_agg(jsonb_build_object('collection_id',pc.collection_id)) from public.product_collections pc where pc.product_id=p.id),'[]'::jsonb),
   'categories',(select jsonb_build_object('name',c.name,'slug',c.slug) from public.categories c where c.id=p.category_id),
   'subcategories',coalesce((select jsonb_build_object('name',sc.name,'slug',sc.slug) from public.subcategories sc where sc.id=p.subcategory_id),null)
 ) as item from page p
 ) select jsonb_build_object('count',(select count(*) from filtered),'products',coalesce((select jsonb_agg(item) from hydrated),'[]'::jsonb)); $$;

grant execute on function public.catalog_search(text,text,text,text,numeric,numeric,text,text,boolean,boolean,integer,integer,text) to anon,authenticated;
