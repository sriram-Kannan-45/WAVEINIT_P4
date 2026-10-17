-- Run once in the Supabase SQL editor or through `supabase db push`.
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create table public.admin_roles (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admin_roles where user_id=auth.uid()); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
create table public.categories (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 150), slug text unique not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), description text not null default '', image text not null default '', active boolean not null default true, display_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.collections (like public.categories including all);
alter table public.collections add column featured boolean not null default false;
create table public.products (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 200), slug text unique not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), category_id uuid not null references public.categories(id) on delete restrict,
 short_description text not null default '', description text not null default '', fabric text not null default '', colour text not null default '', care_instructions text not null default '', sku text not null default '', keywords text not null default '',
 original_price numeric(12,2) check(original_price>=0), selling_price numeric(12,2) not null check(selling_price>=0), status text not null default 'draft' check(status in ('draft','active','hidden')), is_featured boolean not null default false, is_new_arrival boolean not null default false, is_best_seller boolean not null default false,
 meta_title text not null default '', meta_description text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_images (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, storage_path text not null, alt_text text not null default '', sort_order integer not null default 0, is_cover boolean not null default false, created_at timestamptz not null default now()
);
create unique index product_cover on public.product_images(product_id) where is_cover;
create table public.product_variants (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, size text not null check(length(trim(size)) between 1 and 40), stock_quantity integer not null default 0 check(stock_quantity>=0), active boolean not null default true, sku text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(product_id,size)
);
create table public.product_collections (product_id uuid not null references public.products(id) on delete cascade, collection_id uuid not null references public.collections(id) on delete cascade, primary key(product_id,collection_id));
create table public.store_settings (
 id integer primary key default 1 check(id=1), business_name text not null default 'Achu Designer Boutique', whatsapp_number text not null default '', phone_number text not null default '', instagram_url text not null default '', email text not null default '', address text not null default '', maps_url text not null default '', map_embed_url text not null default '', opening_hours text not null default '', currency text not null default 'INR' check(currency='INR'), low_stock_threshold integer not null default 3 check(low_stock_threshold>=0), about_heading text not null default 'About Achu Designer Boutique', about_story text not null default '', about_philosophy text not null default '', size_guide jsonb not null default '[]', updated_at timestamptz not null default now()
);
create table public.homepage_settings (
 id integer primary key default 1 check(id=1), hero_image text not null default '', hero_mobile_image text not null default '', hero_heading text not null default E'Elegance,\nin every detail.', hero_subtitle text not null default 'Discover our collection of Indian wear.', hero_enabled boolean not null default true,
 primary_text text not null default 'Explore the collection', primary_url text not null default '/shop', secondary_text text not null default 'Discover new arrivals', secondary_url text not null default '/shop?new=true',
 featured_collection_id uuid references public.collections(id) on delete set null, featured_title text not null default 'Made for memorable moments.', featured_description text not null default '', featured_image text not null default '', promo_image text not null default '', promo_heading text not null default 'Discover the occasion edit', promo_subtitle text not null default '', promo_text text not null default 'Discover the edit', promo_url text not null default '/collections',
 show_categories boolean not null default true, show_new_arrivals boolean not null default true, show_featured boolean not null default true, show_best_sellers boolean not null default true, show_promo boolean not null default false, show_instagram boolean not null default true, show_store boolean not null default true, updated_at timestamptz not null default now()
);
create table public.policies (id uuid primary key default gen_random_uuid(), slug text unique not null check(slug in ('shipping-policy','return-exchange','privacy-policy','terms')), title text not null, content text not null default '', updated_at timestamptz not null default now());
create table public.order_enquiries (
 id uuid primary key default gen_random_uuid(), order_reference text unique not null, idempotency_key uuid unique not null, request_hash text not null,
 customer_name text not null, phone text not null, alternate_phone text not null default '', address text not null, city text not null, state text not null, pincode text not null check(pincode ~ '^[1-9][0-9]{5}$'), landmark text not null default '', customer_note text not null default '', subtotal numeric(12,2) not null check(subtotal>=0), status text not null default 'new' check(status in ('new','contacted','confirmed','cancelled','completed')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.order_enquiry_items (
 id uuid primary key default gen_random_uuid(), order_enquiry_id uuid not null references public.order_enquiries(id) on delete cascade, product_id uuid references public.products(id) on delete set null, variant_id uuid references public.product_variants(id) on delete set null, product_name_snapshot text not null, size_snapshot text not null, quantity integer not null check(quantity between 1 and 99), unit_price_snapshot numeric(12,2) not null check(unit_price_snapshot>=0), subtotal_snapshot numeric(12,2) not null check(subtotal_snapshot>=0)
);
create table public.request_limits (key text primary key, window_start timestamptz not null, attempts integer not null);
create index products_category_idx on public.products(category_id);
create index products_status_created_idx on public.products(status,created_at desc);
create index products_name_search_idx on public.products using gin(name gin_trgm_ops);
create index products_keywords_search_idx on public.products using gin(keywords gin_trgm_ops);
create index request_limits_window_idx on public.request_limits(window_start);
create index variants_product_idx on public.product_variants(product_id);
create index images_product_idx on public.product_images(product_id);
create index product_collections_collection_idx on public.product_collections(collection_id);
create index enquiry_created_idx on public.order_enquiries(created_at desc);
create index enquiry_status_idx on public.order_enquiries(status);
create index enquiry_items_parent_idx on public.order_enquiry_items(order_enquiry_id);
create index enquiry_items_product_idx on public.order_enquiry_items(product_id);
create index enquiry_items_variant_idx on public.order_enquiry_items(variant_id);
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
do $$ declare t text; begin foreach t in array array['categories','collections','products','product_variants','store_settings','homepage_settings','policies','order_enquiries'] loop execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()',t,t);end loop;end $$;
-- Public reads are restricted to published content; every write also checks the admin role.
do $$ declare t text; begin foreach t in array array['admin_roles','categories','collections','products','product_images','product_variants','product_collections','store_settings','homepage_settings','policies','order_enquiries','order_enquiry_items','request_limits'] loop execute format('alter table public.%I enable row level security',t);end loop;end $$;
create policy own_admin_role on public.admin_roles for select to authenticated using(user_id=auth.uid());
-- Admin roles are provisioned only through the SQL editor/service role, never self-granted.
do $$ declare t text; begin foreach t in array array['categories','collections','products','product_images','product_variants','product_collections','store_settings','homepage_settings','policies','order_enquiries','order_enquiry_items'] loop execute format('create policy admin_all on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);end loop;end $$;
create policy public_categories on public.categories for select to anon,authenticated using(active);
create policy public_collections on public.collections for select to anon,authenticated using(active);
create policy public_products on public.products for select to anon,authenticated using(status='active' and exists(select 1 from public.categories c where c.id=category_id and c.active));
create policy public_images on public.product_images for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id and p.status='active'));
create policy public_variants on public.product_variants for select to anon,authenticated using(active and exists(select 1 from public.products p where p.id=product_id and p.status='active'));
create policy public_product_collections on public.product_collections for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id and p.status='active') and exists(select 1 from public.collections c where c.id=collection_id and c.active));
create policy public_store on public.store_settings for select to anon,authenticated using(true);
create policy public_homepage on public.homepage_settings for select to anon,authenticated using(true);
create policy public_policies on public.policies for select to anon,authenticated using(true);
grant select on public.categories,public.collections,public.products,public.product_images,public.product_variants,public.product_collections,public.store_settings,public.homepage_settings,public.policies to anon,authenticated;
grant select on public.admin_roles to authenticated;
grant all on public.categories,public.collections,public.products,public.product_images,public.product_variants,public.product_collections,public.store_settings,public.homepage_settings,public.policies,public.order_enquiries,public.order_enquiry_items to authenticated;
revoke all on public.request_limits from anon,authenticated;
-- SECURITY INVOKER retains RLS and avoids loading the full catalog in JavaScript.
create or replace function public.catalog_search(p_query text default null,p_category text default null,p_collection text default null,p_size text default null,p_min numeric default null,p_max numeric default null,p_availability text default null,p_sort text default 'newest',p_new boolean default false,p_best boolean default false,p_page integer default 1,p_limit integer default 24)
returns jsonb language sql stable security invoker set search_path=public as $$
 with filtered as (
 select p.* from public.products p join public.categories c on c.id=p.category_id
 where p.status='active' and c.active
 and (p_query is null or p.name ilike '%'||left(p_query,200)||'%' or p.keywords ilike '%'||left(p_query,200)||'%')
 and (p_category is null or c.slug=p_category)
 and (p_collection is null or exists(select 1 from public.product_collections pc join public.collections co on co.id=pc.collection_id where pc.product_id=p.id and co.slug=p_collection and co.active))
 and (p_size is null or exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and v.size=p_size and (case when p_availability='out-of-stock' then v.stock_quantity=0 else v.stock_quantity>0 end)))
 and (p_min is null or p.selling_price>=p_min) and (p_max is null or p.selling_price<=p_max)
 and (p_availability is null or (p_availability='in-stock' and exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and v.stock_quantity>0)) or (p_availability='out-of-stock' and not exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and v.stock_quantity>0)))
 and (not p_new or p.is_new_arrival) and (not p_best or p.is_best_seller)
 ), page as (
 select p.* from filtered p order by case when p_sort='price-asc' then p.selling_price end asc, case when p_sort='price-desc' then p.selling_price end desc, case when p_sort='featured' then p.is_featured end desc,p.created_at desc,p.id
 limit least(greatest(p_limit,1),100) offset (greatest(p_page,1)-1)*least(greatest(p_limit,1),100)
 ), hydrated as (
 select to_jsonb(p)||jsonb_build_object('product_images',coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.product_images i where i.product_id=p.id),'[]'::jsonb),'product_variants',coalesce((select jsonb_agg(to_jsonb(v)) from public.product_variants v where v.product_id=p.id and v.active),'[]'::jsonb),'product_collections',coalesce((select jsonb_agg(jsonb_build_object('collection_id',pc.collection_id)) from public.product_collections pc where pc.product_id=p.id),'[]'::jsonb),'categories',(select jsonb_build_object('name',c.name,'slug',c.slug) from public.categories c where c.id=p.category_id)) as item from page p
 ) select jsonb_build_object('count',(select count(*) from filtered),'products',coalesce((select jsonb_agg(item) from hydrated),'[]'::jsonb)); $$;
grant execute on function public.catalog_search to anon,authenticated;
-- Atomic product save: editing sizes retains IDs used by persisted carts.
create or replace function public.save_product(p_id uuid,p_product jsonb,p_variants jsonb,p_images jsonb,p_collections jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare pid uuid; v jsonb; keep_sizes text[]; begin
 if not public.is_admin() then raise exception 'Admin authorization required';end if;
 pid=coalesce(p_id,gen_random_uuid());
 insert into public.products(id,name,slug,category_id,short_description,description,fabric,colour,care_instructions,sku,keywords,original_price,selling_price,status,is_featured,is_new_arrival,is_best_seller,meta_title,meta_description)
 values(pid,p_product->>'name',p_product->>'slug',(p_product->>'category_id')::uuid,p_product->>'short_description',p_product->>'description',p_product->>'fabric',p_product->>'colour',p_product->>'care_instructions',p_product->>'sku',p_product->>'keywords',nullif(p_product->>'original_price','')::numeric,(p_product->>'selling_price')::numeric,p_product->>'status',(p_product->>'is_featured')::boolean,(p_product->>'is_new_arrival')::boolean,(p_product->>'is_best_seller')::boolean,p_product->>'meta_title',p_product->>'meta_description')
 on conflict(id) do update set name=excluded.name,slug=excluded.slug,category_id=excluded.category_id,short_description=excluded.short_description,description=excluded.description,fabric=excluded.fabric,colour=excluded.colour,care_instructions=excluded.care_instructions,sku=excluded.sku,keywords=excluded.keywords,original_price=excluded.original_price,selling_price=excluded.selling_price,status=excluded.status,is_featured=excluded.is_featured,is_new_arrival=excluded.is_new_arrival,is_best_seller=excluded.is_best_seller,meta_title=excluded.meta_title,meta_description=excluded.meta_description;
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
revoke all on function public.save_product from public,anon;
grant execute on function public.save_product to authenticated;
-- Persistent rate limiting works across serverless instances. Only service-role may invoke it.
create or replace function public.consume_rate_limit(p_key text,p_max integer,p_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer; begin
 insert into public.request_limits(key,window_start,attempts) values(p_key,now(),1)
 on conflict(key) do update set attempts=case when request_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else request_limits.attempts+1 end,window_start=case when request_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else request_limits.window_start end returning attempts into n;
 delete from public.request_limits where window_start<now()-interval '1 day';return n<=p_max;end; $$;
revoke all on function public.consume_rate_limit from public,anon,authenticated;
grant execute on function public.consume_rate_limit to service_role;
create or replace function public.create_enquiry(p_customer jsonb,p_items jsonb,p_key uuid,p_hash text,p_rate_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.order_enquiries; item jsonb; p public.products; v public.product_variants; total numeric(12,2)=0; qty integer; snapshots jsonb='[]'; ref text; wn text;
begin
 -- Serialize retries, so the same request cannot create two enquiries.
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into e from public.order_enquiries where idempotency_key=p_key;
 if found then
  if e.request_hash<>p_hash then raise exception 'Enquiry request changed. Please retry.';end if;
  select coalesce(jsonb_agg(jsonb_build_object('name',product_name_snapshot,'size',size_snapshot,'quantity',quantity,'price',unit_price_snapshot)),'[]') into snapshots from public.order_enquiry_items where order_enquiry_id=e.id;
  select whatsapp_number into wn from public.store_settings where id=1;
  return jsonb_build_object('reference',e.order_reference,'subtotal',e.subtotal,'items',snapshots,'whatsapp_number',wn);
 end if;
 if not public.consume_rate_limit(p_rate_key,5,600) then raise exception 'Too many enquiries. Please wait a few minutes.';end if;
 select whatsapp_number into wn from public.store_settings where id=1;
 if wn is null or wn !~ '^[1-9][0-9]{7,14}$' then raise exception 'WhatsApp ordering is not configured. Please contact the boutique.';end if;
 if jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Cart must contain between 1 and 30 items';end if;
 if (select count(distinct x->>'variant_id') from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then raise exception 'Duplicate cart variants';end if;
 -- Stable lock order avoids deadlocks. Prices and variants cannot change during validation/snapshot.
 perform 1 from public.products where id in(select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x) order by id for share;
 perform 1 from public.product_variants where id in(select (x->>'variant_id')::uuid from jsonb_array_elements(p_items) x) order by id for share;
 for item in select * from jsonb_array_elements(p_items) loop
  select * into p from public.products where id=(item->>'product_id')::uuid and status='active';
  if not found or not exists(select 1 from public.categories where id=p.category_id and active) then raise exception 'A product is no longer available. Please update your cart.';end if;
  select * into v from public.product_variants where id=(item->>'variant_id')::uuid and product_id=p.id and active;
  qty=(item->>'quantity')::integer;
  if not found or qty not between 1 and 99 then raise exception 'A selected size is no longer available.';end if;
  if v.stock_quantity<qty then raise exception 'Stock has changed for % (%). Only % available.',p.name,v.size,v.stock_quantity;end if;
  if p.selling_price<> (item->>'expected_price')::numeric then raise exception 'Price has changed for %. Please refresh your cart.',p.name;end if;
  total=total+p.selling_price*qty;
  snapshots=snapshots||jsonb_build_array(jsonb_build_object('product_id',p.id,'variant_id',v.id,'name',p.name,'size',v.size,'quantity',qty,'price',p.selling_price));
 end loop;
 ref='ACHU-'||to_char(now() at time zone 'Asia/Kolkata','YYYYMMDD')||'-'||upper(encode(gen_random_bytes(6),'hex'));
 insert into public.order_enquiries(order_reference,idempotency_key,request_hash,customer_name,phone,alternate_phone,address,city,state,pincode,landmark,customer_note,subtotal)
 values(ref,p_key,p_hash,p_customer->>'full_name',p_customer->>'phone',coalesce(p_customer->>'alternate_phone',''),concat_ws(', ',p_customer->>'address_line_1',nullif(p_customer->>'address_line_2','')),p_customer->>'city',p_customer->>'state',p_customer->>'pincode',coalesce(p_customer->>'landmark',''),coalesce(p_customer->>'note',''),total) returning * into e;
 insert into public.order_enquiry_items(order_enquiry_id,product_id,variant_id,product_name_snapshot,size_snapshot,quantity,unit_price_snapshot,subtotal_snapshot)
 select e.id,(x->>'product_id')::uuid,(x->>'variant_id')::uuid,x->>'name',x->>'size',(x->>'quantity')::integer,(x->>'price')::numeric,(x->>'price')::numeric*(x->>'quantity')::integer from jsonb_array_elements(snapshots) x;
 return jsonb_build_object('reference',ref,'subtotal',total,'items',snapshots,'whatsapp_number',wn);
end; $$;
revoke all on function public.create_enquiry from public,anon,authenticated;
grant execute on function public.create_enquiry to service_role;
insert into public.store_settings(id) values(1);
insert into public.homepage_settings(id) values(1);
insert into public.policies(slug,title,content) values
 ('shipping-policy','Shipping policy','Policy not yet published. Please contact the boutique for shipping details.'),
 ('return-exchange','Returns & exchanges','Policy not yet published. Please contact the boutique for return and exchange details.'),
 ('privacy-policy','Privacy policy','Policy not yet published. The owner must publish the applicable privacy notice before accepting enquiries.'),
 ('terms','Terms & conditions','Terms not yet published. The owner must publish applicable terms before launch.');
-- One public read bucket, separated by logical folders. Writes require an explicit admin role.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('boutique','boutique',true,5242880,array['image/jpeg','image/png','image/webp','image/avif']);
create policy boutique_public_read on storage.objects for select to anon,authenticated using(bucket_id='boutique');
create policy boutique_admin_insert on storage.objects for insert to authenticated with check(bucket_id='boutique' and public.is_admin());
create policy boutique_admin_update on storage.objects for update to authenticated using(bucket_id='boutique' and public.is_admin()) with check(bucket_id='boutique' and public.is_admin());
create policy boutique_admin_delete on storage.objects for delete to authenticated using(bucket_id='boutique' and public.is_admin());
create or replace function public.admin_dashboard() returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb; begin
 if not public.is_admin() then raise exception 'Admin authorization required';end if;
 with stock as(select p.id,p.name,p.slug,p.status,coalesce(sum(v.stock_quantity) filter(where v.active),0) total from public.products p left join public.product_variants v on v.product_id=p.id group by p.id),threshold as(select low_stock_threshold value from public.store_settings where id=1)
 select jsonb_build_object('total_products',(select count(*) from public.products),'active_products',(select count(*) from public.products where status='active'),'out_of_stock',(select count(*) from stock where total=0),'low_stock',(select count(*) from stock,threshold where total between 1 and threshold.value),'categories',(select count(*) from public.categories),'collections',(select count(*) from public.collections),'new_enquiries',(select count(*) from public.order_enquiries where status='new'),'low_stock_products',coalesce((select jsonb_agg(to_jsonb(s)) from(select * from stock where total<=coalesce((select value from threshold),3) order by total,name limit 8)s),'[]'::jsonb)) into result;
 return result;end; $$;
revoke all on function public.admin_dashboard from public,anon;
grant execute on function public.admin_dashboard to authenticated;
create or replace function public.admin_product_list(p_query text default '',p_category uuid default null,p_status text default '',p_stock text default '',p_page integer default 1) returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;begin
 if not public.is_admin() then raise exception 'Admin authorization required';end if;
 with stocks as(select product_id,sum(stock_quantity) filter(where active) total from public.product_variants group by product_id), filtered as(select p.*,coalesce(s.total,0) total_stock from public.products p left join stocks s on s.product_id=p.id where (p_query='' or p.name ilike '%'||left(p_query,200)||'%') and (p_category is null or p.category_id=p_category) and (p_status='' or p.status=p_status) and (p_stock='' or(p_stock='out' and coalesce(s.total,0)=0) or(p_stock='low' and s.total between 1 and (select low_stock_threshold from public.store_settings where id=1)))),paged as(select * from filtered order by updated_at desc,id limit 30 offset (greatest(p_page,1)-1)*30),hydrated as(select to_jsonb(p)||jsonb_build_object('categories',(select jsonb_build_object('name',c.name,'slug',c.slug) from public.categories c where c.id=p.category_id),'product_images',coalesce((select jsonb_agg(to_jsonb(i) order by i.is_cover desc,i.sort_order) from public.product_images i where i.product_id=p.id),'[]')) item from paged p)
 select jsonb_build_object('count',(select count(*) from filtered),'products',coalesce((select jsonb_agg(item) from hydrated),'[]')) into result;return result;end; $$;
revoke all on function public.admin_product_list from public,anon;
grant execute on function public.admin_product_list to authenticated;
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
-- ============================================================================
-- Migration 004: Dynamic Inventory, Notifications & New Arrivals Management
-- ============================================================================

-- 1. Variant-specific pricing on product_variants
alter table public.product_variants add column if not exists price numeric(12,2) check(price is null or price >= 0);

-- 2. Stock deduction tracking on order_enquiries
alter table public.order_enquiries add column if not exists stock_deducted boolean not null default false;

-- 3. Admin Inventory Notifications table
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check(type in ('out_of_stock', 'low_stock', 'restocked')),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  title text not null,
  message text not null,
  product_name text not null,
  size text not null default '',
  stock_quantity integer not null default 0,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_read_created_idx on public.admin_notifications(read, created_at desc);
create index if not exists notifications_product_idx on public.admin_notifications(product_id);

alter table public.admin_notifications enable row level security;
create policy admin_all_notifications on public.admin_notifications for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant all on public.admin_notifications to authenticated;

-- Trigger to create notifications automatically when stock drops to 0 or low-stock
create or replace function public.notify_on_stock_change() returns trigger language plpgsql security definer set search_path=public as $$
declare
  p_name text;
  thresh integer;
begin
  select name into p_name from public.products where id = new.product_id;
  if p_name is null then return new; end if;
  select coalesce(low_stock_threshold, 3) into thresh from public.store_settings where id = 1;
  if thresh is null then thresh := 3; end if;

  -- 1. Out of stock trigger (went from >0 to 0, or inserted with 0)
  if new.stock_quantity = 0 and (TG_OP = 'INSERT' or old.stock_quantity > 0) then
    insert into public.admin_notifications(type, product_id, variant_id, title, message, product_name, size, stock_quantity)
    values(
      'out_of_stock',
      new.product_id,
      new.id,
      'Out of stock: ' || p_name || ' (' || new.size || ')',
      p_name || ' size ' || new.size || ' is now completely sold out (0 units remaining).',
      p_name,
      new.size,
      0
    );
  -- 2. Low stock trigger (went from > threshold to <= threshold and > 0)
  elsif new.stock_quantity > 0 and new.stock_quantity <= thresh and (TG_OP = 'INSERT' or old.stock_quantity > thresh) then
    insert into public.admin_notifications(type, product_id, variant_id, title, message, product_name, size, stock_quantity)
    values(
      'low_stock',
      new.product_id,
      new.id,
      'Low stock warning: ' || p_name || ' (' || new.size || ')',
      p_name || ' size ' || new.size || ' has reached low stock (' || new.stock_quantity || ' remaining).',
      p_name,
      new.size,
      new.stock_quantity
    );
  end if;

  return new;
end; $$;

drop trigger if exists trigger_notify_stock on public.product_variants;
create trigger trigger_notify_stock after insert or update of stock_quantity on public.product_variants for each row execute function public.notify_on_stock_change();

-- 4. New Arrivals Management Table
create table if not exists public.new_arrivals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  display_order integer not null default 0,
  badge_text text not null default 'NEW',
  start_date timestamptz,
  end_date timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id)
);

create index if not exists new_arrivals_order_idx on public.new_arrivals(display_order asc, created_at desc);
create trigger touch_new_arrivals before update on public.new_arrivals for each row execute function public.touch_updated_at();

alter table public.new_arrivals enable row level security;
create policy admin_all_new_arrivals on public.new_arrivals for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy public_new_arrivals on public.new_arrivals for select to anon,authenticated using(
  active and
  (start_date is null or start_date <= now()) and
  (end_date is null or end_date >= now()) and
  exists(
    select 1 from public.products p
    join public.categories c on c.id = p.category_id
    where p.id = product_id and p.status = 'active' and c.active
  )
);

grant select on public.new_arrivals to anon,authenticated;
grant all on public.new_arrivals to authenticated;

-- 5. Updated save_product RPC to persist size-specific variant pricing
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
 insert into public.product_variants(product_id,size,stock_quantity,active,sku,price)
 values(
   pid,
   v->>'size',
   (v->>'stock_quantity')::integer,
   (v->>'active')::boolean,
   coalesce(v->>'sku',''),
   nullif(v->>'price','')::numeric
 )
 on conflict(product_id,size) do update set
   stock_quantity=excluded.stock_quantity,
   active=excluded.active,
   sku=excluded.sku,
   price=excluded.price;
 end loop;
 delete from public.product_images where product_id=pid;
 insert into public.product_images(product_id,storage_path,alt_text,sort_order,is_cover) select pid,x->>'storage_path',coalesce(x->>'alt_text',''),(x->>'sort_order')::integer,(x->>'is_cover')::boolean from jsonb_array_elements(p_images) x;
 delete from public.product_collections where product_id=pid;
 insert into public.product_collections(product_id,collection_id) select pid,x::text::uuid from jsonb_array_elements_text(p_collections) x;
 return pid;end; $$;

-- 6. Atomic order status and stock deduction/restoration RPC
create or replace function public.admin_set_enquiry_status(p_enquiry_id uuid, p_status text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  e public.order_enquiries;
  item record;
  deduct boolean;
  restore boolean;
begin
  if not public.is_admin() then raise exception 'Admin authorization required'; end if;
  if p_status not in ('new', 'contacted', 'confirmed', 'cancelled', 'completed') then
    raise exception 'Invalid status %', p_status;
  end if;

  select * into e from public.order_enquiries where id = p_enquiry_id for update;
  if not found then raise exception 'Order enquiry not found'; end if;

  deduct := (p_status in ('confirmed', 'completed') and not e.stock_deducted);
  restore := (p_status = 'cancelled' and e.stock_deducted);

  if deduct then
    for item in select variant_id, quantity from public.order_enquiry_items where order_enquiry_id = e.id and variant_id is not null loop
      update public.product_variants
      set stock_quantity = greatest(0, stock_quantity - item.quantity)
      where id = item.variant_id;
    end loop;
    update public.order_enquiries set status = p_status, stock_deducted = true where id = e.id;
  elsif restore then
    for item in select variant_id, quantity from public.order_enquiry_items where order_enquiry_id = e.id and variant_id is not null loop
      update public.product_variants
      set stock_quantity = stock_quantity + item.quantity
      where id = item.variant_id;
    end loop;
    update public.order_enquiries set status = p_status, stock_deducted = false where id = e.id;
  else
    update public.order_enquiries set status = p_status where id = e.id;
  end if;

  return jsonb_build_object('ok', true, 'status', p_status, 'stock_deducted', (case when deduct then true when restore then false else e.stock_deducted end));
end; $$;
-- ============================================================================
-- Migration 005: Dedicated Admin Users, Scrypt/Argon2 Hashes & Rotating Refresh Tokens
-- ============================================================================

-- 1. Dedicated Admin Users table for direct administrative accounts
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null check(length(trim(username)) between 3 and 100),
  email text unique not null,
  password_hash text not null,
  role text not null default 'admin' check(role in ('admin', 'superadmin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_users_username_idx on public.admin_users(username);
create index if not exists admin_users_email_idx on public.admin_users(email);

create trigger touch_admin_users before update on public.admin_users
  for each row execute function public.touch_updated_at();

-- 2. Rotating Refresh Tokens table with family-based reuse detection
create table if not exists public.admin_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admin_users(id) on delete cascade,
  token_hash text unique not null,
  family_id uuid not null default gen_random_uuid(),
  is_revoked boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  user_agent text not null default '',
  ip_address text not null default ''
);

create index if not exists refresh_tokens_hash_idx on public.admin_refresh_tokens(token_hash);
create index if not exists refresh_tokens_family_idx on public.admin_refresh_tokens(family_id);
create index if not exists refresh_tokens_admin_exp_idx on public.admin_refresh_tokens(admin_id, expires_at);

-- 3. Row Level Security: Admin auth tables are strictly isolated to service_role
alter table public.admin_users enable row level security;
alter table public.admin_refresh_tokens enable row level security;

revoke all on public.admin_users from public, anon, authenticated;
revoke all on public.admin_refresh_tokens from public, anon, authenticated;

grant all on public.admin_users to service_role;
grant all on public.admin_refresh_tokens to service_role;

-- 4. Atomic token rotation with reuse detection
create or replace function public.rotate_admin_refresh_token(
  p_old_token_hash text,
  p_new_token_hash text,
  p_expires_at timestamptz,
  p_user_agent text default '',
  p_ip_address text default ''
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_rec record;
  v_family uuid;
  v_admin_id uuid;
  v_is_active boolean;
begin
  -- Fetch the existing refresh token
  select t.id, t.admin_id, t.family_id, t.is_revoked, t.expires_at, u.is_active
  into v_rec
  from public.admin_refresh_tokens t
  join public.admin_users u on u.id = t.admin_id
  where t.token_hash = p_old_token_hash;

  -- Not found
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  -- Reuse detection: if token is already revoked, compromise detected!
  if v_rec.is_revoked then
    -- Invalidate entire token family immediately
    update public.admin_refresh_tokens
    set is_revoked = true
    where family_id = v_rec.family_id;

    return jsonb_build_object('ok', false, 'error', 'reuse_detected', 'family_id', v_rec.family_id);
  end if;

  -- Check expiration
  if now() > v_rec.expires_at then
    return jsonb_build_object('ok', false, 'error', 'token_expired');
  end if;

  -- Check admin active status
  if not v_rec.is_active then
    return jsonb_build_object('ok', false, 'error', 'account_disabled');
  end if;

  -- Mark old token as revoked
  update public.admin_refresh_tokens
  set is_revoked = true
  where id = v_rec.id;

  -- Insert new token generation within the same family
  insert into public.admin_refresh_tokens (
    admin_id,
    token_hash,
    family_id,
    is_revoked,
    expires_at,
    user_agent,
    ip_address
  ) values (
    v_rec.admin_id,
    p_new_token_hash,
    v_rec.family_id,
    false,
    p_expires_at,
    p_user_agent,
    p_ip_address
  );

  return jsonb_build_object(
    'ok', true,
    'admin_id', v_rec.admin_id,
    'family_id', v_rec.family_id
  );
end;
$$;

revoke all on function public.rotate_admin_refresh_token from public, anon, authenticated;
grant execute on function public.rotate_admin_refresh_token to service_role;
-- ============================================================================
-- Migration 006: Allow service_role to execute administrative RPCs & fix is_admin
-- ============================================================================
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ 
  select (
    coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role(), '') = 'service_role'
    or exists(select 1 from public.admin_roles where user_id=auth.uid())
    or current_user in ('postgres', 'service_role', 'supabase_admin')
  ); 
$$;

grant execute on function public.is_admin to anon, authenticated, service_role;
grant execute on function public.save_product to authenticated, service_role;
grant execute on function public.admin_dashboard to authenticated, service_role;
grant execute on function public.admin_product_list to authenticated, service_role;
grant execute on function public.admin_set_enquiry_status to authenticated, service_role;

-- ============================================================================
-- Migration 007: Atomic Order Confirmation, Stock Control & Admin Notifications
-- ============================================================================

-- 1. Extend order_enquiries with confirmation & rejection audit metadata
alter table public.order_enquiries add column if not exists confirmed_at timestamptz;
alter table public.order_enquiries add column if not exists confirmed_by text;
alter table public.order_enquiries add column if not exists rejection_reason text;

-- Update status check constraint to include 'rejected'
alter table public.order_enquiries drop constraint if exists order_enquiries_status_check;
alter table public.order_enquiries add constraint order_enquiries_status_check 
  check (status in ('new', 'contacted', 'confirmed', 'rejected', 'cancelled', 'completed'));

-- 2. Extend admin_notifications for persistent order notifications
alter table public.admin_notifications alter column product_id drop not null;
alter table public.admin_notifications add column if not exists order_id uuid references public.order_enquiries(id) on delete cascade;
alter table public.admin_notifications add column if not exists order_reference text;

alter table public.admin_notifications drop constraint if exists admin_notifications_type_check;
alter table public.admin_notifications add constraint admin_notifications_type_check 
  check (type in ('out_of_stock', 'low_stock', 'restocked', 'new_order'));

create index if not exists notifications_order_idx on public.admin_notifications(order_id);

-- 3. Atomic Order Confirmation RPC with strict stock validation & row locking
create or replace function public.admin_confirm_order(
  p_order_id uuid,
  p_admin_id text default 'admin'
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  e public.order_enquiries;
  item record;
begin
  if not public.is_admin() then 
    raise exception 'Admin authorization required'; 
  end if;

  -- Lock the order row to serialize concurrent confirmation requests
  select * into e from public.order_enquiries where id = p_order_id for update;
  if not found then 
    raise exception 'Order enquiry not found'; 
  end if;

  -- Idempotency check: if already confirmed and stock deducted, return ok without double deduction
  if e.status = 'confirmed' or e.stock_deducted then
    return jsonb_build_object(
      'ok', true,
      'status', e.status,
      'stock_deducted', true,
      'already_confirmed', true,
      'order_reference', e.order_reference
    );
  end if;

  -- Rejection check: cannot confirm an order that was rejected or cancelled
  if e.status in ('rejected', 'cancelled') then
    raise exception 'Cannot confirm an order that has status %', e.status;
  end if;

  -- Lock product_variants in a deterministic sorted order (by ID) to prevent deadlocks
  perform 1 from public.product_variants 
  where id in (
    select variant_id from public.order_enquiry_items 
    where order_enquiry_id = e.id and variant_id is not null
  ) order by id for update;

  -- Verify current stock availability for EVERY item in the order before deducting any
  for item in 
    select 
      oi.variant_id, 
      oi.quantity, 
      oi.product_name_snapshot, 
      oi.size_snapshot, 
      pv.stock_quantity as current_stock
    from public.order_enquiry_items oi
    join public.product_variants pv on pv.id = oi.variant_id
    where oi.order_enquiry_id = e.id and oi.variant_id is not null
  loop
    if item.current_stock < item.quantity then
      raise exception 'Insufficient stock for % (Size %). Ordered: %, Available: %',
        item.product_name_snapshot, item.size_snapshot, item.quantity, item.current_stock;
    end if;
  end loop;

  -- All items verified! Atomically deduct the exact requested quantities
  for item in 
    select variant_id, quantity 
    from public.order_enquiry_items 
    where order_enquiry_id = e.id and variant_id is not null
  loop
    update public.product_variants
    set stock_quantity = stock_quantity - item.quantity
    where id = item.variant_id;
  end loop;

  -- Update order record
  update public.order_enquiries
  set 
    status = 'confirmed',
    stock_deducted = true,
    confirmed_at = now(),
    confirmed_by = coalesce(p_admin_id, 'admin')
  where id = e.id;

  return jsonb_build_object(
    'ok', true,
    'status', 'confirmed',
    'stock_deducted', true,
    'order_reference', e.order_reference
  );
end;
$$;

-- 4. Atomic Order Rejection RPC
create or replace function public.admin_reject_order(
  p_order_id uuid,
  p_reason text default '',
  p_admin_id text default 'admin'
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  e public.order_enquiries;
begin
  if not public.is_admin() then 
    raise exception 'Admin authorization required'; 
  end if;

  select * into e from public.order_enquiries where id = p_order_id for update;
  if not found then 
    raise exception 'Order enquiry not found'; 
  end if;

  if e.stock_deducted then
    raise exception 'Cannot reject an order with deducted stock. Please cancel instead.';
  end if;

  update public.order_enquiries
  set 
    status = 'rejected',
    rejection_reason = coalesce(p_reason, '')
  where id = e.id;

  return jsonb_build_object(
    'ok', true,
    'status', 'rejected',
    'stock_deducted', false,
    'order_reference', e.order_reference
  );
end;
$$;

-- 5. Updated admin_set_enquiry_status delegating to atomic handlers
create or replace function public.admin_set_enquiry_status(
  p_enquiry_id uuid, 
  p_status text
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  e public.order_enquiries;
  item record;
  restore boolean;
begin
  if not public.is_admin() then raise exception 'Admin authorization required'; end if;
  if p_status not in ('new', 'contacted', 'confirmed', 'rejected', 'cancelled', 'completed') then
    raise exception 'Invalid status %', p_status;
  end if;

  if p_status = 'confirmed' then
    return public.admin_confirm_order(p_enquiry_id, 'admin');
  elsif p_status = 'rejected' then
    return public.admin_reject_order(p_enquiry_id, '', 'admin');
  end if;

  select * into e from public.order_enquiries where id = p_enquiry_id for update;
  if not found then raise exception 'Order enquiry not found'; end if;

  restore := (p_status = 'cancelled' and e.stock_deducted);

  if restore then
    for item in select variant_id, quantity from public.order_enquiry_items where order_enquiry_id = e.id and variant_id is not null loop
      update public.product_variants
      set stock_quantity = stock_quantity + item.quantity
      where id = item.variant_id;
    end loop;
    update public.order_enquiries set status = p_status, stock_deducted = false where id = e.id;
  else
    update public.order_enquiries set status = p_status where id = e.id;
  end if;

  return jsonb_build_object('ok', true, 'status', p_status, 'stock_deducted', (case when restore then false else e.stock_deducted end));
end; 
$$;

-- 6. Updated create_enquiry function to create persistent admin notification
create or replace function public.create_enquiry(
  p_customer jsonb,
  p_items jsonb,
  p_key uuid,
  p_hash text,
  p_rate_key text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare 
  e public.order_enquiries; 
  item jsonb; 
  p public.products; 
  v public.product_variants; 
  total numeric(12,2)=0; 
  qty integer; 
  snapshots jsonb='[]'; 
  ref text; 
  wn text;
  first_item_name text := '';
begin
  -- Serialize retries, so the same request cannot create two enquiries.
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  select * into e from public.order_enquiries where idempotency_key=p_key;
  if found then
    if e.request_hash<>p_hash then raise exception 'Enquiry request changed. Please retry.'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('name',product_name_snapshot,'size',size_snapshot,'quantity',quantity,'price',unit_price_snapshot)),'[]') into snapshots from public.order_enquiry_items where order_enquiry_id=e.id;
    select whatsapp_number into wn from public.store_settings where id=1;
    return jsonb_build_object('reference',e.order_reference,'subtotal',e.subtotal,'items',snapshots,'whatsapp_number',wn);
  end if;

  if not public.consume_rate_limit(p_rate_key,5,600) then raise exception 'Too many enquiries. Please wait a few minutes.'; end if;
  select whatsapp_number into wn from public.store_settings where id=1;
  if wn is null or wn !~ '^[1-9][0-9]{7,14}$' then raise exception 'WhatsApp ordering is not configured. Please contact the boutique.'; end if;
  if jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Cart must contain between 1 and 30 items'; end if;
  if (select count(distinct x->>'variant_id') from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then raise exception 'Duplicate cart variants'; end if;

  -- Stable lock order avoids deadlocks. Prices and variants cannot change during validation/snapshot.
  perform 1 from public.products where id in(select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x) order by id for share;
  perform 1 from public.product_variants where id in(select (x->>'variant_id')::uuid from jsonb_array_elements(p_items) x) order by id for share;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into p from public.products where id=(item->>'product_id')::uuid and status='active';
    if not found or not exists(select 1 from public.categories where id=p.category_id and active) then 
      raise exception 'A product is no longer available. Please update your cart.'; 
    end if;
    select * into v from public.product_variants where id=(item->>'variant_id')::uuid and product_id=p.id and active;
    qty=(item->>'quantity')::integer;
    if not found or qty not between 1 and 99 then 
      raise exception 'A selected size is no longer available.'; 
    end if;
    if v.stock_quantity<qty then 
      raise exception 'Stock has changed for % (%). Only % available.', p.name, v.size, v.stock_quantity; 
    end if;
    if coalesce(v.price, p.selling_price) <> (item->>'expected_price')::numeric then 
      raise exception 'Price has changed for %. Please refresh your cart.', p.name; 
    end if;

    if first_item_name = '' then
      first_item_name := p.name;
    end if;

    total=total+coalesce(v.price, p.selling_price)*qty;
    snapshots=snapshots||jsonb_build_array(jsonb_build_object('product_id',p.id,'variant_id',v.id,'name',p.name,'size',v.size,'quantity',qty,'price',coalesce(v.price, p.selling_price)));
  end loop;

  ref := 'ACHU-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  -- Insert order enquiry record in pending ('new') status
  insert into public.order_enquiries(order_reference,idempotency_key,request_hash,customer_name,phone,alternate_phone,address,city,state,pincode,landmark,customer_note,subtotal,status)
  values(ref,p_key,p_hash,p_customer->>'full_name',p_customer->>'phone',coalesce(p_customer->>'alternate_phone',''),concat_ws(', ',p_customer->>'address_line_1',nullif(p_customer->>'address_line_2','')),p_customer->>'city',p_customer->>'state',p_customer->>'pincode',coalesce(p_customer->>'landmark',''),coalesce(p_customer->>'note',''),total,'new') 
  returning * into e;

  insert into public.order_enquiry_items(order_enquiry_id,product_id,variant_id,product_name_snapshot,size_snapshot,quantity,unit_price_snapshot,subtotal_snapshot)
  select e.id,(x->>'product_id')::uuid,(x->>'variant_id')::uuid,x->>'name',x->>'size',(x->>'quantity')::integer,(x->>'price')::numeric,(x->>'price')::numeric*(x->>'quantity')::integer 
  from jsonb_array_elements(snapshots) x;

  -- Create persistent Admin Notification for the newly placed pending order
  insert into public.admin_notifications(
    type,
    order_id,
    order_reference,
    title,
    message,
    product_name,
    size,
    stock_quantity
  ) values (
    'new_order',
    e.id,
    ref,
    'New Order: ' || ref,
    'Order received from ' || (p_customer->>'full_name') || ' (' || jsonb_array_length(snapshots) || ' item(s), total ₹' || total || ')',
    first_item_name,
    '',
    0
  );

  return jsonb_build_object('reference',ref,'subtotal',total,'items',snapshots,'whatsapp_number',wn);
end; 
$$;

-- 7. Permissions
grant execute on function public.admin_confirm_order to authenticated, service_role;
grant execute on function public.admin_reject_order to authenticated, service_role;
grant execute on function public.admin_set_enquiry_status to authenticated, service_role;
grant execute on function public.create_enquiry to service_role;
