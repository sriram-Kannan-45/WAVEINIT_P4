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
