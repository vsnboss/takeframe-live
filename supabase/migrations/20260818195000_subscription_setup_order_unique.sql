create unique index if not exists subscriptions_setup_order_id_key
  on public.subscriptions(setup_order_id)
  where setup_order_id is not null;
