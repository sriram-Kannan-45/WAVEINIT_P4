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
