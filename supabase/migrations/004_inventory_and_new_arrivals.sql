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
