create or replace function public.get_commerce_admin_snapshot()
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'counts', jsonb_build_object(
      'customers', (select count(*) from public.customers),
      'orders', (select count(*) from public.orders),
      'subscriptions', (select count(*) from public.subscriptions),
      'licenses', (select count(*) from public.licenses),
      'match_passes', (select count(*) from public.match_passes),
      'promotions', (select count(*) from public.promotions),
      'revenue_cents', (select coalesce(sum(amount_cents), 0) from public.orders where status = 'completed')
    ),
    'customers', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select c.id, c.email, c.status, c.created_at,
          (select count(*) from public.orders o where o.customer_id = c.id and o.status = 'completed') as completed_orders,
          (select count(*) from public.match_passes mp where mp.customer_id = c.id and mp.status = 'unused') as unused_match_passes
        from public.customers c
        order by c.created_at desc
        limit 100
      ) x
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select o.id, o.provider_order_id, o.external_reference, o.plan, o.status,
          o.amount_cents, o.list_amount_cents, o.discount_cents, o.promotion_code,
          o.currency, o.paid_at, o.created_at, c.email
        from public.orders o
        left join public.customers c on c.id = o.customer_id
        order by o.created_at desc
        limit 100
      ) x
    ), '[]'::jsonb),
    'subscriptions', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select s.id, s.provider_subscription_id, s.plan, s.status, s.start_date,
          s.paid_through, s.cancelled_at, s.created_at, c.email
        from public.subscriptions s
        join public.customers c on c.id = s.customer_id
        order by s.created_at desc
        limit 100
      ) x
    ), '[]'::jsonb),
    'licenses', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select l.id, l.license_key, l.kind, l.plan, l.status, l.max_devices,
          l.max_concurrent_productions, l.clean_output, l.valid_from, l.valid_until,
          l.grace_until, l.created_at, c.email
        from public.licenses l
        join public.customers c on c.id = l.customer_id
        order by l.created_at desc
        limit 100
      ) x
    ), '[]'::jsonb),
    'match_passes', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select mp.id, mp.pass_key, mp.status, mp.match_id, mp.activated_at,
          mp.expires_at, mp.consumed_at, mp.created_at, c.email
        from public.match_passes mp
        join public.customers c on c.id = mp.customer_id
        order by mp.created_at desc
        limit 100
      ) x
    ), '[]'::jsonb),
    'promotions', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select p.id, p.code, p.description, p.plan, p.final_price_cents,
          p.allowed_email, p.max_redemptions, p.max_redemptions_per_email,
          p.starts_at, p.expires_at, p.active, p.created_by_email, p.created_at,
          (select count(*) from public.promotion_redemptions r where r.promotion_id = p.id and r.status = 'completed') as completed_redemptions,
          (select count(*) from public.promotion_redemptions r where r.promotion_id = p.id and r.status = 'reserved' and r.reservation_expires_at > now()) as reserved_redemptions
        from public.promotions p
        order by p.created_at desc
        limit 100
      ) x
    ), '[]'::jsonb),
    'redemptions', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select r.id, p.code, r.email, r.plan, r.original_amount_cents,
          r.final_amount_cents, r.discount_cents, r.status, r.provider_order_id,
          r.reserved_at, r.completed_at, r.released_at, r.created_at
        from public.promotion_redemptions r
        join public.promotions p on p.id = r.promotion_id
        order by r.created_at desc
        limit 100
      ) x
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_commerce_admin_snapshot() from public, anon, authenticated;
grant execute on function public.get_commerce_admin_snapshot() to service_role;
