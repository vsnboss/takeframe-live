-- Atomic Stripe entitlement mutations. These functions never touch an active
-- production lease, preserving TAKEFRAME SHOW LOCK across billing changes.

create or replace function public.apply_stripe_subscription_payment(
  p_customer_id uuid,
  p_provider_subscription_id text,
  p_provider_product_id text,
  p_provider_price_id text,
  p_plan text,
  p_paid_through timestamptz,
  p_provider_payload jsonb
)
returns table(subscription_id uuid, license_id uuid, license_key text, valid_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_license public.licenses%rowtype;
begin
  if p_plan not in ('monthly','annual') then
    raise exception 'invalid TAKEFRAME Stripe subscription plan';
  end if;
  if p_paid_through is null or p_paid_through <= now() then
    raise exception 'Stripe paid period must end in the future';
  end if;

  perform pg_advisory_xact_lock(hashtext('stripe-sub:' || p_provider_subscription_id));

  insert into public.subscriptions(
    customer_id, provider, provider_subscription_id, provider_plan_id,
    provider_variation_id, plan, status, start_date, paid_through, provider_payload
  ) values (
    p_customer_id, 'stripe', p_provider_subscription_id, p_provider_product_id,
    p_provider_price_id, p_plan, 'active', now(), p_paid_through, coalesce(p_provider_payload, '{}'::jsonb)
  )
  on conflict (provider_subscription_id) do update
  set customer_id = excluded.customer_id,
      provider = 'stripe',
      provider_plan_id = excluded.provider_plan_id,
      provider_variation_id = excluded.provider_variation_id,
      plan = excluded.plan,
      status = 'active',
      paid_through = greatest(public.subscriptions.paid_through, excluded.paid_through),
      provider_payload = excluded.provider_payload,
      updated_at = now()
  returning * into v_subscription;

  select * into v_license
  from public.licenses
  where subscription_id = v_subscription.id
  for update;

  if v_license.id is null then
    insert into public.licenses(
      customer_id, subscription_id, kind, plan, status,
      max_devices, max_concurrent_productions, clean_output, watermark_mode,
      valid_from, valid_until
    ) values (
      p_customer_id, v_subscription.id, 'subscription', p_plan, 'active',
      2, 1, true, 'none', now(), v_subscription.paid_through
    ) returning * into v_license;
  else
    update public.licenses
    set customer_id = p_customer_id,
        plan = p_plan,
        status = 'active',
        max_devices = 2,
        max_concurrent_productions = 1,
        clean_output = true,
        watermark_mode = 'none',
        valid_until = greatest(valid_until, v_subscription.paid_through),
        updated_at = now()
    where id = v_license.id
    returning * into v_license;
  end if;

  return query select v_subscription.id, v_license.id, v_license.license_key, v_license.valid_until;
end;
$$;

create or replace function public.mark_stripe_subscription_state(
  p_provider_subscription_id text,
  p_status text,
  p_provider_payload jsonb
)
returns table(subscription_id uuid, license_id uuid, license_status text, valid_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_license public.licenses%rowtype;
  v_local_status text;
begin
  if p_status not in ('pending','active','overdue','paused','cancelled','finished') then
    raise exception 'invalid TAKEFRAME subscription status';
  end if;

  perform pg_advisory_xact_lock(hashtext('stripe-sub:' || p_provider_subscription_id));

  update public.subscriptions
  set status = p_status,
      cancelled_at = case when p_status in ('cancelled','finished') then coalesce(cancelled_at, now()) else cancelled_at end,
      provider_payload = coalesce(p_provider_payload, provider_payload),
      updated_at = now()
  where provider = 'stripe' and provider_subscription_id = p_provider_subscription_id
  returning * into v_subscription;

  if v_subscription.id is null then
    return;
  end if;

  select * into v_license
  from public.licenses
  where subscription_id = v_subscription.id
  for update;

  if v_license.id is null then
    return query select v_subscription.id, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  -- Billing failure/cancellation only governs future authority. It never
  -- terminates production_leases. A licence remains active through its paid
  -- period and expires only after that period has actually elapsed.
  v_local_status := case
    when v_license.valid_until is not null and v_license.valid_until > now() then 'active'
    else 'expired'
  end;

  update public.licenses
  set status = v_local_status,
      updated_at = now()
  where id = v_license.id
  returning * into v_license;

  return query select v_subscription.id, v_license.id, v_license.status, v_license.valid_until;
end;
$$;

create or replace function public.grant_stripe_match_pass_credit(
  p_customer_id uuid,
  p_source_order_id uuid
)
returns table(match_pass_id uuid, pass_key text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pass public.match_passes%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('stripe-match-pass:' || p_source_order_id::text));

  insert into public.match_passes(customer_id, source_order_id)
  values (p_customer_id, p_source_order_id)
  on conflict (source_order_id) do nothing;

  select * into v_pass
  from public.match_passes
  where source_order_id = p_source_order_id;

  if v_pass.id is null then
    raise exception 'failed to grant TAKEFRAME Match Pass credit';
  end if;

  return query select v_pass.id, v_pass.pass_key, v_pass.status;
end;
$$;

revoke all on function public.apply_stripe_subscription_payment(uuid,text,text,text,text,timestamptz,jsonb)
  from public, anon, authenticated;
revoke all on function public.mark_stripe_subscription_state(text,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.grant_stripe_match_pass_credit(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_payment(uuid,text,text,text,text,timestamptz,jsonb)
  to service_role;
grant execute on function public.mark_stripe_subscription_state(text,text,jsonb)
  to service_role;
grant execute on function public.grant_stripe_match_pass_credit(uuid,uuid)
  to service_role;
