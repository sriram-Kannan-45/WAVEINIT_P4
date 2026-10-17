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
