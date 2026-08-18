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
    where id = v_pass.id
    returning * into v_pass;
    return v_pass;
  end if;

  return v_pass;
end;
$$;

revoke all on function public.activate_match_pass_atomic(uuid,text) from public, anon, authenticated;
grant execute on function public.activate_match_pass_atomic(uuid,text) to service_role;
