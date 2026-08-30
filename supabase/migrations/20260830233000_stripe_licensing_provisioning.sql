-- Stripe -> TAKEFRAME commercial/licensing provisioning.
-- Revolut remains supported during the provider transition.

alter table public.customers
  add column if not exists stripe_customer_id text;
create unique index if not exists customers_stripe_customer_id_uidx
  on public.customers(stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.orders drop constraint if exists orders_provider_check;
alter table public.orders
  add constraint orders_provider_check check (provider in ('revolut','stripe'));

alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions
  add constraint subscriptions_provider_check check (provider in ('revolut','stripe'));

alter table public.webhook_events drop constraint if exists webhook_events_provider_check;
alter table public.webhook_events
  add constraint webhook_events_provider_check check (provider in ('revolut','stripe'));

alter table public.payment_provider_webhooks drop constraint if exists payment_provider_webhooks_provider_check;
alter table public.payment_provider_webhooks
  add constraint payment_provider_webhooks_provider_check check (provider in ('revolut','stripe'));

create table if not exists public.stripe_plan_mappings (
  price_id text primary key,
  product_id text not null,
  product text not null default 'takeframe' check (product = 'takeframe'),
  plan text not null check (plan in ('match-pass','monthly','annual')),
  licensing_action text not null check (
    licensing_action in ('add_match_pass_credit','create_or_extend_monthly','create_or_extend_annual')
  ),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency = lower(currency) and char_length(currency) = 3),
  recurring_interval text check (recurring_interval in ('month','year') or recurring_interval is null),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_plan_mapping_shape check (
    (plan = 'match-pass' and recurring_interval is null and licensing_action = 'add_match_pass_credit')
    or
    (plan = 'monthly' and recurring_interval = 'month' and licensing_action = 'create_or_extend_monthly')
    or
    (plan = 'annual' and recurring_interval = 'year' and licensing_action = 'create_or_extend_annual')
  )
);
create index if not exists stripe_plan_mappings_product_idx
  on public.stripe_plan_mappings(product_id)
  where active;

create trigger stripe_plan_mappings_updated_at
before update on public.stripe_plan_mappings
for each row execute function public.set_updated_at();

alter table public.stripe_plan_mappings enable row level security;
revoke all on public.stripe_plan_mappings from anon, authenticated;

insert into public.stripe_plan_mappings(
  price_id, product_id, plan, licensing_action, amount_cents, currency, recurring_interval, active
) values
  ('price_1UAGDcDJfbVk1pHIcMnCHLNX', 'prod_VAbQlttjDJznT4', 'match-pass', 'add_match_pass_credit', 7900, 'eur', null, true),
  ('price_1UAGDjDJfbVk1pHIYug7FvzQ', 'prod_VAbQU5BFbTQw7z', 'monthly', 'create_or_extend_monthly', 16900, 'eur', 'month', true),
  ('price_1UAGDoDJfbVk1pHIsIAovnrO', 'prod_VAbQsRnbLFDWVw', 'annual', 'create_or_extend_annual', 169000, 'eur', 'year', true)
on conflict (price_id) do update
set product_id = excluded.product_id,
    plan = excluded.plan,
    licensing_action = excluded.licensing_action,
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    recurring_interval = excluded.recurring_interval,
    active = true,
    updated_at = now();

create or replace function public.claim_payment_webhook_event(
  p_provider text,
  p_event_key text,
  p_event_type text,
  p_provider_object_id text,
  p_external_reference text,
  p_payload jsonb
)
returns table(event_id uuid, should_process boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_provider not in ('revolut','stripe') then
    raise exception 'unsupported payment provider';
  end if;

  insert into public.webhook_events(
    provider, event_key, event_type, provider_object_id, external_reference, payload,
    processing_status, attempts, locked_at, first_received_at, last_received_at
  ) values (
    p_provider, p_event_key, p_event_type, p_provider_object_id, p_external_reference, p_payload,
    'processing', 1, now(), now(), now()
  )
  on conflict (event_key) do update
  set attempts = public.webhook_events.attempts + 1,
      last_received_at = now(),
      locked_at = now(),
      processing_status = 'processing',
      error = null,
      payload = excluded.payload
  where public.webhook_events.processing_status = 'failed'
     or (public.webhook_events.processing_status = 'processing'
         and public.webhook_events.locked_at < now() - interval '15 minutes')
  returning id into v_id;

  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  select id into v_id from public.webhook_events where event_key = p_event_key;
  return query select v_id, false;
end;
$$;

revoke all on function public.claim_payment_webhook_event(text,text,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_payment_webhook_event(text,text,text,text,text,jsonb)
  to service_role;

create or replace function public.store_stripe_webhook(
  p_webhook_id text,
  p_url text,
  p_events jsonb,
  p_signing_secret text,
  p_environment text
)
returns void
language plpgsql
security definer
set search_path = public, vault, pg_catalog
as $$
declare
  v_secret_name text := 'takeframe_stripe_webhook_signing_secret_' || p_environment;
  v_existing_secret_id uuid;
begin
  if p_environment not in ('production','sandbox') then
    raise exception 'invalid Stripe environment';
  end if;
  if coalesce(length(p_signing_secret), 0) < 16 then
    raise exception 'invalid Stripe webhook signing secret';
  end if;

  select id into v_existing_secret_id
  from vault.secrets
  where name = v_secret_name
  limit 1;

  if v_existing_secret_id is null then
    perform vault.create_secret(
      p_signing_secret,
      v_secret_name,
      'TAKEFRAME Stripe webhook signing secret (' || p_environment || ')'
    );
  else
    perform vault.update_secret(
      v_existing_secret_id,
      p_signing_secret,
      v_secret_name,
      'TAKEFRAME Stripe webhook signing secret (' || p_environment || ')'
    );
  end if;

  insert into public.payment_provider_webhooks(
    provider, provider_webhook_id, url, events, vault_secret_name, environment, active
  ) values (
    'stripe', p_webhook_id, p_url, p_events, v_secret_name, p_environment, true
  )
  on conflict (provider) do update
  set provider_webhook_id = excluded.provider_webhook_id,
      url = excluded.url,
      events = excluded.events,
      vault_secret_name = excluded.vault_secret_name,
      environment = excluded.environment,
      active = true,
      updated_at = now();
end;
$$;

create or replace function public.get_stripe_webhook_config()
returns table(
  provider_webhook_id text,
  url text,
  events jsonb,
  environment text,
  signing_secret text
)
language sql
stable
security definer
set search_path = public, vault, pg_catalog
as $$
  select
    w.provider_webhook_id,
    w.url,
    w.events,
    w.environment,
    s.decrypted_secret
  from public.payment_provider_webhooks w
  join vault.decrypted_secrets s on s.name = w.vault_secret_name
  where w.provider = 'stripe' and w.active
  limit 1;
$$;

revoke all on function public.store_stripe_webhook(text,text,jsonb,text,text)
  from public, anon, authenticated;
revoke all on function public.get_stripe_webhook_config()
  from public, anon, authenticated;
grant execute on function public.store_stripe_webhook(text,text,jsonb,text,text)
  to service_role;
grant execute on function public.get_stripe_webhook_config()
  to service_role;
