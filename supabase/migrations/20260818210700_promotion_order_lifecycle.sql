create or replace function public.sync_order_promotion_redemption()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.provider_order_id is null then
    return new;
  end if;

  if new.status = 'completed' then
    update public.promotion_redemptions
    set status = 'completed',
        completed_at = coalesce(completed_at, now())
    where provider_order_id = new.provider_order_id
      and status in ('reserved','completed');
  elsif new.status in ('cancelled','failed') then
    update public.promotion_redemptions
    set status = 'released',
        released_at = coalesce(released_at, now())
    where provider_order_id = new.provider_order_id
      and status = 'reserved';
  end if;

  return new;
end;
$$;

create trigger orders_sync_promotion_redemption
after insert or update of status on public.orders
for each row execute function public.sync_order_promotion_redemption();

revoke all on function public.sync_order_promotion_redemption() from public, anon, authenticated;
