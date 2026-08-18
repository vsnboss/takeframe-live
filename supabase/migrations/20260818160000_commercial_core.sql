create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_takeframe_license_key()
returns text
language sql
volatile
as $$
  select 'TF-' || upper(substr(h,1,4)) || '-' || upper(substr(h,5,4)) || '-' || upper(substr(h,9,4))
  from (select encode(gen_random_bytes(6), 'hex') as h) s;
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  revolut_customer_id text unique,
  status text not null default 'active' check (status in ('active','blocked','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_email_lowercase check (email = lower(email))
);
create unique index customers_email_lower_idx on public.customers (lower(email));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  provider text not null default 'revolut' check (provider in ('revolut')),
  provider_order_id text not null unique,
  external_reference text unique,
  plan text check (plan in ('monthly','annual','match-pass','evaluation')),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency text check (currency is null or char_length(currency) = 3),
  status text not null default 'pending',
  paid_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_id_idx on public.orders(customer_id);
create index orders_status_idx on public.orders(status);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  provider text not null default 'revolut' check (provider in ('revolut')),
  provider_subscription_id text not null unique,
  provider_plan_id text,
  provider_variation_id text,
  setup_order_id text,
  external_reference text unique,
  plan text not null check (plan in ('monthly','annual')),
  status text not null default 'pending' check (status in ('pending','active','overdue','paused','cancelled','finished')),
  start_date timestamptz,
  paid_through timestamptz,
  cancelled_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_customer_id_idx on public.subscriptions(customer_id);
create index subscriptions_status_idx on public.subscriptions(status);

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  license_key text not null unique default public.generate_takeframe_license_key(),
  kind text not null check (kind in ('subscription','evaluation')),
  plan text not null check (plan in ('monthly','annual','evaluation')),
  status text not null default 'active' check (status in ('active','grace','expired','suspended','revoked')),
  max_devices integer not null default 2 check (max_devices > 0),
  max_concurrent_productions integer not null default 1 check (max_concurrent_productions > 0),
  clean_output boolean not null default true,
  watermark_mode text not null default 'none' check (watermark_mode in ('none','evaluation')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_license_has_subscription check (
    (kind = 'subscription' and subscription_id is not null) or kind <> 'subscription'
  )
);
create unique index licenses_one_per_subscription_idx on public.licenses(subscription_id) where subscription_id is not null;
create index licenses_customer_id_idx on public.licenses(customer_id);
create index licenses_status_idx on public.licenses(status);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  device_id text not null,
  device_name text,
  platform text not null default 'windows',
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index devices_active_identity_idx on public.devices(license_id, device_id) where deactivated_at is null;
create index devices_license_id_idx on public.devices(license_id);

create table public.match_passes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  source_order_id uuid not null references public.orders(id) on delete restrict,
  status text not null default 'unused' check (status in ('unused','activated','expired','consumed')),
  match_id text,
  activated_at timestamptz,
  expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_pass_activation_shape check (
    (status = 'unused' and activated_at is null and expires_at is null and match_id is null)
    or
    (status <> 'unused' and activated_at is not null and expires_at is not null and match_id is not null)
  )
);
create unique index match_passes_one_credit_per_order_idx on public.match_passes(source_order_id);
create index match_passes_customer_status_idx on public.match_passes(customer_id, status);

create table public.production_leases (
  id uuid primary key default gen_random_uuid(),
  license_id uuid references public.licenses(id) on delete cascade,
  match_pass_id uuid references public.match_passes(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  match_id text,
  lease_token_hash text not null unique,
  status text not null default 'active' check (status in ('active','released','expired')),
  acquired_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_lease_authority check (license_id is not null or match_pass_id is not null)
);
create index production_leases_active_license_idx on public.production_leases(license_id, status) where status = 'active';
create index production_leases_active_match_pass_idx on public.production_leases(match_pass_id, status) where status = 'active';

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  license_id uuid references public.licenses(id) on delete cascade,
  match_pass_id uuid references public.match_passes(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  key_id text not null,
  payload jsonb not null,
  signature text not null,
  issued_at timestamptz not null default now(),
  valid_until timestamptz,
  offline_until timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint entitlement_authority check (license_id is not null or match_pass_id is not null)
);
create index entitlements_license_id_idx on public.entitlements(license_id, issued_at desc);
create index entitlements_match_pass_id_idx on public.entitlements(match_pass_id, issued_at desc);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'revolut' check (provider in ('revolut')),
  event_key text not null unique,
  event_type text not null,
  provider_object_id text,
  external_reference text,
  payload jsonb not null,
  processing_status text not null default 'processing' check (processing_status in ('processing','processed','failed','ignored')),
  attempts integer not null default 1 check (attempts > 0),
  locked_at timestamptz not null default now(),
  first_received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);
create index webhook_events_status_idx on public.webhook_events(processing_status, last_received_at);
create index webhook_events_object_idx on public.webhook_events(provider_object_id, event_type);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null default 'system',
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_entity_idx on public.audit_events(entity_type, entity_id, created_at desc);

create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger licenses_updated_at before update on public.licenses for each row execute function public.set_updated_at();
create trigger devices_updated_at before update on public.devices for each row execute function public.set_updated_at();
create trigger match_passes_updated_at before update on public.match_passes for each row execute function public.set_updated_at();
create trigger production_leases_updated_at before update on public.production_leases for each row execute function public.set_updated_at();

create or replace function public.claim_webhook_event(
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
  insert into public.webhook_events(
    event_key, event_type, provider_object_id, external_reference, payload,
    processing_status, attempts, locked_at, first_received_at, last_received_at
  ) values (
    p_event_key, p_event_type, p_provider_object_id, p_external_reference, p_payload,
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

create or replace function public.finish_webhook_event(
  p_event_id uuid,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('processed','failed','ignored') then
    raise exception 'invalid webhook status';
  end if;

  update public.webhook_events
  set processing_status = p_status,
      processed_at = case when p_status in ('processed','ignored') then now() else null end,
      error = p_error,
      last_received_at = now()
  where id = p_event_id;
end;
$$;

alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.subscriptions enable row level security;
alter table public.licenses enable row level security;
alter table public.devices enable row level security;
alter table public.match_passes enable row level security;
alter table public.production_leases enable row level security;
alter table public.entitlements enable row level security;
alter table public.webhook_events enable row level security;
alter table public.audit_events enable row level security;

revoke all on function public.claim_webhook_event(text,text,text,text,jsonb) from public;
revoke all on function public.finish_webhook_event(uuid,text,text) from public;
grant execute on function public.claim_webhook_event(text,text,text,text,jsonb) to service_role;
grant execute on function public.finish_webhook_event(uuid,text,text) to service_role;
