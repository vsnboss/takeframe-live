create or replace function public.generate_takeframe_match_pass_key()
returns text
language sql
volatile
as $$
  select 'TFM-' || upper(substr(h,1,4)) || '-' || upper(substr(h,5,4)) || '-' || upper(substr(h,9,4))
  from (select encode(gen_random_bytes(6), 'hex') as h) s;
$$;

alter table public.match_passes
  add column pass_key text not null default public.generate_takeframe_match_pass_key();

create unique index match_passes_pass_key_idx on public.match_passes(pass_key);

alter table public.devices
  alter column license_id drop not null,
  add column match_pass_id uuid references public.match_passes(id) on delete cascade;

alter table public.devices
  add constraint devices_exactly_one_authority check (num_nonnulls(license_id, match_pass_id) = 1);

create unique index devices_active_match_pass_identity_idx
  on public.devices(match_pass_id, device_id)
  where deactivated_at is null and match_pass_id is not null;

create unique index licenses_one_evaluation_per_customer_idx
  on public.licenses(customer_id)
  where kind = 'evaluation';

create or replace function public.acquire_production_lease(
  p_license_id uuid,
  p_match_pass_id uuid,
  p_device_id uuid,
  p_match_id text,
  p_lease_token_hash text,
  p_ttl_seconds integer,
  p_max_concurrent integer
)
returns table(lease_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_authority text;
  v_count integer;
  v_id uuid;
  v_expires timestamptz;
begin
  if num_nonnulls(p_license_id, p_match_pass_id) <> 1 then
    raise exception 'exactly one production authority is required';
  end if;
  if p_device_id is null then
    raise exception 'device is required';
  end if;
  if p_ttl_seconds < 15 or p_ttl_seconds > 300 then
    raise exception 'invalid production lease ttl';
  end if;
  if p_max_concurrent < 1 then
    raise exception 'invalid production concurrency limit';
  end if;

  v_authority := coalesce('license:' || p_license_id::text, 'match-pass:' || p_match_pass_id::text);
  perform pg_advisory_xact_lock(hashtext(v_authority));

  update public.production_leases
  set status = 'expired', updated_at = now()
  where status = 'active'
    and expires_at <= now()
    and (
      (p_license_id is not null and license_id = p_license_id)
      or (p_match_pass_id is not null and match_pass_id = p_match_pass_id)
    );

  select count(*) into v_count
  from public.production_leases
  where status = 'active'
    and expires_at > now()
    and (
      (p_license_id is not null and license_id = p_license_id)
      or (p_match_pass_id is not null and match_pass_id = p_match_pass_id)
    );

  if v_count >= p_max_concurrent then
    raise exception 'production concurrency limit reached';
  end if;

  v_expires := now() + make_interval(secs => p_ttl_seconds);

  insert into public.production_leases(
    license_id,
    match_pass_id,
    device_id,
    match_id,
    lease_token_hash,
    status,
    acquired_at,
    last_heartbeat_at,
    expires_at
  ) values (
    p_license_id,
    p_match_pass_id,
    p_device_id,
    p_match_id,
    p_lease_token_hash,
    'active',
    now(),
    now(),
    v_expires
  ) returning id into v_id;

  return query select v_id, v_expires;
end;
$$;

create or replace function public.heartbeat_production_lease(
  p_lease_token_hash text,
  p_ttl_seconds integer
)
returns table(lease_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_expires timestamptz;
begin
  if p_ttl_seconds < 15 or p_ttl_seconds > 300 then
    raise exception 'invalid production lease ttl';
  end if;

  update public.production_leases
  set status = 'expired', updated_at = now()
  where lease_token_hash = p_lease_token_hash
    and status = 'active'
    and expires_at <= now();

  v_expires := now() + make_interval(secs => p_ttl_seconds);

  update public.production_leases
  set last_heartbeat_at = now(),
      expires_at = v_expires,
      updated_at = now()
  where lease_token_hash = p_lease_token_hash
    and status = 'active'
    and expires_at > now()
  returning id into v_id;

  if v_id is null then
    raise exception 'production lease not active';
  end if;

  return query select v_id, v_expires;
end;
$$;

create or replace function public.release_production_lease(
  p_lease_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.production_leases
  set status = 'released',
      released_at = now(),
      updated_at = now()
  where lease_token_hash = p_lease_token_hash
    and status = 'active'
  returning id into v_id;

  return v_id is not null;
end;
$$;

revoke all on function public.acquire_production_lease(uuid,uuid,uuid,text,text,integer,integer) from public;
revoke all on function public.heartbeat_production_lease(text,integer) from public;
revoke all on function public.release_production_lease(text) from public;

grant execute on function public.acquire_production_lease(uuid,uuid,uuid,text,text,integer,integer) to service_role;
grant execute on function public.heartbeat_production_lease(text,integer) to service_role;
grant execute on function public.release_production_lease(text) to service_role;
