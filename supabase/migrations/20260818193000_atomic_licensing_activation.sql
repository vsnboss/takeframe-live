create or replace function public.ensure_authority_device(
  p_license_id uuid,
  p_match_pass_id uuid,
  p_device_identity text,
  p_device_name text,
  p_max_devices integer
)
returns public.devices
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_authority text;
  v_existing public.devices%rowtype;
  v_count integer;
  v_device public.devices%rowtype;
begin
  if num_nonnulls(p_license_id, p_match_pass_id) <> 1 then
    raise exception 'exactly one device authority is required';
  end if;
  if p_max_devices < 1 then
    raise exception 'invalid device limit';
  end if;
  if coalesce(length(trim(p_device_identity)), 0) < 8 or length(trim(p_device_identity)) > 256 then
    raise exception 'invalid device identity';
  end if;

  v_authority := coalesce('license:' || p_license_id::text, 'match-pass:' || p_match_pass_id::text);
  perform pg_advisory_xact_lock(hashtext(v_authority));

  select * into v_existing
  from public.devices
  where device_id = trim(p_device_identity)
    and (
      (p_license_id is not null and license_id = p_license_id)
      or (p_match_pass_id is not null and match_pass_id = p_match_pass_id)
    )
  order by registered_at desc
  limit 1;

  if v_existing.id is not null and v_existing.deactivated_at is null then
    update public.devices
    set device_name = coalesce(nullif(trim(p_device_name), ''), device_name),
        last_seen_at = now()
    where id = v_existing.id
    returning * into v_device;
    return v_device;
  end if;

  select count(*) into v_count
  from public.devices
  where deactivated_at is null
    and (
      (p_license_id is not null and license_id = p_license_id)
      or (p_match_pass_id is not null and match_pass_id = p_match_pass_id)
    );

  if v_count >= p_max_devices then
    raise exception 'device limit reached';
  end if;

  if v_existing.id is not null then
    update public.devices
    set device_name = coalesce(nullif(trim(p_device_name), ''), device_name),
        deactivated_at = null,
        last_seen_at = now()
    where id = v_existing.id
    returning * into v_device;
    return v_device;
  end if;

  insert into public.devices(
    license_id,
    match_pass_id,
    device_id,
    device_name,
    platform,
    last_seen_at
  ) values (
    p_license_id,
    p_match_pass_id,
    trim(p_device_identity),
    nullif(trim(p_device_name), ''),
    'windows',
    now()
  ) returning * into v_device;

  return v_device;
end;
$$;

create or replace function public.activate_match_pass_atomic(
  p_pass_id uuid,
  p_match_id text
)
returns public.match_passes
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_pass public.match_passes%rowtype;
  v_match_id text := trim(p_match_id);
begin
  if coalesce(length(v_match_id), 0) < 4 or length(v_match_id) > 256 then
    raise exception 'invalid match id';
  end if;

  select * into v_pass
  from public.match_passes
  where id = p_pass_id
  for update;

  if v_pass.id is null then
    raise exception 'match pass not found';
  end if;

  if v_pass.status = 'unused' then
    update public.match_passes
    set status = 'activated',
        match_id = v_match_id,
        activated_at = now(),
        expires_at = now() + interval '72 hours',
        updated_at = now()
    where id = v_pass.id
    returning * into v_pass;
  elsif v_pass.status = 'activated' then
    if v_pass.match_id <> v_match_id then
      raise exception 'match pass locked';
    end if;
  else
    raise exception 'match pass inactive';
  end if;

  if v_pass.expires_at is null or v_pass.expires_at <= now() then
    update public.match_passes
    set status = 'expired', updated_at = now()
    where id = v_pass.id;
    raise exception 'match pass expired';
  end if;

  return v_pass;
end;
$$;

revoke all on function public.ensure_authority_device(uuid,uuid,text,text,integer) from public, anon, authenticated;
revoke all on function public.activate_match_pass_atomic(uuid,text) from public, anon, authenticated;
grant execute on function public.ensure_authority_device(uuid,uuid,text,text,integer) to service_role;
grant execute on function public.activate_match_pass_atomic(uuid,text) to service_role;
