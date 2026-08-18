create table public.commerce_admins (
  email text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_admins_email_normalized check (email = lower(trim(email))),
  constraint commerce_admins_email_format check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create trigger commerce_admins_updated_at
before update on public.commerce_admins
for each row execute function public.set_updated_at();

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  plan text not null check (plan = 'match-pass'),
  final_price_cents integer not null check (final_price_cents >= 100),
  allowed_email text,
  max_redemptions integer not null default 1 check (max_redemptions > 0),
  max_redemptions_per_email integer not null default 1 check (max_redemptions_per_email > 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default true,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  constraint promotions_allowed_email_normalized check (allowed_email is null or allowed_email = lower(trim(allowed_email))),
  constraint promotions_valid_window check (expires_at is null or expires_at > starts_at)
);

create trigger promotions_updated_at
before update on public.promotions
for each row execute function public.set_updated_at();

create table public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete restrict,
  reservation_key uuid not null unique,
  email text not null,
  customer_id uuid references public.customers(id) on delete restrict,
  order_id uuid unique references public.orders(id) on delete restrict,
  provider_order_id text unique,
  plan text not null check (plan = 'match-pass'),
  original_amount_cents integer not null check (original_amount_cents > 0),
  final_amount_cents integer not null check (final_amount_cents >= 100),
  discount_cents integer not null check (discount_cents >= 0),
  status text not null check (status in ('reserved','completed','released')),
  reserved_at timestamptz not null default now(),
  reservation_expires_at timestamptz not null,
  completed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  constraint promotion_redemptions_email_normalized check (email = lower(trim(email))),
  constraint promotion_redemptions_amount_math check (original_amount_cents - discount_cents = final_amount_cents)
);

create index promotion_redemptions_promotion_status_idx
  on public.promotion_redemptions(promotion_id, status);
create index promotion_redemptions_email_status_idx
  on public.promotion_redemptions(email, status);

alter table public.orders
  add column list_amount_cents integer,
  add column discount_cents integer,
  add column promotion_code text;

alter table public.orders
  add constraint orders_discount_nonnegative check (discount_cents is null or discount_cents >= 0),
  add constraint orders_list_amount_positive check (list_amount_cents is null or list_amount_cents > 0),
  add constraint orders_promotion_amount_math check (
    list_amount_cents is null
    or discount_cents is null
    or amount_cents is null
    or list_amount_cents - discount_cents = amount_cents
  );

alter table public.commerce_admins enable row level security;
alter table public.promotions enable row level security;
alter table public.promotion_redemptions enable row level security;
revoke all on public.commerce_admins from anon, authenticated;
revoke all on public.promotions from anon, authenticated;
revoke all on public.promotion_redemptions from anon, authenticated;

create or replace function public.reserve_promotion(
  p_code text,
  p_email text,
  p_plan text,
  p_original_amount_cents integer,
  p_reservation_key uuid
)
returns table(
  redemption_id uuid,
  promotion_id uuid,
  promotion_code text,
  final_amount_cents integer,
  discount_cents integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_code text := upper(trim(p_code));
  v_email text := lower(trim(p_email));
  v_promo public.promotions%rowtype;
  v_total integer;
  v_email_total integer;
  v_final integer;
  v_redemption public.promotion_redemptions%rowtype;
begin
  if coalesce(length(v_code), 0) = 0 then
    raise exception 'promotion code required';
  end if;
  if p_plan <> 'match-pass' then
    raise exception 'promotion not valid for plan';
  end if;
  if p_original_amount_cents < 100 then
    raise exception 'invalid original amount';
  end if;

  select * into v_promo
  from public.promotions
  where code = v_code
  for update;

  if v_promo.id is null then
    raise exception 'promotion not found';
  end if;
  if not v_promo.active then
    raise exception 'promotion inactive';
  end if;
  if v_promo.plan <> p_plan then
    raise exception 'promotion not valid for plan';
  end if;
  if now() < v_promo.starts_at or (v_promo.expires_at is not null and now() >= v_promo.expires_at) then
    raise exception 'promotion inactive';
  end if;
  if v_promo.allowed_email is not null and v_promo.allowed_email <> v_email then
    raise exception 'promotion not valid for email';
  end if;

  update public.promotion_redemptions
  set status = 'released', released_at = now()
  where promotion_id = v_promo.id
    and status = 'reserved'
    and reservation_expires_at <= now();

  select count(*) into v_total
  from public.promotion_redemptions
  where promotion_id = v_promo.id
    and status in ('reserved','completed');

  if v_total >= v_promo.max_redemptions then
    raise exception 'promotion exhausted';
  end if;

  select count(*) into v_email_total
  from public.promotion_redemptions
  where promotion_id = v_promo.id
    and email = v_email
    and status in ('reserved','completed');

  if v_email_total >= v_promo.max_redemptions_per_email then
    raise exception 'promotion exhausted for email';
  end if;

  v_final := least(p_original_amount_cents, v_promo.final_price_cents);
  if v_final < 100 then
    raise exception 'promotion final amount below minimum';
  end if;

  insert into public.promotion_redemptions(
    promotion_id, reservation_key, email, plan,
    original_amount_cents, final_amount_cents, discount_cents,
    status, reservation_expires_at
  ) values (
    v_promo.id, p_reservation_key, v_email, p_plan,
    p_original_amount_cents, v_final, p_original_amount_cents - v_final,
    'reserved', now() + interval '2 hours'
  ) returning * into v_redemption;

  return query select
    v_redemption.id,
    v_promo.id,
    v_promo.code,
    v_redemption.final_amount_cents,
    v_redemption.discount_cents;
end;
$$;

create or replace function public.bind_promotion_redemption(
  p_redemption_id uuid,
  p_customer_id uuid,
  p_order_id uuid,
  p_provider_order_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.promotion_redemptions
  set customer_id = p_customer_id,
      order_id = p_order_id,
      provider_order_id = p_provider_order_id
  where id = p_redemption_id
    and status = 'reserved'
    and reservation_expires_at > now()
    and order_id is null;

  if not found then
    raise exception 'promotion reservation unavailable';
  end if;
end;
$$;

create or replace function public.finish_promotion_redemption(
  p_provider_order_id text,
  p_completed boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_completed then
    update public.promotion_redemptions
    set status = 'completed', completed_at = coalesce(completed_at, now())
    where provider_order_id = p_provider_order_id
      and status in ('reserved','completed');
  else
    update public.promotion_redemptions
    set status = 'released', released_at = coalesce(released_at, now())
    where provider_order_id = p_provider_order_id
      and status = 'reserved';
  end if;
end;
$$;

revoke all on function public.reserve_promotion(text,text,text,integer,uuid) from public, anon, authenticated;
revoke all on function public.bind_promotion_redemption(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.finish_promotion_redemption(text,boolean) from public, anon, authenticated;
grant execute on function public.reserve_promotion(text,text,text,integer,uuid) to service_role;
grant execute on function public.bind_promotion_redemption(uuid,uuid,uuid,text) to service_role;
grant execute on function public.finish_promotion_redemption(text,boolean) to service_role;
