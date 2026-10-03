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
