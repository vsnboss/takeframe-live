create or replace function public.release_promotion_reservation(p_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.promotion_redemptions
  set status = 'released', released_at = coalesce(released_at, now())
  where id = p_redemption_id
    and status = 'reserved';
end;
$$;

revoke all on function public.release_promotion_reservation(uuid) from public, anon, authenticated;
grant execute on function public.release_promotion_reservation(uuid) to service_role;
