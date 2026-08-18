create table public.payment_provider_webhooks (
  provider text primary key check (provider = 'revolut'),
  provider_webhook_id text not null unique,
  url text not null,
  events jsonb not null,
  vault_secret_name text not null unique,
  environment text not null check (environment in ('production','sandbox')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payment_provider_webhooks_updated_at
before update on public.payment_provider_webhooks
for each row execute function public.set_updated_at();

alter table public.payment_provider_webhooks enable row level security;
revoke all on public.payment_provider_webhooks from anon, authenticated;

create or replace function public.store_revolut_webhook(
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
  v_secret_name text := 'takeframe_revolut_webhook_signing_secret_' || p_environment;
  v_existing_secret_id uuid;
begin
  if p_environment not in ('production','sandbox') then
    raise exception 'invalid Revolut environment';
  end if;
  if coalesce(length(p_signing_secret), 0) < 16 then
    raise exception 'invalid Revolut webhook signing secret';
  end if;

  select id into v_existing_secret_id
  from vault.secrets
  where name = v_secret_name
  limit 1;

  if v_existing_secret_id is null then
    perform vault.create_secret(
      p_signing_secret,
      v_secret_name,
      'TAKEFRAME Revolut Merchant webhook signing secret (' || p_environment || ')'
    );
  else
    perform vault.update_secret(
      v_existing_secret_id,
      p_signing_secret,
      v_secret_name,
      'TAKEFRAME Revolut Merchant webhook signing secret (' || p_environment || ')'
    );
  end if;

  insert into public.payment_provider_webhooks(
    provider, provider_webhook_id, url, events, vault_secret_name, environment, active
  ) values (
    'revolut', p_webhook_id, p_url, p_events, v_secret_name, p_environment, true
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

create or replace function public.get_revolut_webhook_config()
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
  where w.provider = 'revolut' and w.active
  limit 1;
$$;

revoke all on function public.store_revolut_webhook(text,text,jsonb,text,text) from public, anon, authenticated;
revoke all on function public.get_revolut_webhook_config() from public, anon, authenticated;
grant execute on function public.store_revolut_webhook(text,text,jsonb,text,text) to service_role;
grant execute on function public.get_revolut_webhook_config() to service_role;
