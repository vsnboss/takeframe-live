create table public.licensing_signing_keys (
  key_id text primary key,
  public_key_pem text not null,
  vault_secret_name text not null unique,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create unique index licensing_signing_keys_one_active_idx
  on public.licensing_signing_keys((active))
  where active;

create table public.licensing_runtime_config (
  singleton boolean primary key default true check (singleton),
  offline_hours integer not null default 24 check (offline_hours between 1 and 168),
  lease_ttl_seconds integer not null default 90 check (lease_ttl_seconds between 15 and 300),
  updated_at timestamptz not null default now()
);

insert into public.licensing_runtime_config(singleton) values (true)
on conflict (singleton) do nothing;

create trigger licensing_runtime_config_updated_at
before update on public.licensing_runtime_config
for each row execute function public.set_updated_at();

alter table public.licensing_signing_keys enable row level security;
alter table public.licensing_runtime_config enable row level security;

create or replace function public.get_active_entitlement_signer()
returns table(
  key_id text,
  public_key_pem text,
  private_key_pem text,
  offline_hours integer,
  lease_ttl_seconds integer
)
language sql
stable
security definer
set search_path = public, vault, pg_catalog
as $$
  select
    k.key_id,
    k.public_key_pem,
    s.decrypted_secret,
    c.offline_hours,
    c.lease_ttl_seconds
  from public.licensing_signing_keys k
  join vault.decrypted_secrets s on s.name = k.vault_secret_name
  cross join public.licensing_runtime_config c
  where k.active
  order by k.created_at desc
  limit 1;
$$;

revoke all on function public.get_active_entitlement_signer() from public, anon, authenticated;
grant execute on function public.get_active_entitlement_signer() to service_role;

revoke all on public.licensing_signing_keys from anon, authenticated;
revoke all on public.licensing_runtime_config from anon, authenticated;
